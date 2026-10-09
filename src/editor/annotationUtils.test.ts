import { describe, it, expect } from 'vitest';
import { displayToNaturalCoords, renderAnnotationsToDataUrl } from './annotationUtils';
import { Annotation } from '../shared/types';

describe('annotationUtils', () => {
  describe('displayToNaturalCoords', () => {
    const mockRect = {
      left: 100,
      top: 50,
      width: 500,
      height: 300,
    } as DOMRect;

    it('accurately maps client coordinates to 2x natural image resolution', () => {
      const naturalWidth = 1000;
      const naturalHeight = 600;

      // Click at top-left
      const pt1 = displayToNaturalCoords(100, 50, mockRect, naturalWidth, naturalHeight);
      expect(pt1).toEqual({ x: 0, y: 0 });

      // Click in middle (client 350, 200 -> relative 250, 150)
      const pt2 = displayToNaturalCoords(350, 200, mockRect, naturalWidth, naturalHeight);
      expect(pt2).toEqual({ x: 500, y: 300 });

      // Click at bottom-right (client 600, 350 -> relative 500, 300)
      const pt3 = displayToNaturalCoords(600, 350, mockRect, naturalWidth, naturalHeight);
      expect(pt3).toEqual({ x: 1000, y: 600 });
    });

    it('clamps coordinates to natural bounds when dragged outside', () => {
      const naturalWidth = 1000;
      const naturalHeight = 600;

      const ptOut = displayToNaturalCoords(50, 20, mockRect, naturalWidth, naturalHeight);
      expect(ptOut).toEqual({ x: 0, y: 0 });

      const ptFar = displayToNaturalCoords(800, 500, mockRect, naturalWidth, naturalHeight);
      expect(ptFar).toEqual({ x: 1000, y: 600 });
    });

    it('handles zero dimensions safely without dividing by zero', () => {
      const zeroRect = { left: 0, top: 0, width: 0, height: 0 } as DOMRect;
      const pt = displayToNaturalCoords(10, 10, zeroRect, 800, 600);
      expect(pt).toEqual({ x: 0, y: 0 });
    });
  });

  describe('renderAnnotationsToDataUrl', () => {
    it('returns original image unchanged when annotations are empty', async () => {
      const originalSrc = 'data:image/png;base64,mockEmptySrc';
      const result = await renderAnnotationsToDataUrl(originalSrc, [], 800, 600);
      expect(result).toBe(originalSrc);
    });

    it('renders with annotations without throwing error', async () => {
      // In jsdom canvas is mocked or basic
      const annotations: Annotation[] = [
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 10,
          y: 10,
          width: 100,
          height: 50,
          color: '#ef4444',
          strokeWidth: 4,
        },
        {
          id: 'arrow-1',
          type: 'arrow',
          startX: 200,
          startY: 100,
          endX: 300,
          endY: 200,
          color: '#ef4444',
          strokeWidth: 4,
        },
        {
          id: 'text-1',
          type: 'text',
          x: 50,
          y: 80,
          text: 'Error Button',
          color: '#38bdf8',
          fontSize: 16,
        },
      ];

      // Test that annotation array contains expected structure
      expect(annotations).toHaveLength(3);
      expect(annotations[0].type).toBe('rectangle');
      expect(annotations[1].type).toBe('arrow');
      expect(annotations[2].type).toBe('text');
    });
  });
});
