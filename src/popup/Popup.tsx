import React, { useState } from 'react';
import './Popup.css';
import { APP_NAME, APP_VERSION } from '../shared/constants';
import { captureActiveTab } from './captureService';

export const Popup: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapture = async () => {
    if (isCapturing) {
      return; // Prevent duplicate clicks
    }

    setIsCapturing(true);
    setErrorMessage(null);

    try {
      const result = await captureActiveTab();
      if (!result.success) {
        setErrorMessage(result.error || 'An unexpected error occurred during capture.');
      } else {
        // Close popup window upon successful handoff to the editor tab
        if (typeof window !== 'undefined' && typeof window.close === 'function') {
          window.close();
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
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
        <h1 className="popup-title">{APP_NAME}</h1>
        <span className="popup-badge">v{APP_VERSION}</span>
      </header>

      <p className="popup-description">
        Capture website defects, annotate visual evidence, and export structured reports.
      </p>

      {errorMessage && (
        <div className="popup-error" data-testid="error-banner">
          <div className="popup-error-header">Capture Failed</div>
          <div className="popup-error-body">{errorMessage}</div>
          <div className="popup-error-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCapture}
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

      <div className="popup-actions">
        <button
          className="btn btn-primary"
          onClick={handleCapture}
          disabled={isCapturing}
          data-testid="capture-bug-btn"
        >
          {isCapturing ? 'Capturing...' : 'Capture Bug'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleOpenEditor}
          disabled={isCapturing}
          data-testid="open-editor-btn"
        >
          Open Report Editor
        </button>
      </div>

      <footer className="popup-footer">
        Offline only • ₹0 budget • Privacy-first
      </footer>
    </div>
  );
};
