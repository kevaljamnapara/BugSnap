import { BugReport } from '../shared/types';
import { sanitizeEvidenceText, sanitizeEvidenceUrl } from '../shared/evidenceSanitizer';
import { buildEnvironmentDiagnostics } from '../shared/environmentDiagnostics';
import { generateAiDebugPrompt } from '../shared/aiPrompt';
import { reviewedSession } from '../shared/evidenceReview';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    return 'No reproduction steps recorded.';
  }

  const lines = steps.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return 'No reproduction steps recorded.';
  }

  // Format lines, distinguishing observed navigation from confirmed manual actions
  return lines
    .map((line, idx) => {
      if (line.includes('[Observed navigation]')) {
        const cleanNav = line.replace(/\[Observed navigation\]\s*/, '').trim();
        return `${idx + 1}. [Observed navigation] ${sanitizeEvidenceUrl(cleanNav)}`;
      }
      const stripped = line.replace(/^\d+\.\s*/, '');
      return `${idx + 1}. ${stripped}`;
    })
    .join('\n');
}

/**
 * Automatically derives a concise summary from available evidence without inventing defects.
 */
export function deriveReportSummary(report: BugReport): string {
  // 1. User manual title if provided
  if (report.title && report.title.trim()) {
    return report.title.trim();
  }

  // 2. Derive from active debug session console events
  if (report.debugSession?.consoleEvents && report.debugSession.consoleEvents.length > 0) {
    const errorEvent =
      report.debugSession.consoleEvents.find(
        (e) => e.kind === 'runtime-error' || e.kind === 'unhandled-rejection',
      ) || report.debugSession.consoleEvents[0];
    const cleanMsg = sanitizeEvidenceText(errorEvent.message).replace(/\s+/g, ' ').trim();
    if (cleanMsg) {
      const truncated = cleanMsg.slice(0, 60);
      return `Runtime error: ${truncated}${cleanMsg.length > 60 ? '...' : ''}`;
    }
  }

  // 3. Derive from metadata diagnostic jsErrors
  if (report.metadata?.diagnostics?.jsErrors && report.metadata.diagnostics.jsErrors.length > 0) {
    const cleanMsg = sanitizeEvidenceText(report.metadata.diagnostics.jsErrors[0]).replace(/\s+/g, ' ').trim();
    if (cleanMsg) {
      const truncated = cleanMsg.slice(0, 60);
      return `Page error: ${truncated}${cleanMsg.length > 60 ? '...' : ''}`;
    }
  }

  // 4. Derive from page title
  if (report.metadata?.title && report.metadata.title.trim()) {
    const cleanTitle = sanitizeEvidenceText(report.metadata.title).replace(/\s+/g, ' ').trim();
    return `Issue on: ${cleanTitle.slice(0, 50)}`;
  }

  // 5. Derive from URL hostname
  if (report.metadata?.url) {
    try {
      const parsed = new URL(report.metadata.url);
      if (parsed.hostname && parsed.hostname !== 'localhost') {
        const pathPart = parsed.pathname !== '/' ? parsed.pathname.slice(0, 24) : '';
        return `Issue on ${parsed.hostname}${pathPart}`;
      }
    } catch {
      // ignore
    }
  }

  // 6. Neutral default
  return 'Captured browser issue';
}

export interface CompleteBugReportResult {
  markdown: string;
  html: string;
  aiPrompt: string;
  combinedMarkdown: string;
  combinedHtml: string;
  summary: string;
  filenameStem: string;
}

/**
 * Generates a complete, self-contained, sanitized Bug Report in both Markdown and HTML.
 * Includes all diagnostic evidence (Console, Network, Environment, Timeline, Annotations, Privacy status).
 */
