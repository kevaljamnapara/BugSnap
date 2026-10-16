import { PageMetadata } from './types';
import { sanitizeEvidenceUrl } from './evidenceSanitizer';

export interface EnvironmentDiagnostic {
  label: string;
  value: string;
  available: boolean;
}

export function buildEnvironmentDiagnostics(metadata: PageMetadata): EnvironmentDiagnostic[] {
  const viewport = metadata.viewport ? `${metadata.viewport.width}×${metadata.viewport.height}` : 'Unavailable';
  return [
    { label: 'Page URL', value: metadata.url ? sanitizeEvidenceUrl(metadata.url) : 'Unavailable', available: Boolean(metadata.url) },
    { label: 'Page title', value: metadata.title || 'Unavailable', available: Boolean(metadata.title) },
    { label: 'Captured', value: metadata.capturedAt || 'Unavailable', available: Boolean(metadata.capturedAt) },
    { label: 'Viewport', value: viewport, available: Boolean(metadata.viewport) },
    { label: 'Platform', value: metadata.platform || 'Unavailable', available: Boolean(metadata.platform) },
  ];
}
