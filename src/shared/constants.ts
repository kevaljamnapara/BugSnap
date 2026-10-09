import { Severity, RetentionPeriod, RetentionSettings } from './types';

export const APP_NAME = 'BugSnap';
export const APP_VERSION = '0.1.0';

export const SEVERITY_LEVELS: readonly Severity[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

export const DEFAULT_SEVERITY: Severity = 'Medium';

export const RETENTION_PERIOD_OPTIONS: readonly RetentionPeriod[] = [7, 30, 90] as const;

export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  enabled: false,
  retentionDays: 30,
};

export const EDIT_LOCK_TIMEOUT_MS = 45000;
export const EDIT_LOCK_HEARTBEAT_INTERVAL_MS = 15000;
