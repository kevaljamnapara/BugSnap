import { DebugSession } from './types';
import { isFailedNetworkEvent } from './consoleSession';
import { sanitizeEvidenceText, sanitizeEvidenceUrl } from './evidenceSanitizer';
import { reviewedSession } from './evidenceReview';

export interface EvidenceCounts {
  consoleErrors: number;
  consoleWarnings: number;
  failedNetwork: number;
  otherNetwork: number;
  droppedConsole: number;
  droppedFailedNetwork: number;
  droppedOtherNetwork: number;
}

export interface FormattedEvidence {
  sessionState: 'not-active' | 'active-empty' | 'recorded';
  statusLine: string;
  countSummary: string;
  counts: EvidenceCounts;
  consoleMarkdown: string;
  consoleHtml: string;
  failedNetworkMarkdown: string;
  failedNetworkHtml: string;
  otherNetworkMarkdown: string;
  otherNetworkHtml: string;
  limitationsMarkdown: string;
  limitationsHtml: string;
  promptConsoleSection: string;
  promptFailedNetworkSection: string;
  promptOtherNetworkSection: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(timestamp: string, sessionStart?: string): string {
  if (!sessionStart) return timestamp;
  const startMs = new Date(sessionStart).getTime();
  const eventMs = new Date(timestamp).getTime();
  if (isNaN(startMs) || isNaN(eventMs)) return timestamp;
  const diffMs = eventMs - startMs;
  if (diffMs < 0) return timestamp;
  return `+${(diffMs / 1000).toFixed(1)}s`;
}

export function formatEvidence(rawSession?: DebugSession): FormattedEvidence {
  if (!rawSession) {
    const counts: EvidenceCounts = {
      consoleErrors: 0,
      consoleWarnings: 0,
      failedNetwork: 0,
      otherNetwork: 0,
      droppedConsole: 0,
      droppedFailedNetwork: 0,
      droppedOtherNetwork: 0,
    };
    const limitationsMd = formatLimitationsMarkdown(undefined);
    const limitationsHtml = formatLimitationsHtml(undefined);

    return {
      sessionState: 'not-active',
      statusLine: 'Debug session was not active during this capture.',
      countSummary: 'Evidence: Debug session not active.',
      counts,
      consoleMarkdown: 'Console error capture was not active during this capture.',
      consoleHtml: '<p><em>Console error capture was not active during this capture.</em></p>',
      failedNetworkMarkdown: 'Network diagnostic capture was not active for this capture.',
      failedNetworkHtml: '<p><em>Network diagnostic capture was not active for this capture.</em></p>',
      otherNetworkMarkdown: 'No network activity captured (debug session was not active).',
      otherNetworkHtml: '<p><em>No network activity captured (debug session was not active).</em></p>',
      limitationsMarkdown: limitationsMd,
      limitationsHtml: limitationsHtml,
      promptConsoleSection: 'Debug session was not active during this capture.',
      promptFailedNetworkSection: 'Debug session was not active during this capture.',
      promptOtherNetworkSection: 'Debug session was not active during this capture.',
    };
  }

  const session = reviewedSession(rawSession);
  const consoleEvents = [...(session.consoleEvents || [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const allNetworkEvents = [...(session.networkEvents || [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const failedNetworkEvents = allNetworkEvents.filter((e) => isFailedNetworkEvent(e));
  const otherNetworkEvents = allNetworkEvents.filter((e) => !isFailedNetworkEvent(e));

  const consoleErrors = consoleEvents.filter((e) => e.level !== 'warn' && e.kind !== 'console-warn').length;
  const consoleWarnings = consoleEvents.filter((e) => e.level === 'warn' || e.kind === 'console-warn').length;
  const failedNetwork = failedNetworkEvents.length;
  const otherNetwork = otherNetworkEvents.length;

  const droppedConsole = session.droppedConsoleCount || 0;
  const droppedFailedNetwork = session.droppedFailedNetworkCount || 0;
  const droppedOtherNetwork = session.droppedOtherNetworkCount || 0;

  const totalOmitted = droppedConsole + droppedFailedNetwork + droppedOtherNetwork;
  const omittedNote = totalOmitted > 0 ? ` (${totalOmitted} older items omitted by buffer caps)` : '';

  const countSummary = `Evidence: ${consoleErrors} console error${consoleErrors === 1 ? '' : 's'}, ${consoleWarnings} console warning${consoleWarnings === 1 ? '' : 's'}, ${failedNetwork} failed network call${failedNetwork === 1 ? '' : 's'}, ${otherNetwork} other call${otherNetwork === 1 ? '' : 's'}${omittedNote}`;

  const startedAt = session.startedAt || 'Unknown start';
  const stoppedAt = session.stoppedAt || (session.status === 'active' ? 'Still active' : 'Stopped');
  const navInterrupted = session.interruptedByNavigation
    ? ' (Session was interrupted by page navigation/reload)'
    : '';

  const statusLine = `Debug session: ${session.status} (${startedAt} to ${stoppedAt})${navInterrupted}.`;

  const totalRecorded = consoleEvents.length + allNetworkEvents.length;
  const sessionState = totalRecorded === 0 ? 'active-empty' : 'recorded';

  // 1. Console section formatting
  let consoleMd = '';
  let consoleHtml = '';
  let promptConsole = '';

  if (consoleEvents.length === 0) {
    consoleMd = 'Debug session was active — 0 runtime errors or warnings were recorded.';
    consoleHtml = '<p>Debug session was active — 0 runtime errors or warnings were recorded.</p>';
    promptConsole = 'Debug session was active — 0 runtime errors or warnings recorded.';
  } else {
    const mdLines: string[] = [];
    const htmlLines: string[] = [];
    const promptLines: string[] = [];

    consoleEvents.forEach((e) => {
      const relTime = formatRelativeTime(e.timestamp, session.startedAt);
      const cleanMsg = sanitizeEvidenceText(e.message);
      const countStr = e.count > 1 ? ` (${e.count}x)` : '';
      const kindLevel = e.level ? `${e.kind}/${e.level}` : e.kind;
      const srcCol = e.source ? `\n    - Source: \`${sanitizeEvidenceText(e.source)}${e.line !== undefined ? `:${e.line}:${e.column ?? 0}` : ''}\`` : '';
      const stackStr = e.stack ? `\n    - Stack:\n\`\`\`\n${sanitizeEvidenceText(e.stack)}\n\`\`\`` : '';

      mdLines.push(`- **[${kindLevel}]** ${cleanMsg} *(${relTime}${countStr})*${srcCol}${stackStr}`);
      htmlLines.push(
        `<li><strong>[${kindLevel}]</strong> ${escapeHtml(cleanMsg)} <em>(${relTime}${countStr})</em>${e.source ? `<br/><small>Source: <code>${escapeHtml(e.source)}${e.line !== undefined ? `:${e.line}:${e.column ?? 0}` : ''}</code></small>` : ''}${e.stack ? `<pre style="font-size: 11px; margin: 4px 0;">${escapeHtml(e.stack)}</pre>` : ''}</li>`
      );

      promptLines.push(
        `### [${kindLevel}] (relative: ${relTime}${countStr})\nMessage:\n\`\`\`\n${cleanMsg}\n\`\`\`${e.source ? `\nSource: \`${e.source}${e.line !== undefined ? `:${e.line}:${e.column ?? 0}` : ''}\`` : ''}${e.stack ? `\nStack:\n\`\`\`\n${e.stack}\n\`\`\`` : ''}`
      );
    });

    if (droppedConsole > 0) {
      mdLines.push(`\n*Notice: ${droppedConsole} older console event(s) not shown (ring buffer limit).*`);
      htmlLines.push(`<p><small>Notice: ${droppedConsole} older console event(s) not shown (ring buffer limit).</small></p>`);
      promptLines.push(`\nNotice: ${droppedConsole} older console event(s) not shown (ring buffer limit).`);
    }

    consoleMd = mdLines.join('\n');
    consoleHtml = `<ul>${htmlLines.join('')}</ul>`;
    promptConsole = promptLines.join('\n\n');
  }

  // 2. Failed Network section formatting
  let failedNetworkMd = '';
  let failedNetworkHtml = '';
  let promptFailedNetwork = '';

  if (failedNetworkEvents.length === 0) {
    failedNetworkMd = 'Debug session was active — 0 failed network requests were recorded.';
    failedNetworkHtml = '<p>Debug session was active — 0 failed network requests were recorded.</p>';
    promptFailedNetwork = 'Debug session was active — 0 failed network requests recorded.';
  } else {
    const mdLines: string[] = [];
    const htmlLines: string[] = [];
    const promptLines: string[] = [];

    failedNetworkEvents.forEach((n) => {
      const relTime = formatRelativeTime(n.timestamp, session.startedAt);
      const safeUrl = sanitizeEvidenceUrl(n.url);
      const method = n.method || 'GET';
      const statusStr = n.status ? `${n.status}${n.statusText ? ` ${n.statusText}` : ''}` : n.error || 'Failed';
      const countStr = n.count > 1 ? ` (${n.count}x)` : '';
      const snippetMd = n.responseBodySnippet
        ? `\n    - Response snippet:\n\`\`\`\n${sanitizeEvidenceText(n.responseBodySnippet)}\n\`\`\``
        : '';

      mdLines.push(`- **[${method}]** \`${safeUrl}\` — **${statusStr}** (${n.duration}ms, ${relTime}${countStr})${snippetMd}`);
      htmlLines.push(
        `<li><strong>[${method}]</strong> <code>${escapeHtml(safeUrl)}</code> — <strong>${escapeHtml(statusStr)}</strong> (${n.duration}ms, ${relTime}${countStr})${n.responseBodySnippet ? `<pre style="font-size: 11px; margin: 4px 0;">${escapeHtml(n.responseBodySnippet)}</pre>` : ''}</li>`
      );

      promptLines.push(
        `### [${method}] ${statusStr} (relative: ${relTime}${countStr}, ${n.duration}ms)\nURL:\n\`\`\`\n${safeUrl}\n\`\`\`${n.responseBodySnippet ? `\nResponse Body Snippet:\n\`\`\`\n${n.responseBodySnippet}\n\`\`\`` : ''}`
      );
    });

    if (droppedFailedNetwork > 0) {
      mdLines.push(`\n*Notice: ${droppedFailedNetwork} older failed network call(s) not shown (ring buffer limit).*`);
      htmlLines.push(`<p><small>Notice: ${droppedFailedNetwork} older failed network call(s) not shown (ring buffer limit).</small></p>`);
      promptLines.push(`\nNotice: ${droppedFailedNetwork} older failed network call(s) not shown (ring buffer limit).`);
    }

    failedNetworkMd = mdLines.join('\n');
    failedNetworkHtml = `<ul>${htmlLines.join('')}</ul>`;
    promptFailedNetwork = promptLines.join('\n\n');
  }

  // 3. Other Network section formatting
  let otherNetworkMd = '';
  let otherNetworkHtml = '';
  let promptOtherNetwork = '';

  if (otherNetworkEvents.length === 0) {
    otherNetworkMd = 'No other network activity recorded.';
    otherNetworkHtml = '<p>No other network activity recorded.</p>';
    promptOtherNetwork = 'No other network activity recorded.';
  } else {
    const mdLines: string[] = [];
    const htmlLines: string[] = [];
    const promptLines: string[] = [];

    otherNetworkEvents.forEach((n) => {
      const relTime = formatRelativeTime(n.timestamp, session.startedAt);
      const safeUrl = sanitizeEvidenceUrl(n.url);
      const method = n.method || 'GET';
      const statusStr = n.status ? String(n.status) : 'OK';
      const countStr = n.count > 1 ? ` (${n.count}x)` : '';

      mdLines.push(`- \`${method} ${statusStr} ${safeUrl} (${n.duration}ms, ${relTime})\`${countStr}`);
      htmlLines.push(`<li><code>${method} ${statusStr} ${escapeHtml(safeUrl)} (${n.duration}ms, ${relTime})</code>${countStr}</li>`);
      promptLines.push(`- \`${method} ${statusStr} ${safeUrl} (${n.duration}ms, ${relTime})\`${countStr}`);
    });

    if (droppedOtherNetwork > 0) {
      mdLines.push(`\n*Notice: ${droppedOtherNetwork} older network call(s) not shown (ring buffer limit).*`);
      htmlLines.push(`<p><small>Notice: ${droppedOtherNetwork} older network call(s) not shown (ring buffer limit).</small></p>`);
      promptLines.push(`\nNotice: ${droppedOtherNetwork} older network call(s) not shown (ring buffer limit).`);
    }

    otherNetworkMd = mdLines.join('\n');
    otherNetworkHtml = `<ul>${htmlLines.join('')}</ul>`;
    promptOtherNetwork = promptLines.join('\n');
  }

  const limitationsMd = formatLimitationsMarkdown(session);
  const limitationsHtml = formatLimitationsHtml(session);

  return {
    sessionState,
    statusLine,
    countSummary,
    counts: {
      consoleErrors,
      consoleWarnings,
      failedNetwork,
      otherNetwork,
      droppedConsole,
      droppedFailedNetwork,
      droppedOtherNetwork,
    },
    consoleMarkdown: consoleMd,
    consoleHtml,
    failedNetworkMarkdown: failedNetworkMd,
    failedNetworkHtml,
    otherNetworkMarkdown: otherNetworkMd,
    otherNetworkHtml,
    limitationsMarkdown: limitationsMd,
    limitationsHtml,
    promptConsoleSection: promptConsole,
    promptFailedNetworkSection: promptFailedNetwork,
    promptOtherNetworkSection: promptOtherNetwork,
  };
}

function formatLimitationsMarkdown(session?: DebugSession): string {
  const navInterrupted = session?.interruptedByNavigation
    ? '\n- **Session Navigation Interruption**: The observed page navigated or reloaded during this session. Injected capture hooks were terminated at page unload.'
    : '';

  return `- **Captured Invariants**: Only \`console.error\` and \`console.warn\` calls, uncaught exceptions, unhandled rejections, and CSP violations are recorded. \`console.log\`, \`console.info\`, and \`console.debug\` are omitted to reduce noise and prevent accidental data leakage.
- **Pre-Session History**: Events occurring prior to starting the error session are not accessible without elevated browser security privileges.
- **Internal Network Codes**: Low-level browser networking failure codes (\`net::ERR_*\`) cannot be inspected by page-level scripts without elevated debugger permissions.
- **Protected Scopes**: Requests, errors, and scripts inside cross-origin iframes, Web Workers, and Service Workers are isolated by browser security policies and are not captured.
- **Request Bodies & Headers**: Request headers and request bodies are never captured under any circumstances.
- **Response Bodies**: Response body snippets (up to 2 KB, sanitized and redacted) are recorded solely for failed requests (HTTP status >= 400 or network rejections). Response bodies of successful requests are never accessed or inspected.
- **Local Privacy**: BugSnap operates entirely locally with zero external network transmission, analytics, telemetry, or remote AI processing.${navInterrupted}`;
}

function formatLimitationsHtml(session?: DebugSession): string {
  const navInterrupted = session?.interruptedByNavigation
    ? '<li><strong>Session Navigation Interruption:</strong> The observed page navigated or reloaded during this session. Injected capture hooks were terminated at page unload.</li>'
    : '';

  return `<ul style="font-size: 12px; color: #636366; margin: 0 0 12px 0; padding-left: 20px;">
  <li><strong>Captured Invariants:</strong> Only <code>console.error</code> and <code>console.warn</code> calls, uncaught exceptions, unhandled rejections, and CSP violations are recorded. <code>console.log</code>, <code>info</code>, and <code>debug</code> are omitted.</li>
  <li><strong>Pre-Session History:</strong> Events occurring before starting the session are not accessible.</li>
  <li><strong>Internal Network Codes:</strong> Low-level browser networking codes (<code>net::ERR_*</code>) require intrusive permissions.</li>
  <li><strong>Protected Scopes:</strong> Requests and errors inside cross-origin iframes, Web Workers, and Service Workers are isolated and not captured.</li>
  <li><strong>Request Bodies & Headers:</strong> Request headers and bodies are never captured.</li>
  <li><strong>Response Bodies:</strong> Response snippets (up to 2 KB, sanitized) are recorded solely for failed requests (HTTP >= 400).</li>
  <li><strong>Local Privacy:</strong> BugSnap operates entirely locally with zero external network transmission.</li>
  ${navInterrupted}
</ul>`;
}
