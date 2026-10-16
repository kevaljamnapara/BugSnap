import {
  ConsoleEvidenceEvent,
  ConsoleEventKind,
  ConsoleEventLevel,
  NetworkEvidenceEvent,
  NetworkOutcome,
  DebugSession,
} from './types';
import {
  MAX_CONSOLE_EVENTS,
  MAX_FAILED_NETWORK_EVENTS,
  MAX_OTHER_NETWORK_EVENTS,
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
  MAX_URL_LENGTH,
  MAX_BODY_SNIPPET_LENGTH,
} from './constants';
import { sanitizeAndTruncateText, sanitizeEvidenceText } from './evidenceSanitizer';

export { MAX_CONSOLE_EVENTS, MAX_FAILED_NETWORK_EVENTS, MAX_OTHER_NETWORK_EVENTS };

export function isFailedNetworkEvent(event: NetworkEvidenceEvent): boolean {
  if (event.outcome === 'failure') return true;
  if (typeof event.status === 'number' && event.status >= 400) return true;
  if (event.error) return true;
  return false;
}

function getFirstStackLine(stack?: string): string {
  if (!stack) return '';
  const lines = stack.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => l.startsWith('at ') || l.includes('@') || l.includes(':')) || lines[0] || '';
}

export function getConsoleDedupeKey(event: ConsoleEvidenceEvent): string {
  const firstLine = getFirstStackLine(event.stack);
  const source = event.source || '';
  const lineCol = event.line !== undefined ? `:${event.line}:${event.column ?? 0}` : '';
  return `${event.kind}|${event.level || ''}|${event.message}|${source}${lineCol}|${firstLine}`;
}

export function getNetworkDedupeKey(event: NetworkEvidenceEvent): string {
  const method = (event.method || 'GET').toUpperCase();
  const status = event.status !== undefined ? event.status : 0;
  const error = event.error || '';
  return `${method}|${event.url}|${status}|${error}`;
}

export function normalizeConsoleEvent(
  kind: ConsoleEventKind,
  details: {
    level?: ConsoleEventLevel;
    message?: unknown;
    stack?: unknown;
    source?: unknown;
    line?: unknown;
    column?: unknown;
    timestamp?: unknown;
  },
): ConsoleEvidenceEvent {
  const rawMessage = details.message !== undefined && details.message !== null ? details.message : 'Unknown JavaScript error';
  const { text: message, truncated: msgTruncated } = sanitizeAndTruncateText(rawMessage, MAX_MESSAGE_LENGTH);

  let stack: string | undefined;
  let stackTruncated = false;
  if (details.stack !== undefined && details.stack !== null) {
    const res = sanitizeAndTruncateText(details.stack, MAX_STACK_LENGTH);
    stack = res.text;
    stackTruncated = res.truncated;
  }

  let source: string | undefined;
  let srcTruncated = false;
  if (details.source !== undefined && details.source !== null) {
    const res = sanitizeAndTruncateText(details.source, MAX_URL_LENGTH);
    source = res.text;
    srcTruncated = res.truncated;
  }

  const timestamp = typeof details.timestamp === 'string' && details.timestamp
    ? details.timestamp
    : new Date().toISOString();

  const line = typeof details.line === 'number' && Number.isFinite(details.line) ? details.line : undefined;
  const column = typeof details.column === 'number' && Number.isFinite(details.column) ? details.column : undefined;

  const defaultLevel: ConsoleEventLevel = kind === 'console-warn' ? 'warn' : 'error';
  const level: ConsoleEventLevel = details.level || defaultLevel;

  return {
    id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    level,
    message,
    stack,
    source,
    line,
    column,
    timestamp,
    firstSeen: timestamp,
    lastSeen: timestamp,
    count: 1,
    truncated: msgTruncated || stackTruncated || srcTruncated || undefined,
  };
}

export function appendConsoleEvent(
  existing: ConsoleEvidenceEvent[],
  incoming: ConsoleEvidenceEvent,
  max: number = MAX_CONSOLE_EVENTS,
  onDrop?: () => void,
): ConsoleEvidenceEvent[] {
  const incomingKey = getConsoleDedupeKey(incoming);
  const duplicateIndex = existing.findIndex((e) => getConsoleDedupeKey(e) === incomingKey);

  if (duplicateIndex !== -1) {
    const prev = existing[duplicateIndex];
    const updated: ConsoleEvidenceEvent = {
      ...prev,
      count: prev.count + 1,
      lastSeen: incoming.timestamp,
      timestamp: incoming.timestamp,
    };
    const next = [...existing];
    next[duplicateIndex] = updated;
    return next;
  }

  if (existing.length >= max) {
    onDrop?.();
    return [...existing.slice(1), incoming];
  }

  return [...existing, incoming];
}

