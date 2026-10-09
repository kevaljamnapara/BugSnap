import React, { useState } from 'react';
import './Popup.css';
import { APP_NAME, APP_VERSION } from '../shared/constants';
import { captureActiveTab } from './captureService';
import { CaptureMode } from '../shared/types';

export const Popup: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeMode, setActiveMode] = useState<CaptureMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapture = async (mode: CaptureMode = 'viewport') => {
    if (isCapturing) {
      return; // Prevent duplicate clicks
    }

    setIsCapturing(true);
    setActiveMode(mode);
    setErrorMessage(null);

    try {
      const result = await captureActiveTab(mode);
      if (!result.success) {
        setErrorMessage(result.error || 'An unexpected error occurred during capture.');
      } else {
        // Close popup window upon successful handoff
        if (typeof window !== 'undefined' && typeof window.close === 'function') {
          window.close();
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCapturing(false);
      setActiveMode(null);
    }
  };

  const handleStartDebugSession = async () => {
    setIsCapturing(true);
    setErrorMessage(null);
    const result = await captureActiveTab('viewport');
    if (!result.success || !result.draft || result.tabId === undefined) {
      setErrorMessage(result.error || 'Unable to start a debugging session.');
      setIsCapturing(false);
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BUGSNAP_START_CONSOLE_SESSION', reportId: result.draft.id, tabId: result.tabId,
      });
      if (!response?.success) setErrorMessage(response?.error || 'The debugging session could not start.');
    } catch (error) {
      setErrorMessage(`The debugging session could not start: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleOpenEditor = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    } else {
      window.open('/editor.html', '_blank');
    }
  };

  const handleDismissError = () => {
    setErrorMessage(null);
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="popup-title-wrapper">
          <span className="popup-logo-icon">📸</span>
          <h1 className="popup-title">{APP_NAME}</h1>
        </div>
        <span className="popup-badge">v{APP_VERSION}</span>
      </header>

      <p className="popup-subtitle">
        Fast visual debugging & evidence capture
      </p>

      {errorMessage && (
        <div className="popup-error" data-testid="error-banner" role="alert">
          <div className="popup-error-header">Capture Failed</div>
          <div className="popup-error-body">{errorMessage}</div>
          <div className="popup-error-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleCapture(activeMode || 'viewport')}
              disabled={isCapturing}
              data-testid="retry-capture-btn"
            >
              {isCapturing ? 'Retrying...' : 'Retry Capture'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDismissError}
              data-testid="dismiss-error-btn"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Capture Modes */}
      <div className="capture-modes-section" aria-label="Capture options">
        <button
          className="capture-mode-btn capture-mode-primary"
          onClick={() => handleCapture('viewport')}
          disabled={isCapturing}
          data-testid="capture-bug-btn"
          data-mode="viewport"
        >
          <div className="capture-mode-left">
            <span className="mode-icon">🖥️</span>
            <div className="mode-text">
              <span className="mode-title">
                {isCapturing && activeMode === 'viewport' ? 'Capturing...' : 'Capture Viewport'}
              </span>
              <span className="mode-desc">Visible screen instant capture</span>
            </div>
          </div>
          <span className="mode-shortcut">⚡ Fast</span>
        </button>

        <button
          className="capture-mode-btn capture-mode-secondary"
          onClick={() => handleCapture('region')}
          disabled={isCapturing}
          data-testid="capture-region-btn"
          data-mode="region"
        >
          <div className="capture-mode-left">
            <span className="mode-icon">✂️</span>
            <div className="mode-text">
              <span className="mode-title">
                {isCapturing && activeMode === 'region' ? 'Starting...' : 'Select Region'}
              </span>
              <span className="mode-desc">Drag rectangle on page to crop area</span>
            </div>
          </div>
          <span className="mode-pill">Overlay</span>
        </button>

        <button
          className="capture-mode-btn capture-mode-secondary"
          onClick={handleStartDebugSession}
          disabled={isCapturing}
          data-testid="start-debug-session-btn"
        >
          <div className="capture-mode-left">
            <span className="mode-icon">🐞</span>
            <div className="mode-text">
              <span className="mode-title">Start Error Session</span>
              <span className="mode-desc">Capture supported runtime errors only</span>
            </div>
          </div>
          <span className="mode-pill">Local</span>
        </button>

        <button
          className="capture-mode-btn capture-mode-disabled"
          disabled
          data-testid="capture-fullpage-btn"
          title="Full-page capture requires DevTools debugging permissions which violate our privacy invariants"
        >
          <div className="capture-mode-left">
            <span className="mode-icon">📜</span>
            <div className="mode-text">
              <span className="mode-title">Full Page</span>
              <span className="mode-desc">Unavailable in MV3 without debugger</span>
            </div>
          </div>
          <span className="mode-badge-na">N/A</span>
        </button>
      </div>

      <div className="popup-divider" />

      {/* Auxiliary actions */}
      <div className="popup-actions">
        <button
          className="btn btn-secondary"
          onClick={handleOpenEditor}
          disabled={isCapturing}
          data-testid="open-editor-btn"
        >
          Open Report Editor & History
        </button>
      </div>

      <footer className="popup-footer">
        Zero host tracking • Local storage only • ₹0 budget
      </footer>
    </div>
  );
};
