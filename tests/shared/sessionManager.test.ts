import { describe, expect, it } from 'vitest';
import { createSession, duplicateSession, renameSession, searchSessions } from '../../src/shared/sessionManager';
import { BugReport } from '../../src/shared/types';

const report: BugReport = {
  id: 'rep-test-1',
  status: 'saved',
  title: 'Checkout error on mobile',
  sessionLabel: 'Sprint 24 Smoke',
  severity: 'Critical',
  reproductionSteps: '1. Click checkout',
  expectedBehavior: 'Proceeds to payment',
  actualBehavior: 'Spinner hangs indefinitely',
  additionalNotes: '',
  metadata: { url: 'https://staging.example.com/cart', title: 'Cart Page', capturedAt: '2026-10-09T10:00:00.000Z' },
  debugSession: {
    tabId: 101,
    status: 'active',
    startedAt: '2026-10-09T10:00:00.000Z',
    consoleEvents: [],
  },
  createdAt: '2026-10-09T10:00:00.000Z',
  updatedAt: '2026-10-09T10:00:00.000Z',
};

describe('sessionManager', () => {
  describe('searchSessions', () => {
    it('searches by sessionLabel, title, or url', () => {
      expect(searchSessions([report], 'sprint 24')).toHaveLength(1);
      expect(searchSessions([report], 'checkout')).toHaveLength(1);
      expect(searchSessions([report], 'staging.example')).toHaveLength(1);
      expect(searchSessions([report], 'non-existent')).toHaveLength(0);
    });

    it('returns all reports on empty or whitespace search query', () => {
      expect(searchSessions([report], '')).toHaveLength(1);
      expect(searchSessions([report], '   ')).toHaveLength(1);
    });

    it('safely handles reports with missing metadata or missing optional fields', () => {
      const bareReport: BugReport = {
        id: 'bare',
        status: 'draft',
        title: 'Bare report',
        severity: 'Low',
        reproductionSteps: '',
        expectedBehavior: '',
        actualBehavior: '',
        additionalNotes: '',
        metadata: { url: '', title: '', capturedAt: '' },
        createdAt: '',
        updatedAt: '',
      };
      expect(searchSessions([bareReport], 'bare')).toHaveLength(1);
      expect(searchSessions([bareReport], 'other')).toHaveLength(0);
    });
  });

  describe('duplicateSession', () => {
    it('creates a fresh draft copy, marks debugSession as stopped, and appends (copy)', () => {
      const copy = duplicateSession(report);
      expect(copy.id).not.toBe(report.id);
      expect(copy.status).toBe('draft');
      expect(copy.title).toBe('Checkout error on mobile (copy)');
      expect(copy.sessionLabel).toBe('Sprint 24 Smoke (copy)');
      expect(copy.debugSession?.status).toBe('stopped');
      expect(copy.createdAt).not.toBe(report.createdAt);
      expect(copy.updatedAt).not.toBe(report.updatedAt);
    });
  });

  describe('renameSession', () => {
    it('updates title and sessionLabel while refreshing updatedAt timestamp', () => {
      const renamed = renameSession(report, 'Updated title', 'Release Candidate 1');
      expect(renamed.title).toBe('Updated title');
      expect(renamed.sessionLabel).toBe('Release Candidate 1');
      expect(renamed.updatedAt).not.toBe(report.updatedAt);
    });

    it('clears sessionLabel if empty string is supplied', () => {
      const renamed = renameSession(report, 'Updated title', '');
      expect(renamed.sessionLabel).toBeUndefined();
    });
  });

  describe('createSession', () => {
    it('creates a new blank draft session with safe defaults and valid ID', () => {
      const created = createSession('My Investigation', 'Hotfix');
      expect(created.id).toBeTruthy();
      expect(created.status).toBe('draft');
      expect(created.title).toBe('My Investigation');
      expect(created.sessionLabel).toBe('Hotfix');
      expect(created.severity).toBe('Medium');
      expect(created.metadata.capturedAt).toBeTruthy();
    });

    it('provides sensible fallback title when none is specified', () => {
      const created = createSession();
      expect(created.title).toBe('New debugging session');
      expect(created.sessionLabel).toBeUndefined();
    });
  });
});
