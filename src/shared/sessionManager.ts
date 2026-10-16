import { BugReport } from './types';
import { generateDraftId } from './storage';

export function searchSessions(reports: BugReport[], query: string): BugReport[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return reports;
  return reports.filter((report) =>
    [report.title, report.sessionLabel, report.metadata?.url]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

export function duplicateSession(report: BugReport): BugReport {
  const now = new Date().toISOString();
  return {
    ...report,
    id: generateDraftId(),
    status: 'draft',
    title: report.title ? `${report.title} (copy)` : 'Untitled investigation',
    sessionLabel: report.sessionLabel ? `${report.sessionLabel} (copy)` : undefined,
    createdAt: now,
    updatedAt: now,
    debugSession: report.debugSession
      ? { ...report.debugSession, status: 'stopped', startedAt: now, stoppedAt: now }
      : undefined,
  };
}

export function renameSession(report: BugReport, nextTitle: string, nextLabel?: string): BugReport {
  const now = new Date().toISOString();
  return {
    ...report,
    title: nextTitle.trim() || report.title || 'Untitled investigation',
    sessionLabel: nextLabel !== undefined ? (nextLabel.trim() || undefined) : report.sessionLabel,
    updatedAt: now,
  };
}

export function createSession(title?: string, sessionLabel?: string): BugReport {
  const now = new Date().toISOString();
  return {
    id: generateDraftId(),
    status: 'draft',
    title: title?.trim() || 'New debugging session',
    sessionLabel: sessionLabel?.trim() || undefined,
    severity: 'Medium',
    reproductionSteps: '',
    expectedBehavior: '',
    actualBehavior: '',
    additionalNotes: '',
    metadata: {
      url: '',
      title: '',
      capturedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}