export function generateCompleteBugReport(
  report: BugReport,
  customStem?: string,
): CompleteBugReportResult {
  const summary = deriveReportSummary(report);
  const stem = customStem || generateFilenameStem(summary, report.metadata.capturedAt);

  // Format captured timestamp in UTC
  const capturedDate = report.metadata.capturedAt ? new Date(report.metadata.capturedAt) : new Date();
  const capturedUtc = isNaN(capturedDate.getTime())
    ? 'Unavailable'
    : capturedDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  const safeUrl = report.metadata.url ? sanitizeEvidenceUrl(report.metadata.url) : 'Unavailable';
  const pageTitle = report.metadata.title ? sanitizeEvidenceText(report.metadata.title) : 'Unavailable';
  const browserPlatform = [report.metadata.browser, report.metadata.platform].filter(Boolean).join(' / ') || 'Unavailable';
  const viewport = report.metadata.viewport
    ? `${report.metadata.viewport.width} × ${report.metadata.viewport.height} px`
    : 'Unavailable';

  // 1. Console Diagnostics
  let consoleMd = '';
  let consoleHtml = '';
  const excludedIds = new Set(report.debugSession?.excludedEvidenceIds || []);
  const activeConsoleEvents = (report.debugSession?.consoleEvents || []).filter(
    (e) => !excludedIds.has(e.id),
  );

  if (activeConsoleEvents.length > 0) {
    const rows = activeConsoleEvents.map((e) => {
      const cleanMsg = sanitizeEvidenceText(e.message);
      const stack = e.stack ? `\n    - Stack: \`${sanitizeEvidenceText(e.stack.slice(0, 300))}\`` : '';
      const src = e.source ? `\n    - Source: \`${sanitizeEvidenceText(e.source)}\`` : '';
      return `- **[${e.kind}]** ${cleanMsg} (${e.count > 1 ? `${e.count}x, ` : ''}${e.timestamp})${src}${stack}`;
    });
    consoleMd = rows.join('\n');
    consoleHtml = `<ul>${activeConsoleEvents
      .map(
        (e) =>
          `<li><strong>[${e.kind}]</strong> ${sanitizeEvidenceText(e.message)} <em>(${e.count > 1 ? `${e.count}x, ` : ''}${e.timestamp})</em></li>`,
      )
      .join('')}</ul>`;
  } else if (report.metadata.diagnostics?.jsErrors && report.metadata.diagnostics.jsErrors.length > 0) {
    const rows = report.metadata.diagnostics.jsErrors.map((err) => `- \`${sanitizeEvidenceText(err)}\``);
    consoleMd = rows.join('\n');
    consoleHtml = `<ul>${report.metadata.diagnostics.jsErrors.map((err) => `<li><code>${sanitizeEvidenceText(err)}</code></li>`).join('')}</ul>`;
  } else if (report.debugSession) {
    consoleMd = 'No runtime errors or unhandled rejections recorded during this session.';
    consoleHtml = '<p>No runtime errors or unhandled rejections recorded during this session.</p>';
  } else {
    consoleMd = 'Console error capture was not active during this capture. (DevTools console history is restricted by browser security policies).';
    consoleHtml = '<p><em>Console error capture was not active during this capture. (DevTools console history is restricted by browser security policies).</em></p>';
  }

  // 2. Network Diagnostics
  let networkMd = '';
  let networkHtml = '';
  const activeNetworkEvents = (report.debugSession?.networkEvents || []).filter(
    (e) => !excludedIds.has(e.id),
  );

  if (activeNetworkEvents.length > 0) {
    const rows = activeNetworkEvents.map((n) => {
      const safeResourceUrl = sanitizeEvidenceUrl(n.url);
      return `- **[${n.initiatorType}]** \`${safeResourceUrl}\` — ${n.duration}ms (${n.timestamp})`;
    });
    networkMd = rows.join('\n') + '\n\n*Note: Browser extensions observe resource timing; raw HTTP status codes require intrusive host permissions.*';
    networkHtml = `<ul>${activeNetworkEvents
      .map((n) => `<li><strong>[${n.initiatorType}]</strong> <code>${sanitizeEvidenceUrl(n.url)}</code> — ${n.duration}ms</li>`)
      .join('')}</ul><p><small>Note: Browser extensions observe resource timing; raw HTTP status codes require intrusive host permissions.</small></p>`;
  } else if (report.metadata.diagnostics?.resourceTimings && report.metadata.diagnostics.resourceTimings.length > 0) {
    const rows = report.metadata.diagnostics.resourceTimings.slice(0, 10).map((t) => {
      return `- **[${t.initiatorType}]** \`${sanitizeEvidenceUrl(t.name)}\` — ${t.duration}ms`;
    });
    networkMd = rows.join('\n') + '\n\n*Note: Observable page resource timings collected locally.*';
    networkHtml = `<ul>${report.metadata.diagnostics.resourceTimings.slice(0, 10).map((t) => `<li><strong>[${t.initiatorType}]</strong> <code>${sanitizeEvidenceUrl(t.name)}</code> — ${t.duration}ms</li>`).join('')}</ul>`;
  } else {
    networkMd = 'Network diagnostic capture was not active for this capture.';
    networkHtml = '<p><em>Network diagnostic capture was not active for this capture.</em></p>';
  }

  // 3. Reproduction Context
  const stepsText = formatReproductionSteps(report.reproductionSteps);

  // 4. Environment Diagnostics
  const envItems = buildEnvironmentDiagnostics(report.metadata);
  const envMd = envItems.map((item) => `- **${item.label}**: ${item.value}`).join('\n');
  const envHtml = `<ul>${envItems.map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`).join('')}</ul>`;

  // 5. Debugging Timeline
  let timelineMd = '';
  let timelineHtml = '';
  if (report.debugSession) {
    const consoleItems = (report.debugSession.consoleEvents || [])
      .filter((e) => !excludedIds.has(e.id))
      .map((e) => ({
        timestamp: e.timestamp,
        category: 'Console' as const,
        text: `[${e.kind}] ${sanitizeEvidenceText(e.message)}`,
      }));
    const networkItems = (report.debugSession.networkEvents || [])
      .filter((n) => !excludedIds.has(n.id))
      .map((n) => ({
        timestamp: n.timestamp,
        category: 'Network' as const,
        text: `[${n.initiatorType}] ${sanitizeEvidenceUrl(n.url)} (${n.duration}ms)`,
      }));
    const merged = [...consoleItems, ...networkItems].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (merged.length > 0) {
      timelineMd = merged.map((item) => `- \`${item.timestamp}\` **[${item.category}]** ${item.text}`).join('\n');
      timelineHtml = `<ul>${merged
        .map((item) => `<li><code>${item.timestamp}</code> <strong>[${item.category}]</strong> ${item.text}</li>`)
        .join('')}</ul>`;
    } else {
      timelineMd = 'Debugging timeline active — no events recorded.';
      timelineHtml = '<p>Debugging timeline active — no events recorded.</p>';
    }
  } else {
    timelineMd = 'Debugging timeline not available (no active debug session).';
    timelineHtml = '<p><em>Debugging timeline not available (no active debug session).</em></p>';
  }

  // 6. Screenshot Context
  const annotationCount = report.annotations?.length || 0;
  const annotationText = annotationCount > 0 ? `${annotationCount} visual annotation(s) included` : 'No visual annotations applied';

  // 7. Markdown Assembly
  const markdown = `# BugSnap Bug Report

## Summary
${summary}

## Page Context
- **Page URL**: [${safeUrl}](${safeUrl})
- **Page Title**: ${pageTitle}
- **Captured At**: ${capturedUtc}
- **Browser / OS**: ${browserPlatform}
- **Viewport**: ${viewport}

## Console Diagnostics
${consoleMd}

## Network Diagnostics
${networkMd}

## Reproduction Context
${stepsText}

## Environment Diagnostics
${envMd}

## Debugging Timeline
${timelineMd}

## Screenshot
- Reference: Accompanying screenshot captured at ${capturedUtc} (${viewport}).
- Visual Annotations: ${annotationText}.
- Clipboard format: Screenshot image is copied to the clipboard as PNG alongside this report where supported.

## Privacy and Evidence Limitations
- **Redaction Applied**: Sensitive URL query parameters (passwords, tokens, API keys, secrets) and Bearer authorization headers were automatically redacted.
- **Security Invariants**: BugSnap runs ₹0 locally with zero external network requests or AI APIs. No cookies, form values, or browsing histories were accessed.
- **Visual Evidence Notice**: Page screenshot is captured directly from the tab viewport without automated image pixel redaction.
- **Browser Boundaries**: DevTools historical console history prior to capture is restricted by browser security policies.

---
*Report generated locally with BugSnap (₹0, privacy-first).*
`;

  // 8. HTML Assembly
  const html = `<div class="bugsnap-report" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1c1c1e;">
  <h1 style="font-size: 20px; font-weight: 700; border-bottom: 2px solid #0071e3; padding-bottom: 6px; margin-bottom: 16px;">BugSnap Bug Report</h1>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Summary</h2>
  <p style="font-size: 14px; font-weight: 500; margin: 0 0 12px 0;">${summary}</p>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Page Context</h2>
  <ul style="font-size: 13px; margin: 0 0 12px 0; padding-left: 20px;">
    <li><strong>Page URL:</strong> <a href="${safeUrl}">${safeUrl}</a></li>
    <li><strong>Page Title:</strong> ${pageTitle}</li>
    <li><strong>Captured At:</strong> ${capturedUtc}</li>
    <li><strong>Browser / OS:</strong> ${browserPlatform}</li>
    <li><strong>Viewport:</strong> ${viewport}</li>
  </ul>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Console Diagnostics</h2>
  <div style="font-size: 13px; margin: 0 0 12px 0;">${consoleHtml}</div>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Network Diagnostics</h2>
  <div style="font-size: 13px; margin: 0 0 12px 0;">${networkHtml}</div>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Reproduction Context</h2>
  <pre style="font-size: 12px; background: #f2f2f7; padding: 10px; border-radius: 6px; white-space: pre-wrap; margin: 0 0 12px 0;">${stepsText}</pre>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Environment Diagnostics</h2>
  <div style="font-size: 13px; margin: 0 0 12px 0;">${envHtml}</div>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Debugging Timeline</h2>
  <div style="font-size: 13px; margin: 0 0 12px 0;">${timelineHtml}</div>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Screenshot</h2>
  <p style="font-size: 13px; margin: 0 0 12px 0;">Captured at ${capturedUtc} (${viewport}). Visual Annotations: <strong>${annotationText}</strong>.</p>

  <h2 style="font-size: 15px; font-weight: 600; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">Privacy and Evidence Limitations</h2>
  <ul style="font-size: 12px; color: #636366; margin: 0 0 12px 0; padding-left: 20px;">
    <li>Sensitive URL query parameters and Bearer credentials were automatically sanitized locally.</li>
    <li>Local capture only; no cookies, form values, or page data are sent externally (₹0 cost, 100% offline).</li>
    <li>Page screenshot is captured directly from viewport without automated image pixel redaction.</li>
  </ul>

  <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 16px 0;" />
  <p style="font-size: 11px; color: #8e8e93; margin: 0;"><em>Report generated locally with BugSnap (₹0, privacy-first).</em></p>
</div>`;

  const aiPrompt = generateAiDebugPrompt(report, 'detailed');
  const combinedMarkdown = `${markdown}\n\n---\n\n# AI Debugging Prompt\n\n${aiPrompt}\n`;
  const combinedHtml = `${html}
  <hr style="border: none; border-top: 2px solid #0071e3; margin: 24px 0;" />
  <div class="bugsnap-ai-prompt" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1c1c1e;">
    <h2 style="font-size: 16px; font-weight: 700; color: #0071e3; margin-top: 16px; margin-bottom: 8px;">AI Debugging Prompt</h2>
    <pre style="font-size: 12px; background: #f2f2f7; padding: 12px; border-radius: 6px; white-space: pre-wrap; margin: 0 0 12px 0; font-family: ui-monospace, monospace;">${escapeHtml(aiPrompt)}</pre>
  </div>`;

  return {
    markdown,
    html,
    aiPrompt,
    combinedMarkdown,
    combinedHtml,
    summary,
    filenameStem: stem,
  };
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

