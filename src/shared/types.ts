export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type ReportStatus = 'draft' | 'saved';

export type AnnotationType = 'rectangle' | 'ellipse' | 'arrow' | 'text';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  strokeWidth: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  strokeWidth: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type Annotation =
  | RectangleAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | TextAnnotation;

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export type CaptureMode = 'viewport' | 'region';

export interface DiagnosticEvidence {
  resourceTimings?: Array<{
    name: string;
    initiatorType: string;
    duration: number;
    transferSize?: number;
  }>;
  jsErrors?: string[];
}

export type ConsoleEventKind =
  | 'runtime-error'
  | 'unhandled-rejection'
  | 'console-error'
  | 'console-warn'
  | 'csp-violation';

export type ConsoleEventLevel = 'error' | 'warn';

export interface ConsoleEvidenceEvent {
  id: string;
  kind: ConsoleEventKind;
  level?: ConsoleEventLevel;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  timestamp: string;
  firstSeen?: string;
  lastSeen?: string;
  count: number;
  truncated?: boolean;
}

export type NetworkOutcome = 'observed-resource' | 'success' | 'failure';

export interface NetworkEvidenceEvent {
  id: string;
  url: string;
  method?: string;
  status?: number;
  statusText?: string;
  initiatorType: string;
  duration: number;
  timestamp: string;
  firstSeen?: string;
  lastSeen?: string;
  outcome: NetworkOutcome;
  count: number;
  error?: string;
  responseBodySnippet?: string;
  truncated?: boolean;
}

export interface DebugSession {
  tabId: number;
  status: 'active' | 'stopped';
  startedAt: string;
  stoppedAt?: string;
  interruptedByNavigation?: boolean;
  consoleEvents: ConsoleEvidenceEvent[];
  networkEvents?: NetworkEvidenceEvent[];
  droppedConsoleCount?: number;
  droppedFailedNetworkCount?: number;
  droppedOtherNetworkCount?: number;
  excludedEvidenceIds?: string[];
}

export interface PageMetadata {
  url: string;
  title: string;
  capturedAt: string;
  browser?: string;
  platform?: string;
  viewport?: {
    width: number;
    height: number;
  };
  captureMode?: CaptureMode;
  diagnostics?: DiagnosticEvidence;
}

export interface BugReport {
  id: string;
  status: ReportStatus;
  title: string;
  severity: Severity;
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  additionalNotes: string;
  metadata: PageMetadata;
  screenshotDataUrl?: string;
  cropRegion?: CropRegion;
  annotatedScreenshotDataUrl?: string;
  annotations?: Annotation[];
  filenameStem?: string;
  debugSession?: DebugSession;
  sessionLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export type RetentionPeriod = 7 | 30 | 90;

export interface RetentionSettings {
  enabled: boolean;
  retentionDays: RetentionPeriod;
}

export interface ActiveEditLock {
  reportId: string;
  sessionId: string;
  lastHeartbeat: number;
}

export interface CleanupResult {
  success: boolean;
  enabled: boolean;
  retentionDays: RetentionPeriod;
  cutoffTimestamp: number;
  cleanedCount: number;
  skippedLockedCount: number;
  deletedIds: string[];
  errors: string[];
}
