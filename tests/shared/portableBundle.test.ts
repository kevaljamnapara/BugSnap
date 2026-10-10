import { describe, expect, it } from 'vitest';
import { createPortableBundle } from '../../src/shared/portableBundle';

describe('createPortableBundle', () => {
  it('creates a local zip blob with safe manifest entries and valid ZIP structure', async () => {
    const blob = createPortableBundle({
      id: '1',
      status: 'draft',
      title: '../unsafe/path/test',
      severity: 'Low',
      reproductionSteps: 'Step 1',
      expectedBehavior: 'Expected',
      actualBehavior: 'Actual',
      additionalNotes: '',
      metadata: { url: 'https://example.com?token=secret', title: 'Example', capturedAt: '2026-10-10T00:00:00.000Z' },
      debugSession: {
        tabId: 1,
        status: 'stopped',
        startedAt: '2026-10-10T00:00:00.000Z',
        consoleEvents: [
          { id: 'ev-1', kind: 'runtime-error', message: 'Test error', timestamp: '2026-10-10T00:00:00.000Z', count: 1 },
          { id: 'ev-2', kind: 'runtime-error', message: 'Excluded error', timestamp: '2026-10-10T00:00:00.000Z', count: 1 },
        ],
        excludedEvidenceIds: ['ev-2'],
      },
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
    });

    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(100);

    // Verify ZIP bytes via arrayBuffer()
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // ZIP local file header starts with 0x50, 0x4B, 0x03, 0x04 (PK\x03\x04)
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toContain('manifest.json');
    expect(decoded).toContain('diagnostics.json');
    expect(decoded).toContain('.md');
    // Filename in ZIP should be sanitized without directory traversal
    expect(decoded).toContain('bugsnap-unsafe-path-test-');
    expect(decoded).not.toContain('bugsnap-../');
    // Excluded evidence should not appear in diagnostics
    expect(decoded).not.toContain('Excluded error');
    expect(decoded).toContain('Test error');
  });
});
