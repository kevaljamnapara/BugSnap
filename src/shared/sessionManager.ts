import { BugReport } from './types';
import { generateDraftId } from './storage';

export function searchSessions(reports: BugReport[], query: string): BugReport[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return reports;
  return reports.filter((report) => [report.title, report.sessionLabel, report.metadata.url].filter(Boolean).join(' ').toLowerCase().includes(needle));
}

export function duplicateSession(report: BugReport): BugReport {
  const now = new Date().toISOString();
  return { ...report, id: generateDraftId(), status: 'draft', title: report.title ? `${report.title} (copy)` : 'Untitled investigation', sessionLabel: report.sessionLabel ? `${report.sessionLabel} (copy)` : undefined, createdAt: now, updatedAt: now, debugSession: report.debugSession ? { ...report.debugSession, status: 'stopped', startedAt: now, stoppedAt: now } : undefined };
}