export interface CopyReportResult {
  success: boolean;
  combined: boolean;
  fallbackScreenshotSaved?: boolean;
  message: string;
  error?: string;
}

/**
 * Copies complete bug report and screenshot evidence together with a single action.
 * Uses multi-MIME ClipboardItem (text/plain, text/html, image/png) where supported.
 * Falls back safely and honestly if the browser restricts combined multi-MIME copying.
 */
export async function copyCompleteBugReport(
  report: BugReport,
  screenshotDataUrl?: string,
): Promise<CopyReportResult> {
  const completeReport = generateCompleteBugReport(report);
  const markdownText = completeReport.combinedMarkdown;
  const htmlText = completeReport.combinedHtml;

  const dataUrl = screenshotDataUrl || report.annotatedScreenshotDataUrl || report.screenshotDataUrl;
  let screenshotBlob: Blob | null = null;
  if (dataUrl && dataUrl.startsWith('data:image')) {
    try {
      screenshotBlob = dataUrlToBlob(dataUrl);
    } catch {
      screenshotBlob = null;
    }
  }

  // 1. Attempt multi-MIME Clipboard write (image/png + text/plain + text/html)
  if (
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    if (screenshotBlob) {
      try {
        const item = new ClipboardItem({
          'text/plain': new Blob([markdownText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'image/png': screenshotBlob,
        });
        await navigator.clipboard.write([item]);
        return {
          success: true,
          combined: true,
          message: 'Report, AI prompt, and screenshot copied.',
        };
      } catch {
        // Combined write rejected by browser environment; fall through to text copy + screenshot download fallback
      }
    }

    // Attempt text item (text/plain + text/html)
    try {
      const textItem = new ClipboardItem({
        'text/plain': new Blob([markdownText], { type: 'text/plain' }),
        'text/html': new Blob([htmlText], { type: 'text/html' }),
      });
      await navigator.clipboard.write([textItem]);

      if (screenshotBlob) {
        try {
          downloadBlob(screenshotBlob, `${completeReport.filenameStem}-screenshot.png`);
        } catch {
          // ignore download fallback errors
        }
        return {
          success: true,
          combined: false,
          fallbackScreenshotSaved: true,
          message: 'Report and AI prompt copied; screenshot saved separately.',
        };
      }

      return {
        success: true,
        combined: false,
        message: 'Report and AI prompt copied.',
      };
    } catch {
      // Fall through to writeText
    }
  }

  // 2. Fallback to navigator.clipboard.writeText
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(markdownText);
      if (screenshotBlob) {
        try {
          downloadBlob(screenshotBlob, `${completeReport.filenameStem}-screenshot.png`);
        } catch {
          // ignore download fallback errors
        }
        return {
          success: true,
          combined: false,
          fallbackScreenshotSaved: true,
          message: 'Report and AI prompt copied; screenshot saved separately.',
        };
      }
      return {
        success: true,
        combined: false,
        message: 'Report and AI prompt copied.',
      };
    } catch (writeErr) {
      return {
        success: false,
        combined: false,
        error: `Failed to copy to clipboard: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
        message: 'Copy failed. Try again.',
      };
    }
  }

  return {
    success: false,
    combined: false,
    error: 'Clipboard API is unavailable in this environment.',
    message: 'Copy failed. Try again.',
  };
}

/**
 * Legacy Markdown generator maintained for backwards compatibility with earlier Phase 3/4 tests.
 */
export function generateMarkdownReport(report: BugReport, filenameStem: string): string {
  const title = report.title.trim() || 'Untitled Bug';
  const severity = report.severity || 'Medium';

  const capturedDate = report.metadata.capturedAt ? new Date(report.metadata.capturedAt) : new Date();
  const capturedUtc = isNaN(capturedDate.getTime())
    ? 'Unknown'
    : capturedDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

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
  const diagItems: string[] = [];

  const session = report.debugSession ? reviewedSession(report.debugSession) : undefined;
  const activeConsoleEvents = session?.consoleEvents || [];
  const jsErrors = report.metadata?.diagnostics?.jsErrors || [];

  const errorRows: string[] = [];
  if (activeConsoleEvents.length > 0) {
    activeConsoleEvents.forEach((e) => {
      const cleanMsg = sanitizeEvidenceText(e.message);
      const stack = e.stack ? ` (Stack: \`${escapeMarkdownTableCell(e.stack.slice(0, 200))}\`)` : '';
      errorRows.push(`- **[${e.kind}]** \`${cleanMsg}\`${e.count > 1 ? ` (${e.count}x)` : ''}${stack}`);
    });
  }
  if (jsErrors.length > 0) {
    jsErrors.forEach((err) => {
      if (!activeConsoleEvents.some((e) => e.message.includes(err) || err.includes(e.message))) {
        errorRows.push(`- \`${escapeMarkdownTableCell(sanitizeEvidenceText(err))}\``);
      }
    });
  }
  if (errorRows.length > 0) {
    diagItems.push(`### Recorded Page Errors\n` + errorRows.join('\n'));
  }

  const activeNetworkEvents = session?.networkEvents || [];
  const resourceTimings = report.metadata?.diagnostics?.resourceTimings || [];

  const timingRows: string[] = [];
  if (activeNetworkEvents.length > 0) {
    activeNetworkEvents.slice(0, 20).forEach((n) => {
      timingRows.push(
        `| \`${escapeMarkdownTableCell(sanitizeEvidenceUrl(n.url))}\` | ${escapeMarkdownTableCell(n.initiatorType)} | ${n.duration}ms | Observed |`,
      );
    });
  }
  if (resourceTimings.length > 0) {
    const existingUrls = new Set(activeNetworkEvents.map((n) => sanitizeEvidenceUrl(n.url)));
    resourceTimings.slice(0, 15).forEach((t) => {
      const safeUrl = sanitizeEvidenceUrl(t.name);
      if (!existingUrls.has(safeUrl)) {
        const size = t.transferSize !== undefined ? `${Math.round(t.transferSize / 1024)} KB` : 'Cached/N/A';
        timingRows.push(
          `| \`${escapeMarkdownTableCell(safeUrl)}\` | ${escapeMarkdownTableCell(t.initiatorType)} | ${t.duration}ms | ${size} |`,
        );
      }
    });
  }
  if (timingRows.length > 0) {
    diagItems.push(
      `### Network & Resource Timings\n` +
        `| Resource URL | Initiator | Duration | Status / Size |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        timingRows.join('\n'),
    );
  }

  if (diagItems.length > 0) {
    diagnosticsSection = `\n## Diagnostic Evidence\n${diagItems.join('\n\n')}\n`;
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
 * Exports both Markdown report and screenshot evidence as separate downloadable files.
 */
export async function exportReportPackage(
  report: BugReport,
): Promise<{ success: boolean; filenameStem?: string; error?: string }> {
  try {
    const summary = deriveReportSummary(report);
    const stem = generateFilenameStem(summary, report.metadata.capturedAt);
    const complete = generateCompleteBugReport(report, stem);

    // 1. Download Markdown Report
    const mdBlob = new Blob([complete.markdown], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(mdBlob, `${stem}.md`);

    // 2. Download Screenshot Image (prefer annotated screenshot, fallback to original)
    const screenshotData = report.annotatedScreenshotDataUrl || report.screenshotDataUrl;
    if (screenshotData && screenshotData.startsWith('data:image')) {
      const imgBlob = dataUrlToBlob(screenshotData);
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
