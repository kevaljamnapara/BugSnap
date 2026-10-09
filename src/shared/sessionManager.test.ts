import { describe, expect, it } from 'vitest';
import { duplicateSession, searchSessions } from './sessionManager';
const report = { id: 'a', status: 'saved' as const, title: 'Checkout error', sessionLabel: 'release', severity: 'Low' as const, reproductionSteps: '', expectedBehavior: '', actualBehavior: '', additionalNotes: '', metadata: { url: 'https://test', title: '', capturedAt: '' }, createdAt: '', updatedAt: '' };
describe('session manager', () => it('searches and duplicates local sessions safely', () => {
  expect(searchSessions([report], 'release')).toHaveLength(1);
  const copy = duplicateSession(report);
  expect(copy.id).not.toBe(report.id); expect(copy.status).toBe('draft'); expect(copy.title).toContain('(copy)');
}));
