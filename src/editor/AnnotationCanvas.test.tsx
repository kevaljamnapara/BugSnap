import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnnotationCanvas } from './AnnotationCanvas';
import { Annotation } from '../shared/types';

describe('AnnotationCanvas Component', () => {
  const mockImageSrc = 'data:image/png;base64,mockBase64Screenshot';

  // jsdom does not define PointerEvent, causing clientX/clientY to be dropped by fireEvent
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }

  const mockAnnotations: Annotation[] = [
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
      startX: 50,
      startY: 50,
      endX: 150,
      endY: 150,
      color: '#ef4444',
      strokeWidth: 4,
    },
    {
      id: 'text-1',
      type: 'text',
      x: 80,
      y: 80,
      text: 'Visual Bug',
      color: '#38bdf8',
      fontSize: 18,
    },
  ];

  it('renders all annotation toolbar controls with proper accessible attributes', () => {
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('toolbar', { name: /annotation tools/i })).toBeInTheDocument();
    expect(screen.getByTestId('tool-btn-view')).toBeInTheDocument();
    expect(screen.getByTestId('tool-btn-rectangle')).toBeInTheDocument();
    expect(screen.getByTestId('tool-btn-ellipse')).toBeInTheDocument();
    expect(screen.getByTestId('tool-btn-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('tool-btn-text')).toBeInTheDocument();

    // Default tool is rectangle
    expect(screen.getByTestId('tool-btn-rectangle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-btn-ellipse')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('tool-btn-arrow')).toHaveAttribute('aria-pressed', 'false');

    // Undo, Redo & Clear disabled when empty
    expect(screen.getByTestId('tool-btn-undo')).toBeDisabled();
    expect(screen.getByTestId('tool-btn-redo')).toBeDisabled();
    expect(screen.getByTestId('tool-btn-clear')).toBeDisabled();
  });

  it('switches to ellipse tool when clicked', () => {
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={vi.fn()}
      />,
    );

    const ellipseBtn = screen.getByTestId('tool-btn-ellipse');
    fireEvent.click(ellipseBtn);

    expect(ellipseBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-btn-rectangle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches active tools when buttons are clicked', () => {
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={vi.fn()}
      />,
    );

    const arrowBtn = screen.getByTestId('tool-btn-arrow');
    fireEvent.click(arrowBtn);

    expect(arrowBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-btn-rectangle')).toHaveAttribute('aria-pressed', 'false');

    const viewBtn = screen.getByTestId('tool-btn-view');
    fireEvent.click(viewBtn);

    expect(viewBtn).toHaveAttribute('aria-pressed', 'true');
    expect(arrowBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders existing annotations in the SVG overlay', () => {
    const { container } = render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={mockAnnotations}
        onAnnotationsChange={vi.fn()}
      />,
    );

    const svg = screen.getByTestId('annotation-svg-overlay');
    expect(svg).toBeInTheDocument();

    // Contains rect, line (arrow), and text
    const rects = container.querySelectorAll('svg rect');
    const lines = container.querySelectorAll('svg line');
    const texts = container.querySelectorAll('svg text');

    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Visual Bug')).toBeInTheDocument();
  });

  it('undo removes the most recent annotation', () => {
    const handleAnnotationsChange = vi.fn();
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={mockAnnotations}
        onAnnotationsChange={handleAnnotationsChange}
      />,
    );

    const undoBtn = screen.getByTestId('tool-btn-undo');
    expect(undoBtn).not.toBeDisabled();

    fireEvent.click(undoBtn);

    expect(handleAnnotationsChange).toHaveBeenCalledTimes(1);
    // Slice of length 2
    expect(handleAnnotationsChange).toHaveBeenCalledWith(mockAnnotations.slice(0, 2));
  });

  it('opens confirmation modal before clearing all annotations', () => {
    const handleAnnotationsChange = vi.fn();
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={mockAnnotations}
        onAnnotationsChange={handleAnnotationsChange}
      />,
    );

    const clearBtn = screen.getByTestId('tool-btn-clear');
    fireEvent.click(clearBtn);

    // Confirmation modal appears
    expect(screen.getByTestId('clear-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/Clear all annotations\?/i)).toBeInTheDocument();

    // Cancel preserves annotations
    fireEvent.click(screen.getByTestId('cancel-clear-btn'));
    expect(screen.queryByTestId('clear-confirm-modal')).not.toBeInTheDocument();
    expect(handleAnnotationsChange).not.toHaveBeenCalled();

    // Open again and confirm
    fireEvent.click(clearBtn);
    fireEvent.click(screen.getByTestId('confirm-clear-btn'));

    expect(handleAnnotationsChange).toHaveBeenCalledWith([]);
    expect(screen.queryByTestId('clear-confirm-modal')).not.toBeInTheDocument();
  });

  it('allows adding a text label annotation via popup modal', () => {
    const handleAnnotationsChange = vi.fn();
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={handleAnnotationsChange}
      />,
    );

    // Select text tool
    fireEvent.click(screen.getByTestId('tool-btn-text'));
    expect(screen.getByTestId('tool-btn-text')).toHaveAttribute('aria-pressed', 'true');

    // Click on SVG overlay to place text
    const svg = screen.getByTestId('annotation-svg-overlay');
    // Mock getBoundingClientRect
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.pointerDown(svg, { clientX: 200, clientY: 150, pointerId: 1 });

    // Text modal pops up
    expect(screen.getByTestId('text-modal')).toBeInTheDocument();
    const input = screen.getByTestId('text-annotation-input');

    // Type text
    fireEvent.change(input, { target: { value: 'Broken Cart Icon' } });

    // Confirm
    fireEvent.click(screen.getByTestId('confirm-text-btn'));

    expect(handleAnnotationsChange).toHaveBeenCalledTimes(1);
    const addedList = handleAnnotationsChange.mock.calls[0][0];
    expect(addedList).toHaveLength(1);
    expect(addedList[0].type).toBe('text');
    expect(addedList[0].text).toBe('Broken Cart Icon');
  });

  it('creates rectangle annotation on pointer drag', () => {
    const handleAnnotationsChange = vi.fn();
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={handleAnnotationsChange}
      />,
    );

    const svg = screen.getByTestId('annotation-svg-overlay');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Drag from (50, 50) to (150, 120)
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 150, clientY: 120, pointerId: 1 });

    expect(handleAnnotationsChange).toHaveBeenCalledTimes(1);
    const result = handleAnnotationsChange.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('rectangle');
    expect(result[0].width).toBe(100);
    expect(result[0].height).toBe(70);
  });

  it('creates arrow annotation on pointer drag', () => {
    const handleAnnotationsChange = vi.fn();
    render(
      <AnnotationCanvas
        imageSrc={mockImageSrc}
        annotations={[]}
        onAnnotationsChange={handleAnnotationsChange}
      />,
    );

    // Switch to arrow tool
    fireEvent.click(screen.getByTestId('tool-btn-arrow'));

    const svg = screen.getByTestId('annotation-svg-overlay');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Drag arrow from (100, 100) to (200, 200)
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 200, clientY: 200, pointerId: 1 });

    expect(handleAnnotationsChange).toHaveBeenCalledTimes(1);
    const result = handleAnnotationsChange.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('arrow');
    expect(result[0].startX).toBe(100);
    expect(result[0].startY).toBe(100);
    expect(result[0].endX).toBe(200);
    expect(result[0].endY).toBe(200);
  });
});
