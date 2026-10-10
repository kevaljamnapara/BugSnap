import React, { useState, useRef, useEffect, useCallback } from 'react';
import './AnnotationCanvas.css';
import {
  Annotation,
  AnnotationType,
  RectangleAnnotation,
  EllipseAnnotation,
  ArrowAnnotation,
  TextAnnotation,
} from '../shared/types';
import { displayToNaturalCoords, renderAnnotationsToDataUrl } from './annotationUtils';

export interface AnnotationCanvasProps {
  imageSrc: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onCompositeRendered?: (dataUrl: string) => void;
  onCopyScreenshot?: () => void;
  onCopyReport?: () => void;
  onExportReport?: () => void;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  imageSrc,
  annotations,
  onAnnotationsChange,
  onCompositeRendered,
  onExportReport,
}) => {
  const [activeTool, setActiveTool] = useState<AnnotationType | 'view'>('rectangle');
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStart, setCurrentStart] = useState<{ x: number; y: number } | null>(null);
  const [currentCurrent, setCurrentCurrent] = useState<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentStartRef = useRef<{ x: number; y: number } | null>(null);

  // Text label dialog state
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [textCoord, setTextCoord] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<string>('');

  // Clear confirmation modal state
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Handle image load to extract natural dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      const width = imageRef.current.naturalWidth || 800;
      const height = imageRef.current.naturalHeight || 600;
      setNaturalDimensions({ width, height });
    }
  };

  // Re-render composite whenever annotations or naturalDimensions change
  const renderComposite = useCallback(async () => {
    if (!onCompositeRendered || !imageSrc || naturalDimensions.width === 0) return;
    try {
      const composite = await renderAnnotationsToDataUrl(
        imageSrc,
        annotations,
        naturalDimensions.width,
        naturalDimensions.height,
      );
      onCompositeRendered(composite);
    } catch {
      // Fallback silently if canvas rendering is unsupported in environment
    }
  }, [imageSrc, annotations, naturalDimensions, onCompositeRendered]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // Pointer interactions for drawing
  const getPointerNaturalCoords = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return displayToNaturalCoords(
      e.clientX,
      e.clientY,
      rect,
      naturalDimensions.width || 800,
      naturalDimensions.height || 600,
    );
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'view') return;

    const coords = getPointerNaturalCoords(e);

    if (activeTool === 'text') {
      setTextCoord(coords);
      setTextInput('');
      setShowTextModal(true);
      return;
    }

    isDrawingRef.current = true;
    currentStartRef.current = coords;
    setIsDrawing(true);
    setCurrentStart(coords);
    setCurrentCurrent(coords);

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in test or unsupported environments
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current || !currentStartRef.current) return;
    const coords = getPointerNaturalCoords(e);
    setCurrentCurrent(coords);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current || !currentStartRef.current) return;
    const start = currentStartRef.current;
    const end = getPointerNaturalCoords(e);

    isDrawingRef.current = false;
    currentStartRef.current = null;
    setIsDrawing(false);

    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already released or unsupported
      }
    }

    const id = `annot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const strokeWidth = Math.max(3, Math.round(naturalDimensions.width / 350));

    if (activeTool === 'rectangle') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);

      // Only save if rect has non-trivial dimension
      if (width > 5 && height > 5) {
        const newRect: RectangleAnnotation = {
          id,
          type: 'rectangle',
          x,
          y,
          width,
          height,
          color: '#ef4444',
          strokeWidth,
        };
        setRedoStack([]);
        onAnnotationsChange([...annotations, newRect]);
      }
    } else if (activeTool === 'ellipse') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;

      if (rx > 3 && ry > 3) {
        const newEllipse: EllipseAnnotation = {
          id,
          type: 'ellipse',
          cx,
          cy,
          rx,
          ry,
          color: '#ef4444',
          strokeWidth,
        };
        setRedoStack([]);
        onAnnotationsChange([...annotations, newEllipse]);
      }
    } else if (activeTool === 'arrow') {
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (distance > 10) {
        const newArrow: ArrowAnnotation = {
          id,
          type: 'arrow',
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          color: '#ef4444',
          strokeWidth,
        };
        setRedoStack([]);
        onAnnotationsChange([...annotations, newArrow]);
      }
    }

    setCurrentStart(null);
    setCurrentCurrent(null);
  };

  // Add text label
  const handleAddText = () => {
    if (!textCoord || !textInput.trim()) {
      setShowTextModal(false);
      return;
    }

    const id = `annot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fontSize = Math.max(16, Math.round(naturalDimensions.width / 60));

    const newText: TextAnnotation = {
      id,
      type: 'text',
      x: textCoord.x,
      y: textCoord.y,
      text: textInput.trim(),
      color: '#38bdf8',
      fontSize,
    };

    onAnnotationsChange([...annotations, newText]);
    setShowTextModal(false);
    setTextCoord(null);
    setTextInput('');
  };

  // Undo, Redo, and Clear
  const handleUndo = () => {
    if (annotations.length === 0) return;
    const last = annotations[annotations.length - 1];
    setRedoStack((prev) => [...prev, last]);
    onAnnotationsChange(annotations.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    onAnnotationsChange([...annotations, next]);
  };

  const handleConfirmClear = () => {
    setRedoStack([]);
    onAnnotationsChange([]);
    setShowClearConfirm(false);
  };

  const width = naturalDimensions.width || 800;
  const height = naturalDimensions.height || 600;

  return (
    <div className="annotation-container" data-testid="annotation-container">
      {/* Toolbar */}
      <div className="annotation-toolbar" role="toolbar" aria-label="Annotation tools">
        <div className="toolbar-group">
          <button
            type="button"
            className={`tool-btn ${activeTool === 'view' ? 'tool-btn-active' : ''}`}
            onClick={() => setActiveTool('view')}
            aria-pressed={activeTool === 'view'}
            data-testid="tool-btn-view"
            title="Preview without drawing"
          >
            Preview
          </button>
          <button
            type="button"
            className={`tool-btn ${activeTool === 'rectangle' ? 'tool-btn-active' : ''}`}
            onClick={() => setActiveTool('rectangle')}
            aria-pressed={activeTool === 'rectangle'}
            data-testid="tool-btn-rectangle"
            title="Draw rectangle annotation"
          >
            Rectangle
          </button>
          <button
            type="button"
            className={`tool-btn ${activeTool === 'ellipse' ? 'tool-btn-active' : ''}`}
            onClick={() => setActiveTool('ellipse')}
            aria-pressed={activeTool === 'ellipse'}
            data-testid="tool-btn-ellipse"
            title="Draw ellipse annotation"
          >
            Ellipse
          </button>
          <button
            type="button"
            className={`tool-btn ${activeTool === 'arrow' ? 'tool-btn-active' : ''}`}
            onClick={() => setActiveTool('arrow')}
            aria-pressed={activeTool === 'arrow'}
            data-testid="tool-btn-arrow"
            title="Draw arrow annotation"
          >
            Arrow
          </button>
          <button
            type="button"
            className={`tool-btn ${activeTool === 'text' ? 'tool-btn-active' : ''}`}
            onClick={() => setActiveTool('text')}
            aria-pressed={activeTool === 'text'}
            data-testid="tool-btn-text"
            title="Click screenshot to add text label"
          >
            Text Label
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="tool-btn"
            onClick={handleUndo}
            disabled={annotations.length === 0}
            data-testid="tool-btn-undo"
            title="Undo last annotation"
          >
            Undo
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            data-testid="tool-btn-redo"
            title="Redo annotation"
          >
            Redo
          </button>
          <button
            type="button"
            className="tool-btn tool-btn-danger"
            onClick={() => setShowClearConfirm(true)}
            disabled={annotations.length === 0}
            data-testid="tool-btn-clear"
            title="Clear all annotations"
          >
            Clear All
          </button>
        </div>

        {onExportReport && (
          <div className="toolbar-group toolbar-group-actions">
            <button
              type="button"
              className="tool-btn tool-btn-action tool-btn-accent"
              onClick={onExportReport}
              data-testid="canvas-export-btn"
              title="Download Markdown report and screenshot evidence"
            >
              Export
            </button>
          </div>
        )}
      </div>

      {/* Stage: Base Image + Interactive SVG Overlay */}
      <div className="annotation-stage" data-testid="annotation-stage">
        <div className="stage-wrapper">
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Screenshot evidence for annotation"
            className="stage-image"
            onLoad={handleImageLoad}
            data-testid="screenshot-img"
          />

          <svg
            ref={svgRef}
            className={`stage-svg-overlay ${activeTool === 'view' ? 'cursor-default' : ''}`}
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            data-testid="annotation-svg-overlay"
          >
            <defs>
              <marker
                id="svg-arrowhead"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Existing Annotations */}
            {annotations.map((item) => {
              if (item.type === 'rectangle') {
                return (
                  <rect
                    key={item.id}
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    stroke={item.color || '#ef4444'}
                    strokeWidth={item.strokeWidth || 4}
                    fill="transparent"
                  />
                );
              }
              if (item.type === 'ellipse') {
                return (
                  <ellipse
                    key={item.id}
                    cx={item.cx}
                    cy={item.cy}
                    rx={item.rx}
                    ry={item.ry}
                    stroke={item.color || '#ef4444'}
                    strokeWidth={item.strokeWidth || 4}
                    fill="transparent"
                  />
                );
              }
              if (item.type === 'arrow') {
                return (
                  <line
                    key={item.id}
                    x1={item.startX}
                    y1={item.startY}
                    x2={item.endX}
                    y2={item.endY}
                    stroke={item.color || '#ef4444'}
                    strokeWidth={item.strokeWidth || 4}
                    strokeLinecap="round"
                    markerEnd="url(#svg-arrowhead)"
                  />
                );
              }
              if (item.type === 'text') {
                const fontSize = item.fontSize || 18;
                return (
                  <g key={item.id}>
                    <rect
                      x={item.x - 6}
                      y={item.y - fontSize - 6}
                      width={item.text.length * (fontSize * 0.6) + 12}
                      height={fontSize + 12}
                      rx="4"
                      fill="rgba(11, 15, 25, 0.85)"
                      stroke="rgba(56, 189, 248, 0.4)"
                      strokeWidth="1"
                    />
                    <text
                      x={item.x}
                      y={item.y}
                      fill={item.color || '#38bdf8'}
                      fontSize={fontSize}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      {item.text}
                    </text>
                  </g>
                );
              }
              return null;
            })}

            {/* In-progress drawing preview */}
            {isDrawing && currentStart && currentCurrent && activeTool === 'rectangle' && (
              <rect
                x={Math.min(currentStart.x, currentCurrent.x)}
                y={Math.min(currentStart.y, currentCurrent.y)}
                width={Math.abs(currentCurrent.x - currentStart.x)}
                height={Math.abs(currentCurrent.y - currentStart.y)}
                stroke="#ef4444"
                strokeWidth={Math.max(3, Math.round(width / 350))}
                fill="transparent"
                strokeDasharray="4 4"
              />
            )}

            {isDrawing && currentStart && currentCurrent && activeTool === 'ellipse' && (
              <ellipse
                cx={(currentStart.x + currentCurrent.x) / 2}
                cy={(currentStart.y + currentCurrent.y) / 2}
                rx={Math.abs(currentCurrent.x - currentStart.x) / 2}
                ry={Math.abs(currentCurrent.y - currentStart.y) / 2}
                stroke="#ef4444"
                strokeWidth={Math.max(3, Math.round(width / 350))}
                fill="transparent"
                strokeDasharray="4 4"
              />
            )}

            {isDrawing && currentStart && currentCurrent && activeTool === 'arrow' && (
              <line
                x1={currentStart.x}
                y1={currentStart.y}
                x2={currentCurrent.x}
                y2={currentCurrent.y}
                stroke="#ef4444"
                strokeWidth={Math.max(3, Math.round(width / 350))}
                strokeDasharray="4 4"
                markerEnd="url(#svg-arrowhead)"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="clear-confirm-modal">
          <div className="modal-dialog">
            <h3 className="modal-title" style={{ color: '#f87171' }}>
              Clear all annotations?
            </h3>
            <p className="modal-body">
              This will remove all rectangle, arrow, and text markings from the screenshot.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowClearConfirm(false)}
                data-testid="cancel-clear-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmClear}
                data-testid="confirm-clear-btn"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Label Input Popover Modal */}
      {showTextModal && (
        <div className="text-input-dialog-overlay" role="dialog" aria-modal="true" data-testid="text-modal">
          <div className="text-input-dialog">
            <h4>Add Text Annotation</h4>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Broken button alignment"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText();
                if (e.key === 'Escape') setShowTextModal(false);
              }}
              autoFocus
              data-testid="text-annotation-input"
            />
            <div className="text-input-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTextModal(false)}
                data-testid="cancel-text-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAddText}
                disabled={!textInput.trim()}
                data-testid="confirm-text-btn"
              >
                Add Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
