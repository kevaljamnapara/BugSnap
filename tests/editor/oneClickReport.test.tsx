import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  generateCompleteBugReport,
  deriveReportSummary,
  copyCompleteBugReport,
} from '../../src/editor/exportUtils';
import { Editor } from '../../src/editor/Editor';
import * as storage from '../../src/shared/storage';
import { BugReport } from '../../src/shared/types';

describe('One-Click Bug Report & Evidence Capture Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clearAllReports();
    window.history.pushState({}, '', '/editor.html');
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  const fullEvidenceReport: BugReport = {
    id: 'report-full-evidence-1',
    status: 'draft',
    title: '', // Intentionally empty to test auto-derivation
    severity: 'High',
    reproductionSteps: '[Observed navigation] https://example.com/checkout?token=supersecret123\nClicked place order',
    expectedBehavior: 'Order places smoothly',
    actualBehavior: 'TypeError: Cannot read properties of undefined (reading "orderId")',
    additionalNotes: 'Occurs on macOS Safari and Chrome',
    metadata: {
      url: 'https://example.com/checkout?token=secret123&session=active',
      title: 'Checkout — ACME Store',
      capturedAt: '2026-10-10T10:00:00.000Z',
      browser: 'Chrome 129',
      platform: 'MacIntel',
      viewport: { width: 1440, height: 900 },
      diagnostics: {
        jsErrors: ['Uncaught TypeError: Cannot read properties of undefined'],
        resourceTimings: [
          {
            name: 'https://example.com/api/pay?auth=bearer999',
            initiatorType: 'fetch',
            duration: 250,
          },
        ],
      },
    },
    debugSession: {
      tabId: 101,
      startedAt: '2026-10-10T09:59:00.000Z',
      status: 'stopped',
      stoppedAt: '2026-10-10T10:00:00.000Z',
      consoleEvents: [
        {
          id: 'console-1',
          kind: 'runtime-error',
          message: 'Cannot read properties of undefined (reading "orderId")',
          source: 'https://example.com/assets/checkout.js:42:15',
          stack: 'TypeError: Cannot read properties of undefined\n    at checkout.js:42:15',
          timestamp: '10:00:00.100',
          count: 1,
        },
      ],
      networkEvents: [
        {
          id: 'network-1',
          url: 'https://example.com/api/pay?token=sensitiveToken',
          initiatorType: 'fetch',
          duration: 320,
          outcome: 'observed-resource' as const,
          count: 1,
          timestamp: '10:00:00.200',
        },
      ],
    },
    annotations: [
      {
        id: 'ann-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        color: '#ff3b30',
        strokeWidth: 3,
      },
    ],
    screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    annotatedScreenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  };

  // 1. Report generation with complete evidence
  it('1. generates a complete, self-contained report with all required sections when full evidence is present', () => {
    const summary = deriveReportSummary(fullEvidenceReport);
    const result = generateCompleteBugReport(fullEvidenceReport);

    expect(result.summary).toBe(summary);
    expect(result.summary).toContain('Runtime error: Cannot read properties of undefined');
    expect(result.markdown).toContain('# BugSnap Bug Report');
    expect(result.markdown).toContain('## Summary');
    expect(result.markdown).toContain('## Page Context');
    expect(result.markdown).toContain('## Console Diagnostics');
    expect(result.markdown).toContain('## Network Diagnostics');
    expect(result.markdown).toContain('## Reproduction Context');
    expect(result.markdown).toContain('## Environment Diagnostics');
    expect(result.markdown).toContain('## Debugging Timeline');
    expect(result.markdown).toContain('## Screenshot');
    expect(result.markdown).toContain('## Privacy and Evidence Limitations');

    // HTML contains matching structure
    expect(result.html).toContain('class="bugsnap-report"');
    expect(result.html).toContain('BugSnap Bug Report');
    expect(result.html).toContain('Console Diagnostics');
    expect(result.html).toContain('Network Diagnostics');
  });

  // 2. Report generation when some diagnostic sources are unavailable
  it('2. generates a truthful report clearly marking unavailable diagnostic sources without fabricating data', () => {
    const minimalReport: BugReport = {
      id: 'report-minimal-2',
      status: 'draft',
      title: '',
      severity: 'Low',
      reproductionSteps: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalNotes: '',
      metadata: {
        url: '',
        title: '',
        capturedAt: '2026-10-10T10:00:00.000Z',
      },
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-10T10:00:00.000Z',
    };

    const result = generateCompleteBugReport(minimalReport);

    expect(result.summary).toBe('Captured browser issue');
    expect(result.markdown).toContain('Console error capture was not active during this capture');
    expect(result.markdown).toContain('Network diagnostic capture was not active for this capture');
    expect(result.markdown).toContain('Debugging timeline not available');
    expect(result.markdown).toContain('Page URL**: [Unavailable](Unavailable)');
    expect(result.markdown).toContain('No reproduction steps recorded');
    expect(result.markdown).toContain('No visual annotations applied');
  });

  // 3. Sanitization of sensitive URLs and diagnostic values
  it('3. sanitizes sensitive URL query parameters (tokens, keys, secrets) in page URL, network requests, and reproduction steps', () => {
    const result = generateCompleteBugReport(fullEvidenceReport);

    // Page URL token must be redacted
    expect(result.markdown).not.toContain('secret123');
    expect(result.markdown).toContain('token=[redacted]');

    // Network URLs must be redacted
    expect(result.markdown).not.toContain('sensitiveToken');
    expect(result.markdown).toContain('token=[redacted]');

    // Reproduction navigation step URL must be redacted
    expect(result.markdown).not.toContain('supersecret123');
    expect(result.markdown).toContain('[Observed navigation]');
  });

  // 4. Inclusion of console errors and network failures when captured
  it('4. includes console errors with source locations and network resource timings', () => {
    const result = generateCompleteBugReport(fullEvidenceReport);

    expect(result.markdown).toContain('[runtime-error]');
    expect(result.markdown).toContain('Cannot read properties of undefined');
    expect(result.markdown).toContain('checkout.js:42:15');
    expect(result.markdown).toContain('[fetch]');
    expect(result.markdown).toContain('320ms');
  });

  // 5. Screenshot and annotation preservation
  it('5. preserves visual evidence and accurately indicates whether visual annotations are included', () => {
    const resultWithAnnotations = generateCompleteBugReport(fullEvidenceReport);
    expect(resultWithAnnotations.markdown).toContain('1 visual annotation(s) included');

    const reportWithoutAnnotations: BugReport = {
      ...fullEvidenceReport,
      annotations: [],
    };
    const resultWithout = generateCompleteBugReport(reportWithoutAnnotations);
    expect(resultWithout.markdown).toContain('No visual annotations applied');
  });

  // 6. Clipboard copying of combined image and text where supported
  it('6. writes combined multi-MIME ClipboardItem (text/plain, text/html, image/png) when supported by the browser', async () => {
    let capturedClipboardItem: Record<string, Blob> | null = null;
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class MockClipboardItem {
      constructor(public items: Record<string, Blob>) {
        capturedClipboardItem = items;
      }
    };

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        write: writeMock,
        writeText: vi.fn(),
      },
    });

    const result = await copyCompleteBugReport(fullEvidenceReport);

    expect(result.success).toBe(true);
    expect(result.combined).toBe(true);
    expect(result.message).toBe('Report, AI prompt, and screenshot copied.');
    expect(writeMock).toHaveBeenCalled();
    expect(capturedClipboardItem).not.toBeNull();
    expect(capturedClipboardItem).toHaveProperty('text/plain');
    expect(capturedClipboardItem).toHaveProperty('text/html');
    expect(capturedClipboardItem).toHaveProperty('image/png');
  });

  // 7. Fallback behavior when combined clipboard writes fail
  it('7. falls back to copying text and downloading the screenshot blob when combined clipboard copy is rejected', async () => {
    let writeCallCount = 0;
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class MockClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    };

    // First write call (combined) rejects; second write call (text-only) succeeds
    const writeMock = vi.fn().mockImplementation((_items: unknown[]) => {
      writeCallCount++;
      if (writeCallCount === 1) {
        return Promise.reject(new Error('Browser restriction: Multi-MIME image copy disallowed'));
      }
      return Promise.resolve();
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    Object.assign(navigator, {
      clipboard: {
        write: writeMock,
        writeText: vi.fn(),
      },
    });

    const result = await copyCompleteBugReport(fullEvidenceReport);

    expect(result.success).toBe(true);
    expect(result.combined).toBe(false);
    expect(result.fallbackScreenshotSaved).toBe(true);
    expect(result.message).toBe('Report and AI prompt copied; screenshot saved separately.');
    expect(clickSpy).toHaveBeenCalled();
  });

  // 8. Honest success/failure notifications
  it('8. provides honest, transparent error message when all clipboard write methods fail', async () => {
    delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied by system')),
      },
    });

    const result = await copyCompleteBugReport(fullEvidenceReport);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied by system');
  });

  // 9. No automatic external transmission of report data
  it('9. strictly enforces offline invariants with zero external HTTP or fetch network transmissions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const xhrSpy = vi.spyOn(globalThis, 'XMLHttpRequest');

    const result = generateCompleteBugReport(fullEvidenceReport);
    await copyCompleteBugReport(fullEvidenceReport);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(result.markdown).toContain('BugSnap runs ₹0 locally with zero external network requests');
  });

  // 10. Removal of the required manual-form workflow without breaking existing evidence capture
  it('10. allows copying complete report immediately with empty manual fields and auto-derived summary in UI', async () => {
    const draftWithoutManualFields: BugReport = {
      ...fullEvidenceReport,
      title: '',
      sessionLabel: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalNotes: '',
    };

    await storage.saveReport(draftWithoutManualFields);
    window.history.pushState({}, '', `/editor.html?id=${draftWithoutManualFields.id}`);

    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
        write: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<Editor />);

    // Wait for the primary action button to appear
    await waitFor(() => {
      expect(screen.getByTestId('copy-complete-report-btn')).toBeInTheDocument();
    });

    // The redundant summary/evidence bar is completely removed from the rendered UI
    expect(screen.queryByTestId('evidence-summary-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('one-click-action-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chip-screenshot')).not.toBeInTheDocument();

    // Derived summary preview is automatically populated without manual user typing
    const summaryPreview = screen.getByTestId('derived-summary-preview');
    expect(summaryPreview).toHaveTextContent(/Cannot read properties of undefined/i);

    // User can click Copy Complete Bug Report with ZERO manual fields entered!
    const copyButton = screen.getByTestId('copy-complete-report-btn');
    fireEvent.click(copyButton);

    // Feedback appears confirming one-click completion
    await waitFor(() => {
      expect(screen.getByTestId('copy-complete-feedback')).toBeInTheDocument();
    });

    // Manual form elements are completely removed from the UI for the one-click workflow
    expect(screen.queryByTestId('editor-form-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-title')).not.toBeInTheDocument();
  });
});
