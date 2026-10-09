import React from 'react';
import './Editor.css';
import { APP_NAME } from '../shared/constants';

export const Editor: React.FC = () => {
  return (
    <div className="editor-layout">
      <header className="editor-header">
        <h1>{APP_NAME} — Report Editor</h1>
        <span className="editor-badge">Phase 1 Foundation</span>
      </header>

      <main className="editor-card">
        <h2>Report Editor Initialized</h2>
        <p>
          This tab serves as BugSnap&apos;s full-page bug documentation interface.
          Capture coordination, annotation canvas, form fields, and local persistence
          will be connected in upcoming phases.
        </p>
      </main>
    </div>
  );
};
