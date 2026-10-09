import { BugReport } from '../shared/types';

/**
 * Sanitizes a title string into a safe, filesystem-friendly URL-like slug.
 */
export function sanitizeSlug(title?: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/**
 * Formats a Date into YYYYMMDD-HHmmss timestamp.
 */
export function formatTimestampSlug(dateString?: string): string {
  const date = dateString ? new Date(dateString) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = validDate.getUTCFullYear();
  const mm = pad(validDate.getUTCMonth() + 1);
  const dd = pad(validDate.getUTCDate());
  const hh = pad(validDate.getUTCHours());
  const min = pad(validDate.getUTCMinutes());
  const ss = pad(validDate.getUTCSeconds());

  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Generates matching sanitized filename stem for both Markdown and screenshot.
 * Format: bugsnap-<slug>-<YYYYMMDD-HHmmss>
 */
export function generateFilenameStem(title?: string, capturedAt?: string): string {
  const slug = sanitizeSlug(title);
  const timestamp = formatTimestampSlug(capturedAt);
  if (!slug) {
    return `bugsnap-report-${timestamp}`;
  }
  return `bugsnap-${slug}-${timestamp}`;
}

/**
 * Escapes characters that would break Markdown tables.
 */
export function escapeMarkdownTableCell(text?: string): string {
  if (!text) return '';
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/**
 * Formats user reproduction steps into Markdown list if not already formatted.
 */
export function formatReproductionSteps(steps?: string): string {
  if (!steps || !steps.trim()) {
    return '1. Open the page\n2. Trigger the reported issue';
  }

  const lines = steps.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return '1. Open the page\n2. Trigger the reported issue';
  }

  // If already numbered, preserve as is
  const isAlreadyNumbered = lines.every((l) => /^\d+\.\s/.test(l));
  if (isAlreadyNumbered) {
    return lines.join('\n');
  }

  // Otherwise number each step
  return lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n');
}

/**
 * Generates the canonical Markdown report according to PRD v0.3 specifications.
 */
export function generateMarkdownReport(report: BugReport, filenameStem: string): string {
  const title = report.title.trim() || 'Untitled Bug';
  const severity = report.severity || 'Medium';

  // Format captured timestamp in UTC
  const capturedDate = report.metadata.capturedAt ? new Date(report.metadata.capturedAt) : new Date();
  const capturedUtc = isNaN(capturedDate.getTime())
    ? 'Unknown'
    : capturedDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  // Build property table rows (omit unavailable metadata rather than fabricating)
  const rows: Array<[string, string]> = [
    ['**Severity**', severity],
    ['**Captured**', capturedUtc],
  ];

  if (report.metadata.url) {
    const safeUrl = escapeMarkdownTableCell(report.metadata.url);
    rows.push(['**Page URL**', `[${safeUrl}](${safeUrl})`]);
  } else {
    rows.push(['**Page URL**', 'Unavailable']);
  }

  rows.push(['**Page Title**', escapeMarkdownTableCell(report.metadata.title) || 'Unavailable']);

  if (report.metadata.platform || report.metadata.browser) {
    const browserStr = [report.metadata.browser, report.metadata.platform].filter(Boolean).join(' / ');
    rows.push(['**Browser / OS**', escapeMarkdownTableCell(browserStr)]);
  }

  if (report.metadata.viewport && report.metadata.viewport.width && report.metadata.viewport.height) {
    rows.push(['**Viewport Size**', `${report.metadata.viewport.width}x${report.metadata.viewport.height}`]);
  }

  const tableMarkdown = [
    '| Property | Value |',
    '| :--- | :--- |',
    ...rows.map(([prop, val]) => `| ${prop} | ${val} |`),
  ].join('\n');

  const steps = formatReproductionSteps(report.reproductionSteps);
  const expected = report.expectedBehavior.trim() || 'Not specified.';
  const actual = report.actualBehavior.trim() || 'Not specified.';
  const notes = report.additionalNotes.trim() || 'None';
  const screenshotFilename = `${filenameStem}-screenshot.png`;

  let diagnosticsSection = '';
  if (report.metadata.diagnostics) {
    const { resourceTimings, jsErrors } = report.metadata.diagnostics;
    const items: string[] = [];
    if (jsErrors && jsErrors.length > 0) {
      items.push(`### Recorded Page Errors\n` + jsErrors.map((e) => `- \`${escapeMarkdownTableCell(e)}\``).join('\n'));
    }
    if (resourceTimings && resourceTimings.length > 0) {
      const timingRows = resourceTimings.slice(0, 15).map(
        (t) =>
          `| \`${escapeMarkdownTableCell(t.name)}\` | ${escapeMarkdownTableCell(t.initiatorType)} | ${t.duration}ms | ${t.transferSize !== undefined ? `${Math.round(t.transferSize / 1024)} KB` : 'Cached/N/A'} |`,
      );
      items.push(
        `### Network & Resource Timings\n` +
          `| Resource URL | Initiator | Duration | Size |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          timingRows.join('\n'),
      );
    }
    if (items.length > 0) {
      diagnosticsSection = `\n## Diagnostic Evidence\n${items.join('\n\n')}\n`;
    }
  }

  return `# [BugSnap] ${title}

${tableMarkdown}

## Visual Evidence
![Annotated Screenshot](./${screenshotFilename})

## Reproduction Steps
${steps}

## Expected Behavior
${expected}

## Actual Behavior
${actual}

## Additional Notes
${notes}
${diagnosticsSection}
---
*Report generated locally with BugSnap (₹0, privacy-first).*
`;
}

/**
 * Converts a base64 or raw data URL string into a native Blob object.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([dataUrl], { type: 'image/png' });
  }
}

/**
 * Programmatically triggers a browser download using a temporary ObjectURL and <a download>.
 * Revokes the ObjectURL after a short timeout.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL safely
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Exports both Markdown report and screenshot evidence as separate downloadable files.
 */
export async function exportReportPackage(
  report: BugReport,
): Promise<{ success: boolean; filenameStem?: string; error?: string }> {
  try {
    const stem = generateFilenameStem(report.title, report.metadata.capturedAt);
    const mdContent = generateMarkdownReport(report, stem);

    // 1. Download Markdown Report
    const mdBlob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(mdBlob, `${stem}.md`);

    // 2. Download Screenshot Image (prefer annotated screenshot, fallback to original)
    const screenshotData = report.annotatedScreenshotDataUrl || report.screenshotDataUrl;
    if (screenshotData && screenshotData.startsWith('data:image')) {
      const imgBlob = dataUrlToBlob(screenshotData);
      // Small tick delay to allow the browser event loop to process the first file download cleanly
      await new Promise((resolve) => setTimeout(resolve, 150));
      downloadBlob(imgBlob, `${stem}-screenshot.png`);
    }

    return {
      success: true,
      filenameStem: stem,
    };
  } catch (err) {
    return {
      success: false,
      error: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
