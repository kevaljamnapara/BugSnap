import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateFilenameStem,
  sanitizeSlug,
  escapeMarkdownTableCell,
  generateMarkdownReport,
  dataUrlToBlob,
  exportReportPackage,
} from './exportUtils';
import { BugReport } from '../shared/types';

describe('exportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeSlug and generateFilenameStem', () => {
    it('sanitizes titles with special characters, spaces, and uppercase letters', () => {
      const slug = sanitizeSlug('Checkout Button: Misaligned on iOS 17 & Safari!');
      expect(slug).toBe('checkout-button-misaligned-on-io');
      expect(slug).not.toContain(':');
      expect(slug).not.toContain('&');
      expect(slug).not.toContain(' ');
    });

    it('falls back to default report prefix when title is empty', () => {
      const stem = generateFilenameStem('', '2026-10-09T22:30:00.000Z');
      expect(stem).toMatch(/^bugsnap-report-\d{8}-\d{6}$/);
    });

    it('creates matching stem with title slug and timestamp', () => {
      const stem = generateFilenameStem('Login crash', '2026-10-09T22:30:00.000Z');
      expect(stem).toMatch(/^bugsnap-login-crash-\d{8}-\d{6}$/);
    });
  });

  describe('escapeMarkdownTableCell', () => {
    it('escapes pipes so table columns do not break', () => {
      expect(escapeMarkdownTableCell('Search | Filter | Sort')).toBe('Search \\| Filter \\| Sort');
    });

    it('replaces line breaks with spaces', () => {
      expect(escapeMarkdownTableCell('Line 1\nLine 2')).toBe('Line 1 Line 2');
    });
  });

  describe('generateMarkdownReport', () => {
    const mockReport: BugReport = {
      id: 'report-export-1',
      status: 'draft',
      title: 'Navigation Bar Overlap',
      severity: 'Critical',
      reproductionSteps: '1. Resize window to 768px\n2. Open mobile menu',
      expectedBehavior: 'Menu slides smoothly without overlapping logo',
      actualBehavior: 'Menu completely obscures the top navigation bar and logo',
      additionalNotes: 'Reproduced on Chrome desktop responsive mode',
      metadata: {
        url: 'https://example.com/dashboard',
        title: 'Customer Dashboard',
        capturedAt: '2026-10-09T22:30:00.000Z',
        browser: 'Chrome 129',
        platform: 'MacIntel',
        viewport: { width: 1440, height: 900 },
      },
      screenshotDataUrl: 'data:image/png;base64,mockPng',
      createdAt: '2026-10-09T22:30:00.000Z',
      updatedAt: '2026-10-09T22:30:00.000Z',
    };

    it('generates Markdown matching PRD template with property table and visual evidence reference', () => {
      const stem = 'bugsnap-navigation-bar-overlap-20261009-223000';
      const md = generateMarkdownReport(mockReport, stem);

      // Header
      expect(md).toContain('# [BugSnap] Navigation Bar Overlap');

      // Table properties
      expect(md).toContain('| **Severity** | Critical |');
      expect(md).toContain('| **Captured** | 2026-10-09 22:30:00 UTC |');
      expect(md).toContain('| **Page URL** | [https://example.com/dashboard](https://example.com/dashboard) |');
      expect(md).toContain('| **Page Title** | Customer Dashboard |');
      expect(md).toContain('| **Browser / OS** | Chrome 129 / MacIntel |');
      expect(md).toContain('| **Viewport Size** | 1440x900 |');

      // Visual Evidence matching stem
      expect(md).toContain('## Visual Evidence');
      expect(md).toContain(`![Annotated Screenshot](./${stem}-screenshot.png)`);

      // Content sections
      expect(md).toContain('## Reproduction Steps\n1. Resize window to 768px\n2. Open mobile menu');
      expect(md).toContain('## Expected Behavior\nMenu slides smoothly without overlapping logo');
      expect(md).toContain('## Actual Behavior\nMenu completely obscures the top navigation bar and logo');
      expect(md).toContain('## Additional Notes\nReproduced on Chrome desktop responsive mode');

      // Footer
      expect(md).toContain('*Report generated locally with BugSnap (₹0, privacy-first).*');
    });

    it('omits viewport row cleanly when viewport dimensions are missing', () => {
      const reportNoViewport: BugReport = {
        ...mockReport,
        metadata: {
          ...mockReport.metadata,
          viewport: undefined,
        },
      };

      const md = generateMarkdownReport(reportNoViewport, 'stem-1');
      expect(md).not.toContain('Viewport Size');
      expect(md).toContain('## Reproduction Steps');
    });

    it('omits browser/OS row when both are missing', () => {
      const reportNoEnv: BugReport = {
        ...mockReport,
        metadata: {
          ...mockReport.metadata,
          browser: undefined,
          platform: undefined,
        },
      };

      const md = generateMarkdownReport(reportNoEnv, 'stem-2');
      expect(md).not.toContain('Browser / OS');
    });
  });

  describe('dataUrlToBlob', () => {
    it('converts base64 png data URL into a valid Blob', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const blob = dataUrlToBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('exportReportPackage', () => {
    it('successfully triggers export package creation', async () => {
      const report: BugReport = {
        id: 'rep-1',
        status: 'draft',
        title: 'Crash',
        severity: 'High',
        reproductionSteps: 'Step 1',
        expectedBehavior: 'Fine',
        actualBehavior: 'Crash',
        additionalNotes: '',
        metadata: {
          url: 'https://test.com',
          title: 'Test',
          capturedAt: '2026-10-09T22:00:00.000Z',
        },
        screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        createdAt: '2026-10-09T22:00:00.000Z',
        updatedAt: '2026-10-09T22:00:00.000Z',
      };

      // Mock URL.createObjectURL and HTMLAnchorElement.prototype.click
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      } else {
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      }
      if (!window.URL.revokeObjectURL) {
        window.URL.revokeObjectURL = vi.fn();
      } else {
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
      }
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      const result = await exportReportPackage(report);

      expect(result.success).toBe(true);
      expect(result.filenameStem).toContain('bugsnap-crash');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('returns error result when export encounters an exception', async () => {
      const faultyReport = {
        title: 'Broken',
      } as unknown as BugReport;

      // Mock URL.createObjectURL to throw
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = vi.fn().mockImplementation(() => {
          throw new Error('ObjectURL creation failed');
        });
      } else {
        vi.spyOn(window.URL, 'createObjectURL').mockImplementation(() => {
          throw new Error('ObjectURL creation failed');
        });
      }

      const result = await exportReportPackage(faultyReport);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Export failed');
    });
  });
});
