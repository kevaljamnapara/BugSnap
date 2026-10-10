import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveReport,
  getReport,
  listReports,
  deleteReport,
  clearAllReports,
  clearAllStorage,
  generateDraftId,
  getRetentionSettings,
  saveRetentionSettings,
  acquireEditLock,
  renewEditLock,
  releaseEditLock,
  getActiveLocks,
  isReportLocked,
  getEffectiveReportTimestamp,
  runRetentionCleanup,
} from '../../src/shared/storage';
import { BugReport, RetentionPeriod } from '../../src/shared/types';

describe('storage module — Phase 5 Retention & Report Management', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  const baseReport: BugReport = {
    id: 'report-base-1',
    status: 'saved',
    title: 'Base Report',
    severity: 'Medium',
    reproductionSteps: 'Step 1',
    expectedBehavior: 'Expected',
    actualBehavior: 'Actual',
    additionalNotes: '',
    metadata: {
      url: 'https://example.com/checkout',
      title: 'Checkout',
      capturedAt: '2026-10-01T12:00:00.000Z',
    },
    screenshotDataUrl: 'data:image/png;base64,mockPngEvidence',
    annotatedScreenshotDataUrl: 'data:image/png;base64,mockAnnotatedComposite',
    annotations: [
      {
        id: 'rect-1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        color: '#ef4444',
        strokeWidth: 4,
      },
    ],
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
  };

  describe('Report CRUD', () => {
    it('generates non-empty unique draft IDs', () => {
      const id1 = generateDraftId();
      const id2 = generateDraftId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('saves and retrieves a report by ID including annotations and composite screenshot', async () => {
      await saveReport(baseReport);
      const retrieved = await getReport('report-base-1');
      expect(retrieved).toEqual(baseReport);
      expect(retrieved?.annotations).toHaveLength(1);
      expect(retrieved?.annotatedScreenshotDataUrl).toBe('data:image/png;base64,mockAnnotatedComposite');
    });

    it('returns null for nonexistent ID', async () => {
      const result = await getReport('nonexistent-id');
      expect(result).toBeNull();
    });

    it('lists all saved reports and drafts', async () => {
      await saveReport(baseReport);
      await saveReport({
        ...baseReport,
        id: 'draft-2',
        status: 'draft',
        title: 'Draft Bug',
      });

      const list = await listReports();
      expect(list).toHaveLength(2);
      expect(list.some((r) => r.id === 'report-base-1')).toBe(true);
      expect(list.some((r) => r.id === 'draft-2')).toBe(true);
    });

    it('deletes report by ID and purges all associated evidence', async () => {
      await saveReport(baseReport);
      await deleteReport('report-base-1');
      const result = await getReport('report-base-1');
      expect(result).toBeNull();
    });

    it('clears all reports', async () => {
      await saveReport(baseReport);
      await clearAllReports();
      const list = await listReports();
      expect(list).toHaveLength(0);
    });
  });

  describe('Retention Settings', () => {
    it('defaults automatic retention cleanup to disabled with 30 days period', async () => {
      const settings = await getRetentionSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.retentionDays).toBe(30);
    });

    it('persists enabled state and approved retention period options (7, 30, 90)', async () => {
      await saveRetentionSettings({ enabled: true, retentionDays: 7 });
      let settings = await getRetentionSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.retentionDays).toBe(7);

      await saveRetentionSettings({ enabled: true, retentionDays: 90 });
      settings = await getRetentionSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.retentionDays).toBe(90);
    });

    it('rejects unapproved retention periods with an explicit error', async () => {
      await expect(
        saveRetentionSettings({ enabled: true, retentionDays: 15 as unknown as RetentionPeriod }),
      ).rejects.toThrow(/Invalid retention period/);
    });
  });

  describe('Active Edit Session Locks', () => {
    it('acquires and releases edit session lock for a report', async () => {
      const now = 100000;
      await acquireEditLock('rep-1', 'session-tab-1');

      let locked = await isReportLocked('rep-1', now);
      expect(locked).toBe(true);

      await releaseEditLock('session-tab-1');
      locked = await isReportLocked('rep-1', now);
      expect(locked).toBe(false);
    });

    it('renews heartbeat for an active session lock', async () => {
      await acquireEditLock('rep-1', 'session-tab-1');
      const initialLocks = await getActiveLocks();
      expect(initialLocks[0].lastHeartbeat).toBeGreaterThan(0);

      await renewEditLock('rep-1', 'session-tab-1');
      const updatedLocks = await getActiveLocks();
      expect(updatedLocks[0].sessionId).toBe('session-tab-1');
    });

    it('treats locks exceeding timeout window as expired stale sessions', async () => {
      const startTime = 100000;
      vi.spyOn(Date, 'now').mockReturnValue(startTime);
      await acquireEditLock('rep-1', 'session-stale');

      // 60 seconds later: still active (safeguards against Chrome 60s background timer throttling)
      let locked = await isReportLocked('rep-1', startTime + 60000);
      expect(locked).toBe(true);

      // 121 seconds later: expired stale session (timeout is 120s)
      locked = await isReportLocked('rep-1', startTime + 121000);
      expect(locked).toBe(false);
    });

    it('supports multiple concurrent editor tabs on the SAME report', async () => {
      const now = Date.now();
      await acquireEditLock('rep-same', 'tab-1');
      await acquireEditLock('rep-same', 'tab-2');

      expect(await isReportLocked('rep-same', now)).toBe(true);

      // Closing tab-1 still leaves rep-same protected because tab-2 is actively open
      await releaseEditLock('tab-1');
      expect(await isReportLocked('rep-same', now)).toBe(true);

      // Closing tab-2 finally releases rep-same
      await releaseEditLock('tab-2');
      expect(await isReportLocked('rep-same', now)).toBe(false);
    });

    it('supports multiple concurrent editor tabs across different reports', async () => {
      const now = Date.now();
      await acquireEditLock('rep-A', 'tab-1');
      await acquireEditLock('rep-B', 'tab-2');

      expect(await isReportLocked('rep-A', now)).toBe(true);
      expect(await isReportLocked('rep-B', now)).toBe(true);

      // Closing tab-1 unlocks rep-A while rep-B remains locked
      await releaseEditLock('tab-1');
      expect(await isReportLocked('rep-A', now)).toBe(false);
      expect(await isReportLocked('rep-B', now)).toBe(true);
    });

    it('purges associated edit locks when a report is deleted', async () => {
      await acquireEditLock('rep-to-delete', 'session-del-1');
      expect(await isReportLocked('rep-to-delete')).toBe(true);

      await deleteReport('rep-to-delete');
      expect(await isReportLocked('rep-to-delete')).toBe(false);
    });

    it('protects suspended editor tabs when chrome.tabs.query detects open editor tab', async () => {
      const now = 200000;
      // Lock is stale (expired in storage)
      vi.spyOn(Date, 'now').mockReturnValue(now - 150000);
      await acquireEditLock('rep-suspended', 'session-suspended');

      // In-memory/storage alone would be expired
      const defaultLocked = await isReportLocked('rep-suspended', now);
      expect(defaultLocked).toBe(false);

      // But Chrome has the editor tab open (e.g. background tab or suspended tab)
      const tabsQuerySpy = vi.spyOn(chrome.tabs, 'query').mockResolvedValue([
        { url: 'chrome-extension://mock-id/editor.html?id=rep-suspended' } as chrome.tabs.Tab,
      ]);

      const isProtected = await isReportLocked('rep-suspended', now);
      expect(isProtected).toBe(true);

      tabsQuerySpy.mockRestore();
    });
  });

  describe('Timestamp Policy & Effective Timestamp', () => {
    it('prefers updatedAt over createdAt and capturedAt', () => {
      const report: BugReport = {
        ...baseReport,
        updatedAt: '2026-10-05T12:00:00.000Z',
        createdAt: '2026-10-01T12:00:00.000Z',
        metadata: { ...baseReport.metadata, capturedAt: '2026-09-30T12:00:00.000Z' },
      };
      const ts = getEffectiveReportTimestamp(report);
      expect(ts).toBe(new Date('2026-10-05T12:00:00.000Z').getTime());
    });

    it('falls back to createdAt when updatedAt is missing or invalid', () => {
      const report: BugReport = {
        ...baseReport,
        updatedAt: '',
        createdAt: '2026-10-02T12:00:00.000Z',
      };
      const ts = getEffectiveReportTimestamp(report);
      expect(ts).toBe(new Date('2026-10-02T12:00:00.000Z').getTime());
    });

    it('falls back to capturedAt when updatedAt and createdAt are missing', () => {
      const report: BugReport = {
        ...baseReport,
        updatedAt: '',
        createdAt: '',
        metadata: { ...baseReport.metadata, capturedAt: '2026-10-03T12:00:00.000Z' },
      };
      const ts = getEffectiveReportTimestamp(report);
      expect(ts).toBe(new Date('2026-10-03T12:00:00.000Z').getTime());
    });

    it('returns null if all candidate timestamps are unparseable', () => {
      const report: BugReport = {
        ...baseReport,
        updatedAt: 'invalid-date',
        createdAt: '',
        metadata: { ...baseReport.metadata, capturedAt: '' },
      };
      expect(getEffectiveReportTimestamp(report)).toBeNull();
    });
  });

  describe('Automatic Retention Cleanup Execution', () => {
    const fixedNow = new Date('2026-10-15T00:00:00.000Z').getTime();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    it('does not delete any reports when cleanup is disabled', async () => {
      // 20 days old report
      const oldDate = new Date(fixedNow - 20 * MS_PER_DAY).toISOString();
      await saveReport({
        ...baseReport,
        id: 'rep-old',
        updatedAt: oldDate,
      });

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: false, retentionDays: 7 },
      });

      expect(result.enabled).toBe(false);
      expect(result.cleanedCount).toBe(0);

      // Verify report was preserved
      const stored = await getReport('rep-old');
      expect(stored).not.toBeNull();
    });

    it('cleans reports older than 7 days when 7-day retention is enabled', async () => {
      // 8 days old (eligible)
      const old8d = new Date(fixedNow - 8 * MS_PER_DAY).toISOString();
      await saveReport({ ...baseReport, id: 'rep-8d', updatedAt: old8d });

      // 6 days old (fresh, kept)
      const fresh6d = new Date(fixedNow - 6 * MS_PER_DAY).toISOString();
      await saveReport({ ...baseReport, id: 'rep-6d', updatedAt: fresh6d });

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 7 },
      });

      expect(result.cleanedCount).toBe(1);
      expect(result.deletedIds).toEqual(['rep-8d']);

      expect(await getReport('rep-8d')).toBeNull();
      expect(await getReport('rep-6d')).not.toBeNull();
    });

    it('correctly evaluates boundary eligibility at exact millisecond cutoff', async () => {
      const retentionDays = 30;
      const cutoff = fixedNow - retentionDays * MS_PER_DAY;

      // 1 ms older than cutoff (eligible, deleted)
      const older = new Date(cutoff - 1).toISOString();
      await saveReport({ ...baseReport, id: 'rep-older', updatedAt: older });

      // Exactly at cutoff (not older, kept)
      const exact = new Date(cutoff).toISOString();
      await saveReport({ ...baseReport, id: 'rep-exact', updatedAt: exact });

      // 1 ms newer than cutoff (kept)
      const newer = new Date(cutoff + 1).toISOString();
      await saveReport({ ...baseReport, id: 'rep-newer', updatedAt: newer });

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 30 },
      });

      expect(result.cleanedCount).toBe(1);
      expect(result.deletedIds).toEqual(['rep-older']);

      expect(await getReport('rep-older')).toBeNull();
      expect(await getReport('rep-exact')).not.toBeNull();
      expect(await getReport('rep-newer')).not.toBeNull();
    });

    it('applies retention policy consistently to both saved reports and abandoned drafts', async () => {
      const oldDate = new Date(fixedNow - 10 * MS_PER_DAY).toISOString();

      await saveReport({
        ...baseReport,
        id: 'saved-old',
        status: 'saved',
        updatedAt: oldDate,
      });

      await saveReport({
        ...baseReport,
        id: 'draft-old',
        status: 'draft',
        updatedAt: oldDate,
      });

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 7 },
      });

      expect(result.cleanedCount).toBe(2);
      expect(result.deletedIds).toContain('saved-old');
      expect(result.deletedIds).toContain('draft-old');

      expect(await getReport('saved-old')).toBeNull();
      expect(await getReport('draft-old')).toBeNull();
    });

    it('strictly protects reports actively being edited even if older than retention threshold', async () => {
      const oldDate = new Date(fixedNow - 40 * MS_PER_DAY).toISOString();

      // Older report, actively locked by an editor tab
      await saveReport({ ...baseReport, id: 'rep-locked-old', updatedAt: oldDate });
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
      await acquireEditLock('rep-locked-old', 'editor-tab-active');

      // Older report, not locked
      await saveReport({ ...baseReport, id: 'rep-unlocked-old', updatedAt: oldDate });

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 30 },
      });

      // Locked report is protected
      expect(result.skippedLockedCount).toBe(1);
      expect(result.cleanedCount).toBe(1);
      expect(result.deletedIds).toEqual(['rep-unlocked-old']);

      expect(await getReport('rep-locked-old')).not.toBeNull();
      expect(await getReport('rep-unlocked-old')).toBeNull();
    });

    it('cleans reports if their edit session lock has expired and become stale', async () => {
      const oldDate = new Date(fixedNow - 40 * MS_PER_DAY).toISOString();
      await saveReport({ ...baseReport, id: 'rep-stale-lock', updatedAt: oldDate });

      // Lock created 3 minutes before cleanup (timeout is 120s / 2 minutes)
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow - 180000);
      await acquireEditLock('rep-stale-lock', 'editor-tab-crashed');

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 30 },
      });

      // Stale lock ignored -> report deleted
      expect(result.cleanedCount).toBe(1);
      expect(result.deletedIds).toEqual(['rep-stale-lock']);
      expect(await getReport('rep-stale-lock')).toBeNull();
    });

    it('safely handles storage errors during cleanup and reports them visibly', async () => {
      const oldDate = new Date(fixedNow - 10 * MS_PER_DAY).toISOString();
      await saveReport({ ...baseReport, id: 'rep-fail-delete', updatedAt: oldDate });

      const mockFailingDelete = vi.fn().mockRejectedValueOnce(
        new Error('Disk I/O Error during deletion'),
      );

      const result = await runRetentionCleanup({
        now: fixedNow,
        overrideSettings: { enabled: true, retentionDays: 7 },
        deleteFn: mockFailingDelete,
      });

      // Does not claim false success
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Disk I/O Error');
    });
  });
});
