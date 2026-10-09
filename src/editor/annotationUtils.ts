import { Annotation } from '../shared/types';

/**
 * Converts display client coordinates on the rendered image element to image natural coordinates.
 */
export function displayToNaturalCoords(
  clientX: number,
  clientY: number,
  boundingRect: DOMRect,
  naturalWidth: number,
  naturalHeight: number,
): { x: number; y: number } {
  const safeClientX = typeof clientX === 'number' && !isNaN(clientX) ? clientX : 0;
  const safeClientY = typeof clientY === 'number' && !isNaN(clientY) ? clientY : 0;

  if (!boundingRect || boundingRect.width === 0 || boundingRect.height === 0) {
    return { x: 0, y: 0 };
  }
  const targetWidth = naturalWidth > 0 ? naturalWidth : 800;
  const targetHeight = naturalHeight > 0 ? naturalHeight : 600;

  const scaleX = targetWidth / boundingRect.width;
  const scaleY = targetHeight / boundingRect.height;
  return {
    x: Math.round(Math.max(0, Math.min(targetWidth, (safeClientX - boundingRect.left) * scaleX))),
    y: Math.round(Math.max(0, Math.min(targetHeight, (safeClientY - boundingRect.top) * scaleY))),
  };
}

/**
 * Renders annotations on top of an image onto an offscreen canvas and returns a high-res PNG data URL.
 */
export async function renderAnnotationsToDataUrl(
  imageSrc: string,
  annotations: Annotation[],
  naturalWidth: number,
  naturalHeight: number,
): Promise<string> {
  if (annotations.length === 0) {
    return imageSrc;
  }

  // Create image element to load the source
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image for annotation composite.'));
    img.src = imageSrc;
  });

  const width = naturalWidth || img.naturalWidth || 800;
  const height = naturalHeight || img.naturalHeight || 600;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported.');
  }

  // 1. Draw base screenshot
  ctx.drawImage(img, 0, 0, width, height);

  // 2. Draw each annotation in order
  for (const item of annotations) {
    if (item.type === 'rectangle') {
      ctx.strokeStyle = item.color || '#ef4444';
      ctx.lineWidth = item.strokeWidth || 4;
      ctx.strokeRect(item.x, item.y, item.width, item.height);
    } else if (item.type === 'ellipse') {
      ctx.strokeStyle = item.color || '#ef4444';
      ctx.lineWidth = item.strokeWidth || 4;
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(item.cx, item.cy, item.rx, item.ry, 0, 0, 2 * Math.PI);
      } else {
        ctx.arc(item.cx, item.cy, Math.max(item.rx, item.ry), 0, 2 * Math.PI);
      }
      ctx.stroke();
    } else if (item.type === 'arrow') {
      const strokeWidth = item.strokeWidth || 4;
      const color = item.color || '#ef4444';
      const angle = Math.atan2(item.endY - item.startY, item.endX - item.startX);
      const headLength = Math.max(16, strokeWidth * 3.5);

      // Arrow shaft
      ctx.beginPath();
      ctx.moveTo(item.startX, item.startY);
      ctx.lineTo(item.endX, item.endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(item.endX, item.endY);
      ctx.lineTo(
        item.endX - headLength * Math.cos(angle - Math.PI / 6),
        item.endY - headLength * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        item.endX - headLength * Math.cos(angle + Math.PI / 6),
        item.endY - headLength * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (item.type === 'text') {
      const fontSize = item.fontSize || 18;
      const color = item.color || '#38bdf8';
      ctx.font = `bold ${fontSize}px sans-serif`;
      const metrics = ctx.measureText(item.text);
      const padding = 6;

      // Draw dark backdrop pill for readability over any website background
      ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(
        item.x - padding,
        item.y - fontSize - padding,
        metrics.width + padding * 2,
        fontSize + padding * 2,
        4,
      );
      ctx.fill();
      ctx.stroke();

      // Draw text
      ctx.fillStyle = color;
      ctx.fillText(item.text, item.x, item.y);
    }
  }

  return canvas.toDataURL('image/png');
}
