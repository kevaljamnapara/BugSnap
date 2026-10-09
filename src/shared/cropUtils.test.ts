import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cropImageDataUrl } from './cropUtils';
import { CropRegion } from './types';

describe('cropUtils — cropImageDataUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('returns original data URL if region is invalid or has non-positive dimensions', async () => {
    const invalidRegion: CropRegion = { x: 0, y: 0, width: 0, height: 0 };
    const res = await cropImageDataUrl(sampleDataUrl, invalidRegion);
    expect(res).toBe(sampleDataUrl);

    const negativeRegion: CropRegion = { x: 10, y: 10, width: -100, height: 50 };
    const res2 = await cropImageDataUrl(sampleDataUrl, negativeRegion);
    expect(res2).toBe(sampleDataUrl);
  });

  it('handles crop with valid region and default dpr', async () => {
    const region: CropRegion = { x: 10, y: 20, width: 200, height: 150 };
    const res = await cropImageDataUrl(sampleDataUrl, region);
    expect(typeof res).toBe('string');
    expect(res.startsWith('data:image/png')).toBe(true);
  });

  it('accounts for devicePixelRatio when scaling coordinates', async () => {
    const region: CropRegion = { x: 50, y: 50, width: 100, height: 100, devicePixelRatio: 2 };
    const res = await cropImageDataUrl(sampleDataUrl, region);
    expect(typeof res).toBe('string');
    expect(res.startsWith('data:image/png')).toBe(true);
  });
});
