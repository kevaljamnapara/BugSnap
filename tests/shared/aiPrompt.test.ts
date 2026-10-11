import { describe, expect, it } from 'vitest';
import { generateAiDebugPrompt } from '../../src/shared/aiPrompt';
import { BugReport } from '../../src/shared/types';

describe('generateAiDebugPrompt', () => {
  it('uses local reviewed evidence and asks for bounded analysis while excluding filtered items', () => {
    const prompt = generateAiDebugPrompt({
      id: '1',
      status: 'draft',
      title: 'Broken',
      severity: 'High',
      reproductionSteps: 'Open',
      expectedBehavior: '',
      actualBehavior: 'Fails',
      additionalNotes: '',
      metadata: { url: 'https://test.local', title: 'Test App', capturedAt: '' },
      createdAt: '',
      updatedAt: '',
      debugSession: {
        tabId: 1,
        status: 'stopped',
        startedAt: '',
        excludedEvidenceIds: ['hide'],
        consoleEvents: [{ id: 'hide', kind: 'runtime-error', message: 'secret-token-leak', timestamp: '', count: 1 }],
      },
    });
    expect(prompt).toContain('Distinguish facts from hypotheses');
    expect(prompt).not.toContain('secret-token-leak');
  });

  it('includes active console errors and network events from debugSession', () => {
    const report: BugReport = {
      id: '2',
      status: 'draft',
      title: 'Checkout error',
      severity: 'Critical',
      reproductionSteps: 'Click pay',
      expectedBehavior: 'Success',
      actualBehavior: '500 error',
      additionalNotes: '',
      metadata: { url: 'https://example.com/checkout', title: 'Checkout', capturedAt: '2026-10-11T12:00:00Z' },
      createdAt: '',
      updatedAt: '',
      debugSession: {
        tabId: 10,
        status: 'stopped',
        startedAt: '2026-10-11T12:00:00Z',
        consoleEvents: [
          {
            id: 'err-1',
            kind: 'runtime-error',
            message: 'Uncaught TypeError: window.stripe is undefined',
            stack: 'TypeError at checkout.js:42:10',
            timestamp: '2026-10-11T12:00:01Z',
            count: 2,
          },
        ],
        networkEvents: [
          {
            id: 'net-1',
            url: 'https://example.com/api/v1/checkout/charge',
            initiatorType: 'fetch',
            duration: 450,
            timestamp: '2026-10-11T12:00:02Z',
            outcome: 'observed-resource',
            count: 1,
          },
        ],
      },
    };

    const prompt = generateAiDebugPrompt(report);
    expect(prompt).toContain('## Console Errors & Warnings');
    expect(prompt).toContain('[runtime-error] Uncaught TypeError: window.stripe is undefined');
    expect(prompt).toContain('Stack: TypeError at checkout.js:42:10');
    expect(prompt).toContain('## Observable Network Activity');
    expect(prompt).toContain('- [fetch] https://example.com/api/v1/checkout/charge (450ms)');
  });

  it('includes console errors and network timings fallback from metadata.diagnostics when debugSession is absent', () => {
    const report: BugReport = {
      id: '3',
      status: 'draft',
      title: 'Static page crash',
      severity: 'High',
      reproductionSteps: 'Open page',
      expectedBehavior: 'Loads',
      actualBehavior: 'Blank white screen',
      additionalNotes: '',
      metadata: {
        url: 'https://example.com/dashboard',
        title: 'Dashboard',
        capturedAt: '2026-10-11T12:00:00Z',
        diagnostics: {
          jsErrors: ['ReferenceError: React is not defined'],
          resourceTimings: [
            {
              name: 'https://example.com/assets/app.js',
              initiatorType: 'script',
              duration: 85,
              transferSize: 10240,
            },
          ],
        },
      },
      createdAt: '',
      updatedAt: '',
    };

    const prompt = generateAiDebugPrompt(report);
    expect(prompt).toContain('## Console Errors & Warnings');
    expect(prompt).toContain('- [error] ReferenceError: React is not defined');
    expect(prompt).toContain('## Observable Network Activity');
    expect(prompt).toContain('- [script] https://example.com/assets/app.js (85ms)');
  });
});

