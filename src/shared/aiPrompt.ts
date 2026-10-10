import { BugReport } from './types';
import { reviewedSession } from './evidenceReview';
import { sanitizeEvidenceUrl, sanitizeEvidenceText } from './evidenceSanitizer';

export function generateAiDebugPrompt(report: BugReport, variant: 'concise' | 'detailed' = 'detailed'): string {
  const session = report.debugSession ? reviewedSession(report.debugSession) : undefined;
  const safeUrl = report.metadata?.url ? sanitizeEvidenceUrl(report.metadata.url) : 'Unavailable';
  const pageTitle = report.metadata?.title ? sanitizeEvidenceText(report.metadata.title) : 'Unavailable';
  const platform = [report.metadata?.browser, report.metadata?.platform].filter(Boolean).join(' / ') || 'Unavailable';
  const viewport = report.metadata?.viewport
    ? `${report.metadata.viewport.width} × ${report.metadata.viewport.height} px`
    : 'Unavailable';

  const sections: string[] = [];

  // 1. Problem Summary
  const summary = report.title?.trim() || 'Captured defect';
  sections.push(`## Defect Summary\n${summary}`);

  // 2. Page & Environment Context
  sections.push(
    `## Environment Context\n- Page URL: ${safeUrl}\n- Page Title: ${pageTitle}\n- Platform: ${platform}\n- Viewport: ${viewport}\n- Captured At: ${report.metadata?.capturedAt || 'Unavailable'}`
  );

  // 3. Reproduction & Behavior (only if available)
  const reproParts: string[] = [];
  if (report.reproductionSteps?.trim()) {
    reproParts.push(`- Steps to Reproduce:\n${report.reproductionSteps.trim()}`);
  }
  if (report.expectedBehavior?.trim()) {
    reproParts.push(`- Expected Behavior: ${report.expectedBehavior.trim()}`);
  }
  if (report.actualBehavior?.trim()) {
    reproParts.push(`- Actual Behavior: ${report.actualBehavior.trim()}`);
  }
  if (reproParts.length > 0) {
    sections.push(`## Reproduction Context\n${reproParts.join('\n')}`);
  }

  // 4. Runtime Evidence (Console)
  if (variant === 'detailed') {
    const consoleEvents = session?.consoleEvents || [];
    if (consoleEvents.length > 0) {
      const items = consoleEvents.map((e) => {
        const msg = sanitizeEvidenceText(e.message);
        const stack = e.stack ? ` (Stack: ${sanitizeEvidenceText(e.stack.slice(0, 200))})` : '';
        return `- [${e.kind}] ${msg}${stack}`;
      });
      sections.push(`## Console Errors & Warnings\n${items.join('\n')}`);
    } else {
      sections.push('## Console Diagnostics\nNo runtime errors or warnings were observed in this session.');
    }

    // 5. Network Observations
    const networkEvents = session?.networkEvents || [];
    if (networkEvents.length > 0) {
      const items = networkEvents.map(
        (n) => `- [${n.initiatorType}] ${sanitizeEvidenceUrl(n.url)} (${n.duration}ms)`
      );
      sections.push(`## Observable Network Activity\n${items.join('\n')}`);
    } else {
      sections.push('## Network Diagnostics\nNo network failures or relevant requests were observed in this session.');
    }
  }

  // 6. Screenshot Context
  const annotationCount = report.annotations?.length || 0;
  const annotationNote = annotationCount > 0 ? `${annotationCount} visual annotation(s) applied` : 'No annotations applied';
  sections.push(`## Visual Evidence\n- Screenshot available: ${report.screenshotDataUrl ? 'Yes' : 'No'} (${viewport})\n- Annotation status: ${annotationNote}`);

  // 7. Instructions for the AI Assistant
  sections.push(
    `## Instructions for AI Assistant\n` +
      `Analyze only the verified evidence provided above.\n` +
      `1. Distinguish facts from hypotheses.\n` +
      `2. Identify the most probable root cause based strictly on the runtime errors, network traces, and environmental facts.\n` +
      `3. Propose a minimal, targeted fix addressing the root cause.\n` +
      `4. Suggest focused verification tests to confirm the fix.\n` +
      `5. If evidence is insufficient to diagnose the defect with confidence, explicitly state what additional logs, reproduction steps, or telemetry are needed rather than assuming an unproven diagnosis.`
  );

  return sections.join('\n\n');
}
