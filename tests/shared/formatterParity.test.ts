import { describe, it, expect } from 'vitest';
import { generateCompleteBugReport, generateMarkdownReport } from '../../src/editor/exportUtils';
import { generateAiDebugPrompt } from '../../src/shared/aiPrompt';
import { BugReport } from '../../src/shared/types';
import { normalizeConsoleEvent, normalizeNetworkEvent } from '../../src/shared/consoleSession';

describe('Formatter Parity, Honest States, and Legacy Report Rendering', () => {
  const fixtureReport: BugReport = {
    id: 'parity-fixture-1',
    status: 'saved',
    title: 'Parity Test Fixture',
    severity: 'High',
    reproductionSteps: '1. Click submit\n2. Observe error',
    expectedBehavior: 'Successful submission',
    actualBehavior: 'Network 500 and console error',
    additionalNotes: 'Test notes',
    metadata: {
      url: 'https://example.com/checkout',
      title: 'Checkout Page',
      capturedAt: '2026-10-17T12:00:00.000Z',
      browser: 'Chrome 130',
      platform: 'macOS',
      viewport: { width: 1280, height: 800 },
    },
    debugSession: {
      tabId: 10,
      status: 'stopped',
      startedAt: '2026-10-17T12:00:00.000Z',
      stoppedAt: '2026-10-17T12:00:10.000Z',
      consoleEvents: [
        normalizeConsoleEvent('console-error', {
          message: 'Error: Failed to process payment token',
          stack: 'Error: at checkout.js:100:12',
          source: 'checkout.js',
          line: 100,
          column: 12,
          timestamp: '2026-10-17T12:00:02.000Z',
        }),
        normalizeConsoleEvent('console-warn', {
          message: 'Warning: Deprecated payment API in use',
          timestamp: '2026-10-17T12:00:03.000Z',
        }),
      ],
      networkEvents: [
        normalizeNetworkEvent({
          url: 'https://api.example.com/v1/charge',
          method: 'POST',
          status: 500,
          statusText: 'Internal Server Error',
          duration: 320,
          outcome: 'failure',
          responseBodySnippet: '{"code":"PAYMENT_GATEWAY_DOWN","retryable":false}',
          timestamp: '2026-10-17T12:00:04.000Z',
        }),
        normalizeNetworkEvent({
          url: 'https://cdn.example.com/logo.png',
          method: 'GET',
          status: 200,
          duration: 45,
          outcome: 'success',
          initiatorType: 'img',
          timestamp: '2026-10-17T12:00:01.000Z',
        }),
      ],
      droppedConsoleCount: 5,
      droppedFailedNetworkCount: 2,
      droppedOtherNetworkCount: 15,
    },
    createdAt: '2026-10-17T12:00:00.000Z',
    updatedAt: '2026-10-17T12:00:10.000Z',
  };

  it('Formatter PARITY: Copy Report and Copy AI Prompt contain the exact same errors, URLs, and counts', () => {
    const complete = generateCompleteBugReport(fixtureReport);
    const markdown = generateMarkdownReport(fixtureReport, 'stem');
    const aiPrompt = generateAiDebugPrompt(fixtureReport);

    // Both must contain the console error and warning messages
    expect(complete.markdown).toContain('Failed to process payment token');
    expect(markdown).toContain('Failed to process payment token');
    expect(aiPrompt).toContain('Failed to process payment token');

    expect(complete.markdown).toContain('Deprecated payment API in use');
    expect(markdown).toContain('Deprecated payment API in use');
    expect(aiPrompt).toContain('Deprecated payment API in use');

    // Both must contain the failed network call URL, status, and body snippet
    expect(complete.markdown).toContain('https://api.example.com/v1/charge');
    expect(markdown).toContain('https://api.example.com/v1/charge');
    expect(aiPrompt).toContain('https://api.example.com/v1/charge');

    expect(complete.markdown).toContain('PAYMENT_GATEWAY_DOWN');
    expect(aiPrompt).toContain('PAYMENT_GATEWAY_DOWN');

    // Both must contain the successful network call
    expect(complete.markdown).toContain('https://cdn.example.com/logo.png');
    expect(markdown).toContain('https://cdn.example.com/logo.png');
    expect(aiPrompt).toContain('https://cdn.example.com/logo.png');

    // Both must contain exact dropped counter notices
    expect(complete.markdown).toContain('5 older console event(s) not shown');
    expect(markdown).toContain('5 older console event(s) not shown');
    expect(aiPrompt).toContain('5 older console event(s) not shown');

    expect(complete.markdown).toContain('2 older failed network call(s) not shown');
    expect(markdown).toContain('2 older failed network call(s) not shown');
    expect(aiPrompt).toContain('2 older failed network call(s) not shown');

    expect(complete.markdown).toContain('15 older network call(s) not shown');
    expect(markdown).toContain('15 older network call(s) not shown');
    expect(aiPrompt).toContain('15 older network call(s) not shown');

    // Neither contains dishonest internal strings
    expect(complete.markdown).not.toContain('₹0');
    expect(markdown).not.toContain('₹0');
    expect(aiPrompt).not.toContain('₹0');
  });

  describe('Honest State Rendering', () => {
    it('renders "Not active" state honestly when no debug session was started', () => {
      const reportNoSession: BugReport = {
        ...fixtureReport,
        debugSession: undefined,
      };

      const complete = generateCompleteBugReport(reportNoSession);
      const aiPrompt = generateAiDebugPrompt(reportNoSession);

      expect(complete.markdown).toContain('Console error capture was not active during this capture.');
      expect(complete.markdown).toContain('Network diagnostic capture was not active for this capture.');
      expect(aiPrompt).toContain('Debug session was not active during this capture.');
      expect(aiPrompt).not.toContain('No network failures or relevant requests were observed');
    });

    it('renders "Active, none recorded" state honestly when session was active but 0 events occurred', () => {
      const reportEmptySession: BugReport = {
        ...fixtureReport,
        debugSession: {
          tabId: 10,
          status: 'stopped',
          startedAt: '2026-10-17T12:00:00.000Z',
          stoppedAt: '2026-10-17T12:00:10.000Z',
          consoleEvents: [],
          networkEvents: [],
          droppedConsoleCount: 0,
          droppedFailedNetworkCount: 0,
          droppedOtherNetworkCount: 0,
        },
      };

      const complete = generateCompleteBugReport(reportEmptySession);
      const aiPrompt = generateAiDebugPrompt(reportEmptySession);

      expect(complete.markdown).toContain('Debug session was active — 0 runtime errors or warnings were recorded.');
      expect(complete.markdown).toContain('Debug session was active — 0 failed network requests were recorded.');
      expect(aiPrompt).toContain('Debug session was active — 0 runtime errors or warnings recorded.');
      expect(aiPrompt).toContain('Debug session was active — 0 failed network requests recorded.');
    });

    it('renders navigation interruption status honestly when session was interrupted', () => {
      const reportNav: BugReport = {
        ...fixtureReport,
        debugSession: {
          ...fixtureReport.debugSession!,
          interruptedByNavigation: true,
        },
      };

      const complete = generateCompleteBugReport(reportNav);
      const aiPrompt = generateAiDebugPrompt(reportNav);

      expect(complete.markdown).toContain('Session was interrupted by page navigation/reload');
      expect(aiPrompt).toContain('Session was interrupted by page navigation/reload');
    });
  });

  describe('Legacy Report Compatibility', () => {
    it('loads and renders legacy-shaped report without error', () => {
      // Legacy report from earlier versions without dropped counters, without level, without outcome: failure
      const legacyReport: BugReport = {
        id: 'legacy-report-123',
        status: 'saved',
        title: 'Legacy Draft',
        severity: 'Medium',
        reproductionSteps: 'Step 1',
        expectedBehavior: 'Expected',
        actualBehavior: 'Actual',
        additionalNotes: '',
        metadata: {
          url: 'https://example.com/legacy',
          title: 'Legacy App',
          capturedAt: '2026-10-01T10:00:00.000Z',
        },
        debugSession: {
          tabId: 1,
          status: 'stopped',
          startedAt: '2026-10-01T10:00:00.000Z',
          consoleEvents: [
            {
              id: 'c-legacy',
              kind: 'runtime-error',
              message: 'Legacy error without level',
              timestamp: '2026-10-01T10:00:01.000Z',
              count: 1,
            },
          ],
          networkEvents: [
            {
              id: 'n-legacy',
              url: 'https://example.com/asset.js',
              initiatorType: 'script',
              duration: 25,
              outcome: 'observed-resource',
              timestamp: '2026-10-01T10:00:02.000Z',
              count: 1,
            },
          ],
        },
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };

      expect(() => generateCompleteBugReport(legacyReport)).not.toThrow();
      expect(() => generateMarkdownReport(legacyReport, 'stem-leg')).not.toThrow();
      expect(() => generateAiDebugPrompt(legacyReport)).not.toThrow();

      const complete = generateCompleteBugReport(legacyReport);
      expect(complete.markdown).toContain('Legacy error without level');
      expect(complete.markdown).toContain('https://example.com/asset.js');
    });
  });
});
