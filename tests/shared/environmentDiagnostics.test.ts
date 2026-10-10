import { describe, expect, it } from 'vitest';
import { buildEnvironmentDiagnostics } from '../../src/shared/environmentDiagnostics';

describe('buildEnvironmentDiagnostics', () => {
  it('formats available context and marks missing values without fabrication', () => {
    const rows = buildEnvironmentDiagnostics({ url: 'https://example.test/?token=secret', title: '', capturedAt: '2026-01-01T00:00:00Z', viewport: { width: 1200, height: 800 } });
    expect(rows.find((row) => row.label === 'Page URL')?.value).toContain('[redacted]');
    expect(rows.find((row) => row.label === 'Page title')).toMatchObject({ value: 'Unavailable', available: false });
  });
});
