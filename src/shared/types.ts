export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type ReportStatus = 'draft' | 'saved';

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
  filenameStem?: string;
  createdAt: string;
  updatedAt: string;
}
