import { ConsoleEvidenceEvent, ConsoleEventKind } from './types';
import { sanitizeEvidenceText } from './evidenceSanitizer';

export const MAX_CONSOLE_EVENTS = 50;

export function normalizeConsoleEvent(
  kind: ConsoleEventKind,
  details: { message?: unknown; stack?: unknown; source?: unknown; timestamp?: unknown },
): ConsoleEvidenceEvent {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message: sanitizeEvidenceText(details.message || 'Unknown JavaScript error', 1_000),
    stack: details.stack ? sanitizeEvidenceText(details.stack, 2_000) : undefined,
    source: details.source ? sanitizeEvidenceText(details.source, 500) : undefined,
    timestamp: typeof details.timestamp === 'string' ? details.timestamp : new Date().toISOString(),
    count: 1,
  };
}

export function appendConsoleEvent(
  existing: ConsoleEvidenceEvent[],
  incoming: ConsoleEvidenceEvent,
): ConsoleEvidenceEvent[] {
  const duplicate = existing.find(
    (event) => event.kind === incoming.kind && event.message === incoming.message && event.source === incoming.source,
  );
  if (duplicate) {
    return existing.map((event) => event.id === duplicate.id ? { ...event, count: event.count + 1, timestamp: incoming.timestamp } : event);
  }
  return [...existing, incoming].slice(-MAX_CONSOLE_EVENTS);
}
