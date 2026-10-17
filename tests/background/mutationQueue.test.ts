import { describe, it, expect } from 'vitest';
import { enqueueReportMutation } from '../../src/background/index';
import { saveReport, getReport, generateDraftId } from '../../src/shared/storage';
import { BugReport } from '../../src/shared/types';
import { appendConsoleEventToSession, normalizeConsoleEvent } from '../../src/shared/consoleSession';

describe('Background Mutation Queue (Race Condition Fix for S4)', () => {
  it('serializes 200 concurrent events and persists every single one without loss', async () => {
    const reportId = generateDraftId();
    const initialReport: BugReport = {
      id: reportId,
      status: 'draft',
      title: 'Concurrency Fix Test',
      severity: 'Medium',
      reproductionSteps: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalNotes: '',
      metadata: { url: 'https://example.com', title: 'Test', capturedAt: new Date().toISOString() },
      debugSession: {
        tabId: 10,
        status: 'active',
        startedAt: new Date().toISOString(),
        consoleEvents: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveReport(initialReport);

    // Launch 200 concurrent mutations simultaneously
    const promises = Array.from({ length: 200 }, (_, i) => {
      return enqueueReportMutation(reportId, (report) => {
        if (!report.debugSession) return;
        const event = normalizeConsoleEvent('runtime-error', {
          message: `Concurrent error ${i}`,
          timestamp: `2026-10-17T00:00:${String(i).padStart(4, '0')}.000Z`,
        });
        return {
          ...report,
          debugSession: appendConsoleEventToSession(report.debugSession, event),
          updatedAt: new Date().toISOString(),
        };
      });
    });

    await Promise.all(promises);

    const finalReport = await getReport(reportId);
    expect(finalReport).toBeDefined();
    expect(finalReport?.debugSession?.consoleEvents).toHaveLength(200);

    // Verify ordering is preserved
    const messages = finalReport!.debugSession!.consoleEvents.map((e) => e.message);
    expect(messages[0]).toBe('Concurrent error 0');
    expect(messages[199]).toBe('Concurrent error 199');
  });
});
