/**
 * BugSnap Debug Session In-Page Hooks and Isolated Relay.
 *
 * MAIN world script intercepts console.error, console.warn, uncaught errors,
 * unhandled rejections, CSP violations, fetch(), XMLHttpRequest, and subresource failures.
 *
 * ISOLATED world script acts as a secure bridge: receives batched events from MAIN via
 * window.postMessage with a per-session random nonce and forwards them to the extension
 * service worker using chrome.runtime.sendMessage.
 */

/* ==========================================================================
   MAIN World In-Page Capture Script (executed in target tab MAIN world)
   ========================================================================== */

interface WindowWithBugSnapMain extends Window {
  __bugSnapMainCleanup?: () => void;
}

interface XhrWithBugSnap extends XMLHttpRequest {
  __bugSnap?: {
    method: string;
    url: string;
    startTime: number;
    completed: boolean;
  };
}

export function mainWorldCaptureScript(nonce: string) {
  const win = window as unknown as WindowWithBugSnapMain;

  // Idempotent install: clean up any existing BugSnap session first
  if (typeof win.__bugSnapMainCleanup === 'function') {
    try {
      win.__bugSnapMainCleanup();
    } catch {
      // ignore cleanup errors
    }
  }

  // --- Safe Serializer & Formatter ---
  function safeSerialize(arg: unknown, depth = 0, seen = new WeakSet<object>()): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    const type = typeof arg;
    if (type === 'string') return arg as string;
    if (type === 'number' || type === 'boolean') return String(arg);
    if (type === 'bigint') return `${arg}n`;
    if (type === 'symbol') return (arg as symbol).toString();
    if (type === 'function') return `[Function: ${(arg as { name?: string }).name || 'anonymous'}]`;

    if (arg instanceof Error) {
      return arg.stack || `${arg.name}: ${arg.message}`;
    }

    if (typeof Node !== 'undefined' && arg instanceof Node) {
      if (arg instanceof Element) {
        const id = arg.id ? `#${arg.id}` : '';
        const className = typeof arg.className === 'string' && arg.className.trim()
          ? `.${arg.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : '';
        return `<${arg.tagName.toLowerCase()}${id}${className}>`;
      }
      return `[${arg.nodeName}]`;
    }

    if (type === 'object') {
      const obj = arg as Record<string, unknown>;
      if (seen.has(obj)) return '[Circular]';
      if (depth >= 3) return Array.isArray(obj) ? '[Array]' : '[Object]';
      seen.add(obj);

      try {
        if (Array.isArray(obj)) {
          if (obj.length === 0) return '[]';
          const items = obj.slice(0, 10).map((item) => safeSerialize(item, depth + 1, seen));
          if (obj.length > 10) items.push(`... ${obj.length - 10} more`);
          return `[${items.join(', ')}]`;
        }

        const keys = Object.keys(obj).slice(0, 15);
        const parts: string[] = [];
        for (const key of keys) {
          try {
            parts.push(`${key}: ${safeSerialize(obj[key], depth + 1, seen)}`);
          } catch {
            parts.push(`${key}: [Error accessing property]`);
          }
        }
        if (Object.keys(obj).length > 15) {
          parts.push(`... ${Object.keys(obj).length - 15} more`);
        }
        return `{ ${parts.join(', ')} }`;
      } catch {
        return '[Unserializable Object]';
      }
    }

    return String(arg);
  }

  function formatConsoleArgs(args: unknown[]): string {
    if (!args || args.length === 0) return '';
    const first = args[0];
    if (typeof first === 'string' && /%[sdifjocO%]/.test(first)) {
      let argIndex = 1;
      const formatted = first.replace(/%([sdifjocO%])/g, (match, specifier) => {
        if (match === '%%') return '%';
        if (argIndex >= args.length) return match;
        const currentArg = args[argIndex++];
        switch (specifier) {
          case 's':
            return typeof currentArg === 'string' ? currentArg : safeSerialize(currentArg);
          case 'd':
          case 'i':
            return String(parseInt(String(currentArg), 10));
          case 'f':
            return String(parseFloat(String(currentArg)));
          case 'j':
          case 'o':
          case 'O':
            return safeSerialize(currentArg);
          case 'c':
            return '';
          default:
            return match;
        }
      });
      const remaining = args.slice(argIndex).map((a) => safeSerialize(a));
      return remaining.length > 0 ? `${formatted} ${remaining.join(' ')}` : formatted;
    }
    if (args.length === 1) return safeSerialize(args[0]);
    return args.map((a) => safeSerialize(a)).join(' ');
  }

  // --- Batching & Flush Buffer ---
  let eventBuffer: Array<{ type: 'console' | 'network'; event: Record<string, unknown> }> = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (eventBuffer.length === 0) return;
    const batch = eventBuffer;
    eventBuffer = [];
    try {
      window.postMessage(
        {
          source: 'BUGSNAP_MAIN',
          nonce,
          events: batch,
        },
        '*',
      );
    } catch {
      // postMessage failed
    }
  }

  function enqueue(type: 'console' | 'network', event: Record<string, unknown>) {
    eventBuffer.push({ type, event });
    if (eventBuffer.length >= 20) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, 250);
    }
  }

  // Re-entrancy guard
  let isInternal = false;

  // --- 1. Console Patching ---
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  const consoleErrorWrapper = function (this: unknown, ...args: unknown[]) {
    try {
      if (!isInternal) {
        isInternal = true;
        const msg = formatConsoleArgs(args);
        let firstStack: string | undefined;
        for (const arg of args) {
          if (arg instanceof Error && arg.stack) {
            firstStack = arg.stack;
            break;
          }
        }
        enqueue('console', {
          kind: 'console-error',
          level: 'error',
          message: msg,
          stack: firstStack,
          timestamp: new Date().toISOString(),
        });
        isInternal = false;
      }
    } catch {
      isInternal = false;
    }
    return originalConsoleError.apply(this, args);
  };

  const consoleWarnWrapper = function (this: unknown, ...args: unknown[]) {
    try {
      if (!isInternal) {
        isInternal = true;
        const msg = formatConsoleArgs(args);
        enqueue('console', {
          kind: 'console-warn',
          level: 'warn',
          message: msg,
          timestamp: new Date().toISOString(),
        });
        isInternal = false;
      }
    } catch {
      isInternal = false;
    }
    return originalConsoleWarn.apply(this, args);
  };

  console.error = consoleErrorWrapper;
  console.warn = consoleWarnWrapper;

  // --- 2. Uncaught Errors & Subresource Failures ---
  const onErrorListener = (evt: ErrorEvent | Event) => {
    try {
      if ('message' in evt && evt.message) {
        const err = evt as ErrorEvent;
        enqueue('console', {
          kind: 'runtime-error',
          level: 'error',
          message: err.message,
          stack: err.error instanceof Error ? err.error.stack : undefined,
          source: err.filename,
          line: err.lineno,
          column: err.colno,
          timestamp: new Date().toISOString(),
        });
      } else if (evt.target && evt.target instanceof Element && evt.target !== (window as unknown)) {
        const el = evt.target as Element;
        const tag = el.tagName.toLowerCase();
        let url = '';
        if ('src' in el && typeof (el as HTMLImageElement).src === 'string') {
          url = (el as HTMLImageElement).src;
        } else if ('href' in el && typeof (el as HTMLLinkElement).href === 'string') {
          url = (el as HTMLLinkElement).href;
        }
        if (url) {
          enqueue('network', {
            url,
            method: 'GET',
            initiatorType: tag,
            duration: 0,
            outcome: 'failure',
            error: `Failed to load <${tag}>`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      // never throw into page
    }
  };
  window.addEventListener('error', onErrorListener, true);

  // --- 3. Unhandled Rejections ---
  const onUnhandledRejectionListener = (evt: PromiseRejectionEvent) => {
    try {
      const reason = evt.reason;
      let msg = 'Unhandled promise rejection';
      let stack: string | undefined;
      if (reason instanceof Error) {
        msg = reason.message || reason.name;
        stack = reason.stack;
      } else if (reason !== undefined && reason !== null) {
        msg = safeSerialize(reason);
      }
      enqueue('console', {
        kind: 'unhandled-rejection',
        level: 'error',
        message: msg,
        stack,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  };
  window.addEventListener('unhandledrejection', onUnhandledRejectionListener);

  // --- 4. CSP Violations ---
  const onCspListener = (evt: SecurityPolicyViolationEvent) => {
    try {
      enqueue('console', {
        kind: 'csp-violation',
        level: 'error',
        message: `CSP violation: directive "${evt.violatedDirective}" blocked "${evt.blockedURI}"`,
        source: evt.sourceFile,
        line: evt.lineNumber,
        column: evt.columnNumber,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  };
  window.addEventListener('securitypolicyviolation', onCspListener);

  // Set of URLs tracked by fetch or XHR to avoid duplicate PerformanceObserver entries
  const trackedNetworkUrls = new Set<string>();

  // --- 5. Fetch Hook ---
  const originalFetch = window.fetch;
  const fetchWrapper = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    let url = '';
    let method = 'GET';
    try {
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input && typeof input === 'object' && 'url' in input) {
        url = (input as Request).url;
        method = (input as Request).method || 'GET';
      }
      if (init?.method) {
        method = init.method;
      }
      method = method.toUpperCase();
      if (url) trackedNetworkUrls.add(url);
    } catch {
      // ignore
    }

    const startTime = performance.now();
    let response: Response;
    try {
      response = await originalFetch.call(this as Window, input, init);
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - startTime);
      const errorObj = err as Error | undefined;
      try {
        enqueue('network', {
          url,
          method,
          initiatorType: 'fetch',
          duration,
          outcome: 'failure',
          error: `${errorObj?.name || 'TypeError'}: ${errorObj?.message || 'Failed to fetch'}`,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
      throw err;
    }

    const duration = Math.round(performance.now() - startTime);
    const status = response.status;
    const statusText = response.statusText;
    const isFailed = !response.ok || status >= 400;

    if (isFailed) {
      let snippet: string | undefined;
      try {
        const clone = response.clone();
        const text = await clone.text();
        snippet = text.slice(0, 2048);
      } catch {
        // clone text failed
      }
      try {
        enqueue('network', {
          url,
          method,
          status,
          statusText,
          initiatorType: 'fetch',
          duration,
          outcome: 'failure',
          responseBodySnippet: snippet,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    } else {
      try {
        enqueue('network', {
          url,
          method,
          status,
          statusText,
          initiatorType: 'fetch',
          duration,
          outcome: 'success',
          timestamp: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    }

    return response;
  };

  try {
    Object.defineProperty(fetchWrapper, 'name', { value: 'fetch', configurable: true });
    Object.defineProperty(fetchWrapper, 'length', { value: 1, configurable: true });
  } catch {
    // ignore
  }
  window.fetch = fetchWrapper as typeof window.fetch;

  // --- 6. XMLHttpRequest Hook ---
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  const xhrOpenWrapper = function (
    this: XhrWithBugSnap,
    method: string,
    url: string | URL,
    ...rest: [boolean?, (string | null)?, (string | null)?]
  ) {
    try {
      this.__bugSnap = {
        method: String(method || 'GET').toUpperCase(),
        url: typeof url === 'string' ? url : url.toString(),
        startTime: 0,
        completed: false,
      };
      if (this.__bugSnap.url) trackedNetworkUrls.add(this.__bugSnap.url);
    } catch {
      // ignore
    }
    return (originalXhrOpen as (...args: unknown[]) => void).apply(this, [method, url, ...rest]);
  };

  const xhrSendWrapper = function (this: XhrWithBugSnap, body?: Document | XMLHttpRequestBodyInit | null) {
    if (this.__bugSnap) {
      this.__bugSnap.startTime = performance.now();
      const meta = this.__bugSnap;

      const handleDone = (outcome: 'success' | 'failure', errorMsg?: string) => {
        if (meta.completed) return;
        meta.completed = true;
        const duration = Math.round(performance.now() - meta.startTime);
        const status = this.status || 0;
        const statusText = this.statusText || '';
        const isFail = outcome === 'failure' || status >= 400 || status === 0;

        let snippet: string | undefined;
        if (isFail && (this.responseType === '' || this.responseType === 'text')) {
          try {
            if (typeof this.responseText === 'string') {
              snippet = this.responseText.slice(0, 2048);
            }
          } catch {
            // ignore
          }
        }

        enqueue('network', {
          url: meta.url,
          method: meta.method,
          status: status > 0 ? status : undefined,
          statusText: statusText || undefined,
          initiatorType: 'xmlhttprequest',
          duration,
          outcome: isFail ? 'failure' : 'success',
          error: errorMsg,
          responseBodySnippet: snippet,
          timestamp: new Date().toISOString(),
        });
      };

      this.addEventListener('load', () => handleDone(this.status >= 400 ? 'failure' : 'success'));
      this.addEventListener('error', () => handleDone('failure', 'XHR network error'));
      this.addEventListener('timeout', () => handleDone('failure', 'XHR timeout'));
      this.addEventListener('abort', () => handleDone('failure', 'XHR aborted'));
    }
    return originalXhrSend.call(this, body);
  };

  XMLHttpRequest.prototype.open = xhrOpenWrapper as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = xhrSendWrapper;

  // --- 7. PerformanceObserver Resource Fallback ---
  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const res = entry as PerformanceResourceTiming;
          if (trackedNetworkUrls.has(res.name)) continue;
          const status = (res as PerformanceResourceTiming & { responseStatus?: number }).responseStatus;
          const isFail = typeof status === 'number' && status >= 400;
          enqueue('network', {
            url: res.name,
            method: 'GET',
            status: typeof status === 'number' && status > 0 ? status : undefined,
            initiatorType: res.initiatorType || 'other',
            duration: Math.round(res.duration || 0),
            outcome: isFail ? 'failure' : 'observed-resource',
            timestamp: new Date().toISOString(),
          });
        }
      });
      observer.observe({ type: 'resource', buffered: false });
    } catch {
      // ignore
    }
  }

  // --- 8. Unload Listeners ---
  const onPageHide = () => flush();
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onPageHide);

  // --- 9. Cleanup Registration ---
  win.__bugSnapMainCleanup = () => {
    // Only restore if our wrappers are still active (do not clobber if page replaced after us)
    if (console.error === consoleErrorWrapper) console.error = originalConsoleError;
    if (console.warn === consoleWarnWrapper) console.warn = originalConsoleWarn;
    if (window.fetch === fetchWrapper) window.fetch = originalFetch;
    if (XMLHttpRequest.prototype.open === xhrOpenWrapper) XMLHttpRequest.prototype.open = originalXhrOpen;
    if (XMLHttpRequest.prototype.send === xhrSendWrapper) XMLHttpRequest.prototype.send = originalXhrSend;

    window.removeEventListener('error', onErrorListener, true);
    window.removeEventListener('unhandledrejection', onUnhandledRejectionListener);
    window.removeEventListener('securitypolicyviolation', onCspListener);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onPageHide);

    try {
      observer?.disconnect();
    } catch {
      // ignore
    }

    flush();
    delete win.__bugSnapMainCleanup;
  };
}

/* ==========================================================================
   ISOLATED World Relay Script (executed in target tab ISOLATED world)
   ========================================================================== */

interface WindowWithBugSnapRelay extends Window {
  __bugSnapRelayCleanup?: () => void;
}

export function isolatedRelayScript(reportId: string, nonce: string) {
  const win = window as unknown as WindowWithBugSnapRelay;

  if (typeof win.__bugSnapRelayCleanup === 'function') {
    try {
      win.__bugSnapRelayCleanup();
    } catch {
      // ignore
    }
  }

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'BUGSNAP_MAIN' || data.nonce !== nonce) return;
    if (!Array.isArray(data.events) || data.events.length === 0) return;

    try {
      chrome.runtime.sendMessage({
        type: 'BUGSNAP_BATCH_EVENTS',
        reportId,
        events: data.events,
      });
    } catch {
      // extension context disconnected or invalidated
    }
  };

  const onPageHide = () => {
    try {
      chrome.runtime.sendMessage({
        type: 'BUGSNAP_PAGE_UNLOAD',
        reportId,
      });
    } catch {
      // ignore
    }
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('pagehide', onPageHide);

  win.__bugSnapRelayCleanup = () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('pagehide', onPageHide);
    delete win.__bugSnapRelayCleanup;
  };
}
