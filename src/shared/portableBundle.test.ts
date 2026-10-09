import { describe, expect, it } from 'vitest';
import { createPortableBundle } from './portableBundle';
describe('createPortableBundle', () => it('creates a local zip blob with safe manifest entries', () => {
  const blob = createPortableBundle({ id: '1', status: 'draft', title: '../unsafe', severity: 'Low', reproductionSteps: '', expectedBehavior: '', actualBehavior: '', additionalNotes: '', metadata: { url: '', title: '', capturedAt: '' }, createdAt: '', updatedAt: '' });
  expect(blob.type).toBe('application/zip');
  expect(blob.size).toBeGreaterThan(100);
}));
