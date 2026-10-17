import { describe, it, expect } from 'vitest';
import { appendConsoleEvent, appendNetworkEvent, normalizeConsoleEvent } from '../../src/shared/consoleSession';
import { sanitizeAndTruncateText } from '../../src/shared/evidenceSanitizer';
import { generateCompleteBugReport, generateMarkdownReport } from '../../src/editor/exportUtils';
import { generateAiDebugPrompt } from '../../src/shared/aiPrompt';
import { saveReport, getReport, generateDraftId } from '../../src/shared/storage';
import { enqueueReportMutation } from '../../src/background/index';
import { appendConsoleEventToSession } from '../../src/shared/consoleSession';
import { BugReport, ConsoleEvidenceEvent, NetworkEvidenceEvent } from '../../src/shared/types';

describe('Phase 1 Systematic Debugging: Verified Resolutions for S2–S7', () => {
  // S2: Prove split caps prevent successful resource requests from evicting critical errors
  it('S2: verifies separate streams ensure successful asset requests never evict error calls', () => {
    let networkEvents: NetworkEvidenceEvent[] = [
      {
        id: 'error-call',
        url: 'https://api.example.com/critical-error',
        method: 'POST',
        status: 500,
        statusText: 'Internal Server Error',
        initiatorType: 'fetch',
        duration: 100,
        timestamp: '2026-10-17T00:00:00.000Z',
        outcome: 'failure',
        count: 1,
      },
    ];

    // Append 50 subsequent successful asset requests
    for (let i = 0; i < 50; i++) {
      networkEvents = appendNetworkEvent(networkEvents, {
        id: `asset-${i}`,
        url: `https://cdn.example.com/image-${i}.png`,
        method: 'GET',
        status: 200,
        statusText: 'OK',
        initiatorType: 'img',
        duration: 10,
        timestamp: `2026-10-17T00:00:0${i}.000Z`,
        outcome: 'observed-resource',
        count: 1,
      });
    }

    // Critical error call must NOT be evicted by the 50 images!
    const foundError = networkEvents.find((e) => e.id === 'error-call');
    expect(foundError).toBeDefined();
    expect(foundError?.status).toBe(500);
    expect(networkEvents.length).toBe(51);
  });

  // S3: Prove deduplication separates distinct HTTP outcomes and preserves distinct stacks
  it('S3: verifies deduplication keeps 200 and 500 separate and preserves distinct stacks', () => {
    const successCall: NetworkEvidenceEvent = {
      id: 'call-1',
      url: 'https://api.example.com/items',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      initiatorType: 'fetch',
      duration: 120,
      timestamp: '2026-10-17T00:00:01.000Z',
      outcome: 'success',
      count: 1,
    };

    const failedCall: NetworkEvidenceEvent = {
      id: 'call-2',
      url: 'https://api.example.com/items',
      method: 'GET',
      status: 500,
      statusText: 'Internal Server Error',
      initiatorType: 'fetch',
      duration: 50,
      timestamp: '2026-10-17T00:00:02.000Z',
      outcome: 'failure',
      count: 1,
    };

    // Distinct outcomes must NOT be merged into one row
    const result = appendNetworkEvent([successCall], failedCall);
    expect(result.length).toBe(2);
    expect(result[0].status).toBe(200);
    expect(result[1].status).toBe(500);

    // Console distinct call sites/stacks must NOT be dropped
    const console1 = normalizeConsoleEvent('runtime-error', {
      message: 'Failed to execute script',
      stack: 'Error: line 10 at foo.js:10:5',
      source: 'foo.js',
      timestamp: '2026-10-17T00:00:01.000Z',
    });
    const console2: ConsoleEvidenceEvent = {
      ...console1,
      id: 'console-2',
      stack: 'Error: line 99 at bar.js:99:1', // completely different call site/stack
      timestamp: '2026-10-17T00:00:05.000Z',
    };

    const mergedConsole = appendConsoleEvent([console1], console2);
    expect(mergedConsole.length).toBe(2);
    expect(mergedConsole[0].stack).toBe('Error: line 10 at foo.js:10:5');
    expect(mergedConsole[1].stack).toBe('Error: line 99 at bar.js:99:1');
  });

  // S4: Prove concurrent background writes are serialized without event loss
  it('S4: verifies serialized background mutations prevent event loss in bursts', async () => {
    const draftId = generateDraftId();
    const initialReport: BugReport = {
      id: draftId,
      status: 'draft',
      title: 'Concurrency Resolution Test',
      severity: 'Medium',
      reproductionSteps: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalNotes: '',
      metadata: { url: 'https://example.com', title: 'Example', capturedAt: new Date().toISOString() },
      debugSession: {
        tabId: 1,
        status: 'active',
        startedAt: new Date().toISOString(),
        consoleEvents: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveReport(initialReport);

    // Concurrently enqueue 20 mutations
    const promises = Array.from({ length: 20 }, (_, i) => {
      return enqueueReportMutation(draftId, (report) => {
        if (!report.debugSession) return;
        const event = normalizeConsoleEvent('runtime-error', {
          message: `Error number ${i}`,
          timestamp: new Date().toISOString(),
        });
        return {
          ...report,
          debugSession: appendConsoleEventToSession(report.debugSession, event),
          updatedAt: new Date().toISOString(),
        };
      });
    });

    await Promise.all(promises);

    const finalReport = await getReport(draftId);
    const persistedCount = finalReport?.debugSession?.consoleEvents.length ?? 0;
    // Exactly all 20 events must be persisted without race loss
    expect(persistedCount).toBe(20);
  });

  // S5: Prove truncation adds explicit marker [truncated N chars]
  it('S5: verifies truncation appends explicit [truncated N chars] marker', () => {
    const longText = 'A'.repeat(5000);
    const truncated = sanitizeAndTruncateText(longText, 2000);
    expect(truncated.text).toContain('[truncated 3000 chars]');
    expect(truncated.truncated).toBe(true);

    const longMessage = 'B'.repeat(5000);
    const event = normalizeConsoleEvent('runtime-error', { message: longMessage });
    expect(event.message).toContain('[truncated 1000 chars]');
    expect(event.truncated).toBe(true);
  });

  // S6: Prove unified formatter ensures complete report, markdown, and AI prompt parity
  it('S6: verifies generateCompleteBugReport, generateMarkdownReport, and generateAiDebugPrompt agree on evidence', () => {
    const report: BugReport = {
      id: 'test-report',
      status: 'saved',
      title: 'Discrepancy test',
      severity: 'High',
      reproductionSteps: 'Step 1',
      expectedBehavior: 'Ok',
      actualBehavior: 'Fail',
      additionalNotes: '',
      metadata: {
        url: 'https://example.com',
        title: 'Example',
        capturedAt: '2026-10-17T00:00:00.000Z',
      },
      debugSession: {
        tabId: 1,
        status: 'active',
        startedAt: '2026-10-17T00:00:00.000Z',
        consoleEvents: [
          {
            id: 'c1',
            kind: 'runtime-error',
            message: 'Uncaught TypeError: test',
            stack: 'Error: line 1\n'.repeat(50),
            timestamp: '2026-10-17T00:00:01.000Z',
            count: 1,
          },
        ],
        networkEvents: [
          {
            id: 'n1',
            url: 'https://example.com/api/test',
            method: 'GET',
            status: 500,
            statusText: 'Internal Error',
            initiatorType: 'fetch',
            duration: 120,
            timestamp: '2026-10-17T00:00:02.000Z',
            outcome: 'failure',
            count: 1,
          },
        ],
      },
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    };

    const complete = generateCompleteBugReport(report);
    const markdown = generateMarkdownReport(report, 'stem');
    const aiPrompt = generateAiDebugPrompt(report);

    // All three must contain the full error message
    expect(complete.markdown).toContain('Uncaught TypeError: test');
    expect(markdown).toContain('Uncaught TypeError: test');
    expect(aiPrompt).toContain('Uncaught TypeError: test');

    // All three must contain the failed network call and status 500
    expect(complete.markdown).toContain('https://example.com/api/test');
    expect(markdown).toContain('https://example.com/api/test');
    expect(aiPrompt).toContain('https://example.com/api/test');
    expect(complete.markdown).toContain('500');
    expect(markdown).toContain('500');
    expect(aiPrompt).toContain('500');
  });

  // S7: Prove dishonest strings and ₹0 internal jokes are removed
  it('S7: verifies dishonest claims and internal jokes are absent from output', () => {
    const report: BugReport = {
      id: 'test-dishonest',
      status: 'saved',
      title: 'Dishonest strings test',
      severity: 'Low',
      reproductionSteps: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalNotes: '',
      metadata: { url: 'https://example.com', title: 'Example', capturedAt: '2026-10-17T00:00:00.000Z' },
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    };

    const complete = generateCompleteBugReport(report);
    const aiPrompt = generateAiDebugPrompt(report);

    // False claim when no hooks installed must not appear
    expect(aiPrompt).not.toContain('No network failures or relevant requests were observed in this session.');

    // Inaccurate claims about intrusive permissions and internal ₹0 jokes must not appear
    expect(complete.markdown).not.toContain('require intrusive host permissions');
    expect(complete.markdown).not.toContain('₹0');
    expect(aiPrompt).not.toContain('₹0');
  });
});
