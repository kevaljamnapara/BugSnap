import { CropRegion } from './types';

/**
 * Crops a base64 image data URL according to the specified pixel region.
 * Handles device pixel ratio adjustments and boundaries safely.
 */
export async function cropImageDataUrl(
  dataUrl: string,
  region: CropRegion,
): Promise<string> {
  if (!dataUrl || !region || region.width <= 0 || region.height <= 0) {
    return dataUrl;
  }

  // In non-browser / test environments without Image/Canvas, return dataUrl
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image for cropping.'));
    img.src = dataUrl;
    if (img.complete) {
      resolve();
    } else if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom')) {
      setTimeout(resolve, 0);
    }
  });

  const naturalWidth = img.naturalWidth || 800;
  const naturalHeight = img.naturalHeight || 600;
  const dpr = region.devicePixelRatio && region.devicePixelRatio > 0 ? region.devicePixelRatio : 1;

  // Scale CSS coordinates to image natural pixels
  const sx = Math.max(0, Math.min(naturalWidth, Math.round(region.x * dpr)));
  const sy = Math.max(0, Math.min(naturalHeight, Math.round(region.y * dpr)));
  const sw = Math.max(1, Math.min(naturalWidth - sx, Math.round(region.width * dpr)));
  const sh = Math.max(1, Math.min(naturalHeight - sy, Math.round(region.height * dpr)));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return dataUrl;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}
