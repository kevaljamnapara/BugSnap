export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type ReportStatus = 'draft' | 'saved';

export type AnnotationType = 'rectangle' | 'arrow' | 'text';

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

export type Annotation = RectangleAnnotation | ArrowAnnotation | TextAnnotation;

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
  annotatedScreenshotDataUrl?: string;
  annotations?: Annotation[];
  filenameStem?: string;
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
