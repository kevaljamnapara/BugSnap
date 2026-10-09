import React, { useEffect, useState } from 'react';
import './Editor.css';
import { APP_NAME } from '../shared/constants';
import { BugReport } from '../shared/types';
import { getReport } from '../shared/storage';

export const Editor: React.FC = () => {
  const [draft, setDraft] = useState<BugReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    setDraftId(id);

    if (!id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadDraft() {
      try {
        const loaded = await getReport(id!);
        if (!isMounted) return;

        if (loaded) {
          setDraft(loaded);
        } else {
          setErrorMessage(`Draft with ID "${id}" was not found in local storage.`);
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(
          `Failed to load draft: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <h1>{APP_NAME} — Report Editor</h1>
        <div className="header-badges">
          <span className="badge badge-draft">Draft</span>
          {draftId && <span className="badge badge-id">ID: {draftId}</span>}
        </div>
      </header>

      {isLoading && (
        <div className="editor-loading" data-testid="editor-loading">
          Loading report draft...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="editor-alert editor-alert-error" data-testid="editor-error">
          <strong>Unable to load draft:</strong> {errorMessage}
        </div>
      )}

      {!isLoading && !draftId && !errorMessage && (
        <div className="editor-alert editor-alert-info" data-testid="editor-empty">
          <strong>No report draft selected.</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            Open the BugSnap extension popup on any webpage and click &quot;Capture Bug&quot;
            to capture a new defect report.
          </p>
        </div>
      )}

      {!isLoading && draft && (
        <main>
          {/* Metadata Section */}
          <section className="editor-card" data-testid="metadata-card">
            <h2>Captured Page Metadata</h2>
            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="metadata-label">Page Title</span>
                <span className="metadata-value" data-testid="meta-title">
                  {draft.metadata.title || 'Untitled page'}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Page URL</span>
                <span className="metadata-value" data-testid="meta-url">
                  {draft.metadata.url ? (
                    <a
                      href={draft.metadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="metadata-link"
                    >
                      {draft.metadata.url}
                    </a>
                  ) : (
                    'Unavailable'
                  )}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Captured At</span>
                <span className="metadata-value" data-testid="meta-captured-at">
                  {new Date(draft.metadata.capturedAt).toLocaleString()}
                </span>
              </div>

              {draft.metadata.viewport && (
                <div className="metadata-item" data-testid="meta-viewport">
                  <span className="metadata-label">Viewport</span>
                  <span className="metadata-value">
                    {draft.metadata.viewport.width} × {draft.metadata.viewport.height} px
                  </span>
                </div>
              )}

              {draft.metadata.platform && (
                <div className="metadata-item" data-testid="meta-platform">
                  <span className="metadata-label">Platform</span>
                  <span className="metadata-value">{draft.metadata.platform}</span>
                </div>
              )}
            </div>
          </section>

          {/* Screenshot Evidence Section */}
          <section className="editor-card" data-testid="screenshot-card">
            <h2>Visual Evidence</h2>
            {draft.screenshotDataUrl ? (
              <div className="screenshot-preview-container">
                <div className="screenshot-wrapper">
                  <img
                    src={draft.screenshotDataUrl}
                    alt="Captured defect evidence"
                    className="screenshot-image"
                    data-testid="screenshot-img"
                  />
                </div>
                <div className="screenshot-footer">
                  <span>Visible viewport screenshot captured via Chrome API</span>
                  {draft.metadata.viewport && (
                    <span>
                      {draft.metadata.viewport.width} × {draft.metadata.viewport.height}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No screenshot image available.</p>
            )}
          </section>
        </main>
      )}
    </div>
  );
};
