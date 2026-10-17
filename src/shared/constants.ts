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

export const EDIT_LOCK_TIMEOUT_MS = 120000; // 2 minutes (safeguards against Chromium 60s background timer throttling)
export const EDIT_LOCK_HEARTBEAT_INTERVAL_MS = 15000;

// Debug session stream caps (ring buffers, newest kept)
export const MAX_CONSOLE_EVENTS = 500;
export const MAX_FAILED_NETWORK_EVENTS = 500;
export const MAX_OTHER_NETWORK_EVENTS = 300;

// Explicit field truncation limits
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_STACK_LENGTH = 8000;
export const MAX_URL_LENGTH = 2000;
export const MAX_BODY_SNIPPET_LENGTH = 2000;

