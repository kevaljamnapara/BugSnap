import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSelectionOverlay } from '../../src/content/selectionOverlay';

describe('selectionOverlay — in-page region capture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the selection overlay with banner, selection box, and dimensions badge', () => {
    const overlay = initSelectionOverlay();
    expect(overlay).toBeInTheDocument();
    expect(document.getElementById('bugsnap-selection-overlay')).toBeInTheDocument();
    expect(document.getElementById('bugsnap-overlay-banner')).toHaveTextContent(/Drag to select area/i);
    expect(document.getElementById('bugsnap-selection-box')).toBeInTheDocument();
    expect(document.getElementById('bugsnap-dimensions-badge')).toBeInTheDocument();
  });

  it('removes pre-existing overlay when initialized again', () => {
    initSelectionOverlay();
    expect(document.querySelectorAll('#bugsnap-selection-overlay').length).toBe(1);

    initSelectionOverlay();
    expect(document.querySelectorAll('#bugsnap-selection-overlay').length).toBe(1);
  });

  it('updates selection box and dimension badge during drag and captures immediately on mouseup', () => {
    const onCapture = vi.fn();
    const overlay = initSelectionOverlay({ onCapture });
    const box = document.getElementById('bugsnap-selection-box')!;
    const badge = document.getElementById('bugsnap-dimensions-badge')!;

    // Start drag at (100, 100)
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    expect(box.style.display).toBe('block');

    // Drag to (350, 250) -> width 250, height 150
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 250, bubbles: true }));
    expect(box.style.width).toBe('250px');
    expect(box.style.height).toBe('150px');
    expect(badge.textContent).toBe('250 × 150 px');

    // Mouse up immediately captures without an extra confirmation button
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 250, bubbles: true }));
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(document.getElementById('bugsnap-action-bar')).not.toBeInTheDocument();
  });

  it('cancels drag if area is smaller than 10x10 px and does not capture', () => {
    const onCapture = vi.fn();
    const overlay = initSelectionOverlay({ onCapture });
    const box = document.getElementById('bugsnap-selection-box')!;

    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 104, clientY: 104, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 104, clientY: 104, bubbles: true }));

    expect(box.style.display).toBe('none');
    expect(onCapture).not.toHaveBeenCalled();
    expect(document.getElementById('bugsnap-selection-overlay')).toBeInTheDocument();
  });

  it('cleans up and calls onCancel when banner Cancel button is clicked', () => {
    const onCancel = vi.fn();
    initSelectionOverlay({ onCancel });

    const cancelBtn = document.getElementById('bugsnap-cancel-action-btn')!;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.getElementById('bugsnap-selection-overlay')).not.toBeInTheDocument();
  });

  it('cleans up and calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    initSelectionOverlay({ onCancel });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.getElementById('bugsnap-selection-overlay')).not.toBeInTheDocument();
  });

  it('triggers onCapture with region and safe diagnostics immediately on mouseup', () => {
    const onCapture = vi.fn();
    const overlay = initSelectionOverlay({ onCapture });

    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 60, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 260, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 250, clientY: 260, bubbles: true }));

    expect(onCapture).toHaveBeenCalledTimes(1);
    const capturedRegion = onCapture.mock.calls[0][0];
    expect(capturedRegion).toEqual({
      x: 50,
      y: 60,
      width: 200,
      height: 200,
      devicePixelRatio: 1,
    });
    expect(document.getElementById('bugsnap-selection-overlay')).not.toBeInTheDocument();
  });

  it('prevents duplicate capture calls on repeated events', () => {
    const onCapture = vi.fn();
    const overlay = initSelectionOverlay({ onCapture });

    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 60, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 260, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 250, clientY: 260, bubbles: true }));

    // Second mouseup or keydown shouldn't trigger duplicate capture
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 250, clientY: 260, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onCapture).toHaveBeenCalledTimes(1);
  });
});