export function normalizeNetworkEvent(details: {
  url?: unknown;
  name?: unknown;
  method?: unknown;
  status?: unknown;
  statusText?: unknown;
  initiatorType?: unknown;
  duration?: unknown;
  timestamp?: unknown;
  outcome?: unknown;
  error?: unknown;
  responseBodySnippet?: unknown;
}): NetworkEvidenceEvent {
  const rawUrl = details.url || details.name || '';
  const { text: url, truncated: urlTruncated } = sanitizeAndTruncateText(rawUrl, MAX_URL_LENGTH);

  const initiatorType = sanitizeEvidenceText(details.initiatorType || 'other', 80);
  const method = details.method ? sanitizeEvidenceText(details.method, 16).toUpperCase() : undefined;
  const status = typeof details.status === 'number' && Number.isFinite(details.status) ? details.status : undefined;
  const statusText = details.statusText ? sanitizeEvidenceText(details.statusText, 64) : undefined;
  const duration = typeof details.duration === 'number' && Number.isFinite(details.duration)
    ? Math.max(0, Math.round(details.duration))
    : 0;

  let error: string | undefined;
  let errTruncated = false;
  if (details.error !== undefined && details.error !== null) {
    const res = sanitizeAndTruncateText(details.error, MAX_MESSAGE_LENGTH);
    error = res.text;
    errTruncated = res.truncated;
  }

  let outcome: NetworkOutcome = 'observed-resource';
  if (details.outcome === 'failure' || (status !== undefined && status >= 400) || error) {
    outcome = 'failure';
  } else if (details.outcome === 'success' || (status !== undefined && status >= 200 && status < 400)) {
    outcome = 'success';
  }

  // Response body snippet only allowed for failed calls (HTTP >= 400 or network error)
  let responseBodySnippet: string | undefined;
  let bodyTruncated = false;
  if (outcome === 'failure' && details.responseBodySnippet) {
    const res = sanitizeAndTruncateText(details.responseBodySnippet, MAX_BODY_SNIPPET_LENGTH);
    responseBodySnippet = res.text;
    bodyTruncated = res.truncated;
  }

  const timestamp = typeof details.timestamp === 'string' && details.timestamp
    ? details.timestamp
    : new Date().toISOString();

  return {
    id: `network-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    method,
    status,
    statusText,
    initiatorType,
    duration,
    timestamp,
    firstSeen: timestamp,
    lastSeen: timestamp,
    outcome,
    count: 1,
    error,
    responseBodySnippet,
    truncated: urlTruncated || errTruncated || bodyTruncated || undefined,
  };
}

export function appendNetworkEvent(
  existing: NetworkEvidenceEvent[],
  incoming: NetworkEvidenceEvent,
  maxOther: number = MAX_OTHER_NETWORK_EVENTS,
  maxFailed: number = MAX_FAILED_NETWORK_EVENTS,
  onDrop?: (kind: 'failed' | 'other') => void,
): NetworkEvidenceEvent[] {
  const incomingKey = getNetworkDedupeKey(incoming);
  const duplicateIndex = existing.findIndex((e) => getNetworkDedupeKey(e) === incomingKey);

  if (duplicateIndex !== -1) {
    const prev = existing[duplicateIndex];
    const updated: NetworkEvidenceEvent = {
      ...prev,
      count: prev.count + 1,
      lastSeen: incoming.timestamp,
      timestamp: incoming.timestamp,
      // If the incoming occurrence had a body snippet and existing did not, retain it
      responseBodySnippet: prev.responseBodySnippet || incoming.responseBodySnippet,
    };
    const next = [...existing];
    next[duplicateIndex] = updated;
    return next;
  }

  const incomingIsFailed = isFailedNetworkEvent(incoming);
  const next = [...existing];

  if (incomingIsFailed) {
    // Count failed calls
    const failedIndices: number[] = [];
    next.forEach((event, idx) => {
      if (isFailedNetworkEvent(event)) failedIndices.push(idx);
    });

    if (failedIndices.length >= maxFailed) {
      // Drop the oldest failed event
      const oldestFailedIdx = failedIndices[0];
      next.splice(oldestFailedIdx, 1);
      onDrop?.('failed');
    }
  } else {
    // Count other calls
    const otherIndices: number[] = [];
    next.forEach((event, idx) => {
      if (!isFailedNetworkEvent(event)) otherIndices.push(idx);
    });

    if (otherIndices.length >= maxOther) {
      // Drop the oldest other event
      const oldestOtherIdx = otherIndices[0];
      next.splice(oldestOtherIdx, 1);
      onDrop?.('other');
    }
  }

  next.push(incoming);
  return next;
}

export function appendConsoleEventToSession(
  session: DebugSession,
  incoming: ConsoleEvidenceEvent,
): DebugSession {
  let droppedCount = session.droppedConsoleCount || 0;
  const updated = appendConsoleEvent(
    session.consoleEvents || [],
    incoming,
    MAX_CONSOLE_EVENTS,
    () => { droppedCount++; },
  );

  return {
    ...session,
    consoleEvents: updated,
    droppedConsoleCount: droppedCount,
  };
}

export function appendNetworkEventToSession(
  session: DebugSession,
  incoming: NetworkEvidenceEvent,
): DebugSession {
  let droppedFailed = session.droppedFailedNetworkCount || 0;
  let droppedOther = session.droppedOtherNetworkCount || 0;

  const updated = appendNetworkEvent(
    session.networkEvents || [],
    incoming,
    MAX_OTHER_NETWORK_EVENTS,
    MAX_FAILED_NETWORK_EVENTS,
    (kind) => {
      if (kind === 'failed') droppedFailed++;
      else droppedOther++;
    },
  );

  return {
    ...session,
    networkEvents: updated,
    droppedFailedNetworkCount: droppedFailed,
    droppedOtherNetworkCount: droppedOther,
  };
}
