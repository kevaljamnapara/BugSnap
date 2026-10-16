import { CropRegion, DiagnosticEvidence } from '../shared/types';

export interface SelectionOverlayOptions {
  onCapture?: (region: CropRegion, diagnostics?: DiagnosticEvidence) => void;
  onCancel?: () => void;
}

/**
 * In-page selection overlay for custom region screenshot capture.
 * Self-contained, injected via chrome.scripting.executeScript.
 */
export function initSelectionOverlay(options?: SelectionOverlayOptions): HTMLElement {
  // 1. Remove any pre-existing overlay
  const existing = document.getElementById('bugsnap-selection-overlay');
  if (existing) {
    existing.remove();
  }

  // 2. Create main container
  const overlay = document.createElement('div');
  overlay.id = 'bugsnap-selection-overlay';
  overlay.setAttribute('data-testid', 'bugsnap-selection-overlay');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    userSelect: 'none',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0',
  });

  // 3. Top guidance banner with Cancel button
  const banner = document.createElement('div');
  banner.id = 'bugsnap-overlay-banner';
  banner.setAttribute('data-testid', 'selection-banner');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#0f172a',
    color: '#38bdf8',
    border: '1px solid #334155',
    borderRadius: '9999px',
    padding: '6px 16px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
    zIndex: '2147483648',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  });

  const bannerText = document.createElement('span');
  bannerText.textContent = '🎯 Drag to select area • Release to capture';
  banner.appendChild(bannerText);

  const bannerCancelBtn = document.createElement('button');
  bannerCancelBtn.id = 'bugsnap-cancel-action-btn';
  bannerCancelBtn.setAttribute('data-testid', 'selection-cancel-btn');
  bannerCancelBtn.type = 'button';
  bannerCancelBtn.textContent = 'Cancel (Esc)';
  Object.assign(bannerCancelBtn.style, {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #475569',
    borderRadius: '9999px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  banner.appendChild(bannerCancelBtn);
  overlay.appendChild(banner);

  // 4. Selection box
  const selectionBox = document.createElement('div');
  selectionBox.id = 'bugsnap-selection-box';
  selectionBox.setAttribute('data-testid', 'selection-box');
  Object.assign(selectionBox.style, {
    position: 'absolute',
    border: '2px dashed #00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    boxShadow: '0 0 12px rgba(0, 240, 255, 0.3)',
    boxSizing: 'border-box',
    display: 'none',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  overlay.appendChild(selectionBox);

  // 5. Live dimensions badge
  const dimensionsBadge = document.createElement('div');
  dimensionsBadge.id = 'bugsnap-dimensions-badge';
  dimensionsBadge.setAttribute('data-testid', 'selection-dimensions-badge');
  Object.assign(dimensionsBadge.style, {
    position: 'absolute',
    backgroundColor: '#0f172a',
    color: '#00f0ff',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '3px 7px',
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    display: 'none',
    pointerEvents: 'none',
    zIndex: '2147483648',
  });
  overlay.appendChild(dimensionsBadge);

  // State
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentRegion: CropRegion | null = null;

  const cleanup = () => {
    window.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
  };

  const handleCancel = () => {
    cleanup();
    if (options?.onCancel) {
      options.onCancel();
    }
  };

  const collectDiagnostics = (): DiagnosticEvidence => {
    const timings: Array<{ name: string; initiatorType: string; duration: number; transferSize?: number }> = [];
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      try {
        const entries = performance.getEntriesByType('resource').slice(-25);
        for (const entry of entries) {
          const res = entry as PerformanceResourceTiming;
          let safeUrl = res.name || '';
          try {
            const parsed = new URL(res.name);
            const sensitiveKeys = ['token', 'auth', 'key', 'password', 'secret', 'access_token', 'apikey', 'session'];
            for (const key of sensitiveKeys) {
              if (parsed.searchParams.has(key)) {
                parsed.searchParams.set(key, '[REDACTED]');
              }
            }
            safeUrl = parsed.toString();
          } catch {
            // retain safe fallback
          }
          timings.push({
            name: safeUrl,
            initiatorType: res.initiatorType || 'other',
            duration: Math.round(res.duration || 0),
            transferSize: res.transferSize,
          });
        }
      } catch {
        // Safe fallback
      }
    }
    return { resourceTimings: timings };
  };

  let isCapturing = false;

  const handleCapture = () => {
    if (isCapturing) return;
    if (!currentRegion || currentRegion.width < 10 || currentRegion.height < 10) {
      return;
    }
    isCapturing = true;

    // Immediately hide overlay so it does not appear in the screenshot
    overlay.style.display = 'none';
    cleanup();

    const diagnostics = collectDiagnostics();

    // Handoff to options callback if provided (e.g. in test environment)
    if (options?.onCapture) {
      options.onCapture(currentRegion, diagnostics);
    }

    // Dispatch message to extension background worker
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      try {
        chrome.runtime.sendMessage({
          type: 'BUGSNAP_REGION_CAPTURED',
          region: currentRegion,
          metadata: {
            url: window.location.href,
            title: document.title,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            diagnostics,
          },
        });
      } catch {
        // Graceful handle in disconnected contexts
      }
    }
  };

  // Dragging event handlers
  overlay.addEventListener('mousedown', (e: MouseEvent) => {
    // If user clicked inside the banner (e.g. Cancel button), do not start dragging
    if (banner.contains(e.target as Node)) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    currentRegion = null;

    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';

    dimensionsBadge.style.display = 'block';
    dimensionsBadge.style.left = `${startX}px`;
    dimensionsBadge.style.top = `${Math.max(10, startY - 26)}px`;
    dimensionsBadge.textContent = '0 × 0 px';
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    dimensionsBadge.style.left = `${x}px`;
    dimensionsBadge.style.top = `${Math.max(10, y - 26)}px`;
    dimensionsBadge.textContent = `${Math.round(width)} × ${Math.round(height)} px`;

    currentRegion = {
      x,
      y,
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;

    // Immediately capture valid selections without requiring an extra confirmation button
    if (currentRegion && currentRegion.width >= 10 && currentRegion.height >= 10) {
      handleCapture();
    } else {
      selectionBox.style.display = 'none';
      dimensionsBadge.style.display = 'none';
      currentRegion = null;
    }
  });

  // Banner cancel button listener
  bannerCancelBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    handleCancel();
  });

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentRegion && currentRegion.width >= 10 && currentRegion.height >= 10) {
        handleCapture();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  document.body.appendChild(overlay);
  return overlay;
}
