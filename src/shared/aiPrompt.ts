import { BugReport } from './types';
import { reviewedSession } from './evidenceReview';

export function generateAiDebugPrompt(report: BugReport, variant: 'concise' | 'detailed' = 'detailed'): string {
  const session = report.debugSession ? reviewedSession(report.debugSession) : undefined;
  const facts = [
    `Issue: ${report.title || 'Untitled bug'}`,
    `Severity: ${report.severity}`,
    `Page: ${report.metadata.url || 'Unavailable'}`,
    `Reproduction steps:\n${report.reproductionSteps || 'Not provided'}`,
    `Actual behavior:\n${report.actualBehavior || 'Not provided'}`,
  ];
  if (variant === 'detailed') {
    facts.push(`Runtime evidence:\n${session?.consoleEvents.map((event) => `- ${event.kind}: ${event.message}`).join('\n') || 'Unavailable'}`);
    facts.push(`Network observations:\n${session?.networkEvents?.map((event) => `- ${event.initiatorType}: ${event.url}`).join('\n') || 'Unavailable'}`);
  }
  return `${facts.join('\n\n')}\n\nAnalyze only this evidence. Distinguish facts from hypotheses, propose minimal fixes, and suggest focused tests. Do not assume unavailable diagnostics.`;
}
