import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveReport,
  getReport,
  listReports,
  deleteReport,
  clearAllReports,
  generateDraftId,
} from './storage';
import { BugReport } from './types';

describe('storage module', () => {
  beforeEach(async () => {
    await clearAllReports();
  });

  const mockReport: BugReport = {
    id: 'test-draft-1',
    status: 'draft',
    title: 'Test Bug',
    severity: 'High',
    reproductionSteps: 'Step 1',
    expectedBehavior: 'Expected',
    actualBehavior: 'Actual',
    additionalNotes: 'None',
    metadata: {
      url: 'https://example.com',
      title: 'Example',
      capturedAt: '2026-10-09T22:00:00.000Z',
    },
    screenshotDataUrl: 'data:image/png;base64,mock',
    createdAt: '2026-10-09T22:00:00.000Z',
    updatedAt: '2026-10-09T22:00:00.000Z',
  };

  it('generates non-empty unique draft IDs', () => {
    const id1 = generateDraftId();
    const id2 = generateDraftId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('saves and retrieves a report by ID', async () => {
    await saveReport(mockReport);
    const retrieved = await getReport('test-draft-1');
    expect(retrieved).toEqual(mockReport);
  });

  it('returns null for nonexistent ID', async () => {
    const result = await getReport('nonexistent-id');
    expect(result).toBeNull();
  });

  it('lists saved reports', async () => {
    await saveReport(mockReport);
    const list = await listReports();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test-draft-1');
  });

  it('deletes report by ID', async () => {
    await saveReport(mockReport);
    await deleteReport('test-draft-1');
    const result = await getReport('test-draft-1');
    expect(result).toBeNull();
  });
});
