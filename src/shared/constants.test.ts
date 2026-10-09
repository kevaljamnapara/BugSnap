import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  SEVERITY_LEVELS,
  DEFAULT_SEVERITY,
  RETENTION_PERIOD_OPTIONS,
  DEFAULT_RETENTION_SETTINGS,
} from './constants';

describe('Shared Constants', () => {
  it('has valid APP_NAME', () => {
    expect(APP_NAME).toBe('BugSnap');
  });

  it('contains all four required severity levels in exact order', () => {
    expect(SEVERITY_LEVELS).toEqual(['Low', 'Medium', 'High', 'Critical']);
  });

  it('defaults to Medium severity', () => {
    expect(DEFAULT_SEVERITY).toBe('Medium');
  });

  it('has approved retention period options of 7, 30, and 90 days', () => {
    expect(RETENTION_PERIOD_OPTIONS).toEqual([7, 30, 90]);
  });

  it('defaults automatic retention cleanup to disabled', () => {
    expect(DEFAULT_RETENTION_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_RETENTION_SETTINGS.retentionDays).toBe(30);
  });
});

