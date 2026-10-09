import React from 'react';
import './Popup.css';
import { APP_NAME, APP_VERSION } from '../shared/constants';

export const Popup: React.FC = () => {
  const handleOpenEditor = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    } else {
      window.open('/editor.html', '_blank');
    }
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

      <div className="popup-actions">
        <button
          className="btn btn-primary"
          onClick={handleOpenEditor}
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
