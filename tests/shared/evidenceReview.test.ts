import { describe, expect, it } from 'vitest';
import { reviewedSession } from '../../src/shared/evidenceReview';

describe('reviewedSession', () => it('omits user-excluded evidence from the reviewed view', () => {
  const reviewed = reviewedSession({ tabId: 1, status: 'stopped', startedAt: '', excludedEvidenceIds: ['secret'], consoleEvents: [{ id: 'secret', kind: 'runtime-error', message: 'x', timestamp: '', count: 1 }, { id: 'keep', kind: 'runtime-error', message: 'ok', timestamp: '', count: 1 }] });
  expect(reviewed.consoleEvents.map((event) => event.id)).toEqual(['keep']);
}));
