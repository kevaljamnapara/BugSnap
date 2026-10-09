import { Severity } from './types';

export const APP_NAME = 'BugSnap';
export const APP_VERSION = '0.1.0';

export const SEVERITY_LEVELS: readonly Severity[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

export const DEFAULT_SEVERITY: Severity = 'Medium';
