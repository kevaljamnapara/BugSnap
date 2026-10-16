import { DebugSession } from './types';

export function reviewedSession(session: DebugSession): DebugSession {
  const excluded = new Set(session.excludedEvidenceIds || []);
  return {
    ...session,
    consoleEvents: session.consoleEvents.filter((event) => !excluded.has(event.id)),
    networkEvents: (session.networkEvents || []).filter((event) => !excluded.has(event.id)),
  };
}
