import React, { useEffect, useState, useRef, useCallback } from 'react';
import './Editor.css';
import { APP_NAME, EDIT_LOCK_HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import { BugReport, Annotation } from '../shared/types';
import {
  getReport,
  saveReport,
  deleteReport,
  acquireEditLock,
  renewEditLock,
  releaseEditLock,
} from '../shared/storage';
import { AnnotationCanvas } from './AnnotationCanvas';
import {
  exportReportPackage,
  dataUrlToBlob,
  generateFilenameStem,
  generateMarkdownReport,
  downloadBlob,
  deriveReportSummary,
} from './exportUtils';
import { ReportManagement } from './ReportManagement';
import { cropImageDataUrl } from '../shared/cropUtils';
import { DebugTimeline } from './DebugTimeline';
import { EnvironmentDiagnostics } from './EnvironmentDiagnostics';
import { EvidenceReview } from './EvidenceReview';
import { generateAiDebugPrompt } from '../shared/aiPrompt';
import { createPortableBundle } from '../shared/portableBundle';
import { initTheme } from '../shared/theme';
import { ThemeSwitcher } from '../shared/ThemeSwitcher';

export const Editor: React.FC = () => {
  const [draft, setDraft] = useState<BugReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  // View Mode: Active Report Editor vs Report Management / Settings
  const [viewMode, setViewMode] = useState<'editor' | 'management'>('editor');

  // Active Edit Session Lock State
  const sessionIdRef = useRef<string>(
    `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  );

  // Annotation State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotatedScreenshotDataUrl, setAnnotatedScreenshotDataUrl] = useState<string | undefined>(
    undefined,
  );

  // Autosave & Persistence State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Secondary Actions Dropdown Menu State
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Copy Feedback and Error State
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Discard Draft State
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [isDiscarded, setIsDiscarded] = useState<boolean>(false);

  // Load Draft by ID function
  const loadDraft = useCallback(async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const loaded = await getReport(id);
      if (loaded) {
        if (loaded.cropRegion && loaded.screenshotDataUrl) {
          try {
            const cropped = await cropImageDataUrl(loaded.screenshotDataUrl, loaded.cropRegion);
            if (cropped && cropped !== loaded.screenshotDataUrl) {
              loaded.screenshotDataUrl = cropped;
              loaded.cropRegion = undefined;
              await saveReport(loaded);
            }
          } catch {
            // Safe fallback to original screenshot
          }
        }
        setDraft(loaded);
        setAnnotations(loaded.annotations || []);
        setAnnotatedScreenshotDataUrl(loaded.annotatedScreenshotDataUrl);
        setSaveStatus('saved');
      } else {
        setErrorMessage(`Draft with ID "${id}" was not found in local storage.`);
      }
    } catch (err) {
      setErrorMessage(
        `Failed to load draft: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check query params on mount
  useEffect(() => {
    initTheme();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    setDraftId(id);

    if (id) {
      loadDraft(id);
    } else {
      setIsLoading(false);
    }
  }, [loadDraft]);

  // Maintain active edit session lock and renew heartbeat while editor is open
  useEffect(() => {
    if (!draftId) return;

    const currentSessionId = sessionIdRef.current;
    acquireEditLock(draftId, currentSessionId).catch(() => {});

    const heartbeatTimer = setInterval(() => {
      renewEditLock(draftId, currentSessionId).catch(() => {});
    }, EDIT_LOCK_HEARTBEAT_INTERVAL_MS);

    // Immediate lock renewal upon tab focus or visibility restoration
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        renewEditLock(draftId, currentSessionId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const handleBeforeUnload = () => {
      releaseEditLock(currentSessionId).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      releaseEditLock(currentSessionId).catch(() => {});
    };
  }, [draftId]);

  // Autosave Function for Annotations
  const triggerSave = useCallback(
    async (updatedAnnotations?: Annotation[], updatedScreenshot?: string) => {
      if (!draft) return;

      // Renew session lock on each save activity
      renewEditLock(draft.id, sessionIdRef.current).catch(() => {});

      setSaveStatus('saving');
      setSaveError(null);

      const nextAnnotations =
        updatedAnnotations !== undefined ? updatedAnnotations : annotations;
      const nextAnnotatedScreenshot =
        updatedScreenshot !== undefined
          ? updatedScreenshot
          : annotatedScreenshotDataUrl;

      const updatedReport: BugReport = {
        ...draft,
        annotations: nextAnnotations,
        annotatedScreenshotDataUrl: nextAnnotatedScreenshot,
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveReport(updatedReport);
        setDraft(updatedReport);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(
          `Failed to save draft to local storage: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [draft, annotations, annotatedScreenshotDataUrl],
  );

  // Immediate Autosave on Annotation change
  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations);
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerSave(newAnnotations, annotatedScreenshotDataUrl);
    }, 400);
  };

  // Composite rendered callback from AnnotationCanvas
  const handleCompositeRendered = (compositeDataUrl: string) => {
    setAnnotatedScreenshotDataUrl(compositeDataUrl);
    if (draft && compositeDataUrl !== draft.annotatedScreenshotDataUrl) {
      const updatedReport: BugReport = {
        ...draft,
        annotatedScreenshotDataUrl: compositeDataUrl,
        updatedAt: new Date().toISOString(),
      };
      saveReport(updatedReport).catch(() => {});
    }
  };

  // Manual Retry for Failed Save
  const handleRetrySave = () => {
    triggerSave(annotations, annotatedScreenshotDataUrl);
  };

  // Export Report Flow
  const handleExport = async () => {
    if (!draft) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccessMessage(null);

    const effectiveTitle = draft.title || deriveReportSummary(draft);
    const reportToExport: BugReport = {
      ...draft,
      title: effectiveTitle,
      annotations,
      annotatedScreenshotDataUrl,
    };

    const result = await exportReportPackage(reportToExport);

    setIsExporting(false);
    if (result.success) {
      setExportSuccessMessage(
        `Report files exported successfully (${result.filenameStem}). If prompted by the browser, please allow multiple file downloads.`,
      );
    } else {
      setExportError(result.error || 'Failed to export report package.');
    }
  };

  // Export Portable ZIP Bundle Flow
  const handleExportZip = () => {
    if (!draft) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccessMessage(null);

    try {
      const effectiveTitle = draft.title || deriveReportSummary(draft);
      const reportToExport: BugReport = {
        ...draft,
        title: effectiveTitle,
        annotations,
        annotatedScreenshotDataUrl,
      };

      const zipBlob = createPortableBundle(reportToExport);
      const stem = generateFilenameStem(reportToExport.title, reportToExport.metadata.capturedAt);
      downloadBlob(zipBlob, `${stem}.zip`);
      setExportSuccessMessage(`Portable ZIP bundle exported successfully (${stem}.zip).`);
    } catch (err) {
      setExportError(`Failed to export ZIP bundle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Screenshot directly to clipboard
  const handleCopyScreenshot = async () => {
    setCopyError(null);
    setCopyFeedback(null);
    try {
      const dataUrl = annotatedScreenshotDataUrl || draft?.screenshotDataUrl;
      if (!dataUrl) {
        setCopyError('No screenshot available to copy.');
        return;
      }
      const blob = dataUrlToBlob(dataUrl);
      if (
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function'
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopyFeedback('Screenshot copied to clipboard!');
        setTimeout(() => setCopyFeedback(null), 3500);
      } else {
        setCopyError(
          'Clipboard image copy is not supported in this browser. You can right-click the screenshot to copy it, or use Export Report.',
        );
      }
    } catch (err) {
      setCopyError(
        `Failed to copy screenshot: ${err instanceof Error ? err.message : String(err)}. You can right-click the image to copy it, or use Export Report.`,
      );
    }
  };

  // Copy Bug Report as Markdown to clipboard
  const handleCopyReport = async () => {
    if (!draft) return;
    setCopyError(null);
    setCopyFeedback(null);
    try {
      const effectiveTitle = draft.title || deriveReportSummary(draft);
      const stem = generateFilenameStem(effectiveTitle, draft.metadata.capturedAt);
      const mdContent = generateMarkdownReport(
        {
          ...draft,
          title: effectiveTitle,
          annotations,
          annotatedScreenshotDataUrl,
        },
        stem,
      );

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(mdContent);
        setCopyFeedback('Bug report Markdown copied to clipboard!');
        setTimeout(() => setCopyFeedback(null), 3500);
      } else {
        setCopyError('Clipboard writeText is not supported in this browser environment.');
      }
    } catch (err) {
      setCopyError(
        `Failed to copy bug report: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // Discard Draft Flow
  const handleOpenDiscardModal = () => {
    setDiscardError(null);
    setShowDiscardModal(true);
  };

  const handleCancelDiscard = () => {
    setShowDiscardModal(false);
  };

  const handleConfirmDiscard = async () => {
    if (!draftId) return;

    setIsDiscarding(true);
    setDiscardError(null);

    try {
      await deleteReport(draftId);
      releaseEditLock(sessionIdRef.current).catch(() => {});
      setIsDiscarded(true);
      setShowDiscardModal(false);
    } catch (err) {
      setDiscardError(
        `Failed to delete draft: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsDiscarding(false);
    }
  };

  // Open a report chosen from ReportManagement
  const handleOpenReportFromManagement = (reportId: string) => {
    window.history.pushState({}, '', `?id=${reportId}`);
    setDraftId(reportId);
    setViewMode('editor');
    setIsDiscarded(false);
    loadDraft(reportId);
  };

  const handleStopDebugSession = async () => {
    if (!draft?.debugSession || draft.debugSession.status !== 'active') return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BUGSNAP_STOP_CONSOLE_SESSION', reportId: draft.id,
      });
      if (!response?.success) {
        setErrorMessage(response?.error || 'Unable to stop the debugging session.');
        return;
      }
      const updated = {
        ...draft,
        debugSession: { ...draft.debugSession, status: 'stopped' as const, stoppedAt: new Date().toISOString() },
      };
      setDraft(updated);
      setSaveStatus('saved');
    } catch (error) {
      setErrorMessage(`Unable to stop the debugging session: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEvidenceReviewChange = async (debugSession: NonNullable<BugReport['debugSession']>) => {
    if (!draft) return;
    const updated = { ...draft, debugSession, updatedAt: new Date().toISOString() };
    await saveReport(updated);
    setDraft(updated);
  };

  const handleCopyAiPrompt = async () => {
    if (!draft || !navigator.clipboard?.writeText) return setCopyError('Clipboard prompt copy is unavailable in this browser.');
    await navigator.clipboard.writeText(generateAiDebugPrompt(draft));
    setCopyFeedback('Detailed AI-ready debugging prompt copied locally.');
  };

  return (
    <div className="editor-layout">
      {/* Header */}
      <header className="editor-header">
        {/* Left Section: Brand, Subtitle, Draft badge, truncated ID */}
        <div className="header-section-left">
          <div className="app-brand">
            <span className="app-logo-mark" aria-hidden="true">🐞</span>
            <h1>
              {APP_NAME} <span className="header-subtitle">— Report Editor</span>
            </h1>
          </div>
          <div className="header-badges">
            <span className="badge badge-draft">Draft</span>
            {draftId && (
              <span
                className="badge badge-id"
                title={`Report ID: ${draftId}`}
                aria-label={`Report ID: ${draftId}`}
              >
                ID: {draftId.length > 8 ? `${draftId.slice(0, 8)}…` : draftId}
              </span>
            )}
          </div>
        </div>

        {/* Center Section: Save status, Theme switcher, Manage Reports & Settings, Context toggle */}
        <div className="header-section-center">
          {draft && !isDiscarded && viewMode === 'editor' && (
            <div className="save-status-container header-status-pill" data-testid="save-status">
              <span className={`status-dot status-dot-${saveStatus}`} />
              <span className={`status-text ${saveStatus === 'error' ? 'status-text-error' : ''}`}>
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved locally'}
                {saveStatus === 'error' && 'Save failed'}
              </span>
            </div>
          )}

          <div className="header-divider" aria-hidden="true" />

          <ThemeSwitcher className="header-pill-btn" />

          <div className="header-divider" aria-hidden="true" />

          <button
            type="button"
            className="btn header-pill-btn"
            onClick={() => setViewMode(viewMode === 'editor' ? 'management' : 'editor')}
            data-testid="manage-reports-btn"
          >
            <span aria-hidden="true">{viewMode === 'editor' ? '⚙' : '←'}</span>
            <span>{viewMode === 'editor' ? 'Manage Reports & Settings' : '← Back to Editor'}</span>
          </button>

          {draft && !isDiscarded && viewMode === 'editor' && (
            <>
              <div className="header-divider" aria-hidden="true" />
              <button
                type="button"
                className={`btn header-pill-btn ${showSidePanel ? 'header-pill-active' : ''}`}
                onClick={() => setShowSidePanel(!showSidePanel)}
                data-testid="toggle-diagnostics-btn"
                title={showSidePanel ? 'Hide Page Context sidebar' : 'Show Page Context sidebar'}
                aria-label="Toggle Page Context sidebar"
              >
                <span aria-hidden="true">ℹ️</span>
                <span>Context</span>
              </button>
            </>
          )}
        </div>

        {/* Right Section: Split Primary Button + Dropdown, Divider, Discard Draft */}
        <div className="header-section-right">
          {draft && !isDiscarded && viewMode === 'editor' && (
            <>
              {/* Separate 3 Copy Buttons */}
              <div className="header-copy-actions" role="group" aria-label="Copy actions">
                <button
                  type="button"
                  className="btn header-pill-btn"
                  onClick={handleCopyScreenshot}
                  data-testid="copy-screenshot-btn"
                  title="Copy screenshot image to clipboard"
                >
                  <span aria-hidden="true">🖼️</span>
                  <span>Copy Image</span>
                </button>

                <button
                  type="button"
                  className="btn header-pill-btn btn-primary"
                  onClick={handleCopyReport}
                  data-testid="copy-report-btn"
                  title="Copy Markdown bug report to clipboard"
                >
                  <span aria-hidden="true">📝</span>
                  <span>Copy Report</span>
                </button>

                <button
                  type="button"
                  className="btn header-pill-btn"
                  onClick={handleCopyAiPrompt}
                  data-testid="copy-ai-prompt-btn"
                  title="Copy AI debugging prompt to clipboard"
                >
                  <span aria-hidden="true">🤖</span>
                  <span>Copy Prompt</span>
                </button>
              </div>

              <div className="header-divider" aria-hidden="true" />

              {/* Export Menu */}
              <div className="split-action-container" ref={menuContainerRef}>
                <button
                  type="button"
                  className={`btn header-pill-btn ${isMenuOpen ? 'header-pill-active' : ''}`}
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  aria-label="Export options"
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  data-testid="more-actions-btn"
                  title="Export options"
                >
                  <span aria-hidden="true">📦</span>
                  <span>Export</span>
                  <span className="chevron-icon" aria-hidden="true">▾</span>
                </button>

                {/* Secondary Actions Dropdown Menu */}
                <div
                  className={`header-dropdown-menu ${isMenuOpen ? 'menu-open' : ''}`}
                  role="menu"
                  aria-label="Export options"
                  data-testid="more-actions-menu"
                >
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleExport();
                    }}
                    disabled={isExporting}
                    data-testid="export-report-btn"
                    title="Download Markdown report and screenshot evidence"
                  >
                    <span className="menu-item-icon" aria-hidden="true">📄</span>
                    <span>Export Report</span>
                  </button>

                  <button
                    type="button"
                    className="dropdown-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleExportZip();
                    }}
                    disabled={isExporting}
                    data-testid="export-zip-btn"
                    title="Download portable ZIP bundle with report and diagnostics"
                  >
                    <span className="menu-item-icon" aria-hidden="true">📦</span>
                    <span>Export ZIP</span>
                  </button>

                  {draft?.debugSession?.status === 'active' && (
                    <>
                      <div className="dropdown-divider" role="separator" />
                      <button
                        type="button"
                        className="dropdown-menu-item dropdown-item-warning"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleStopDebugSession();
                        }}
                        data-testid="stop-debug-session-btn"
                      >
                        <span className="menu-item-icon" aria-hidden="true">🛑</span>
                        <span>Stop Error Session</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="header-divider" aria-hidden="true" />

              {/* Discard Draft Button */}
              <button
                type="button"
                className="btn header-pill-btn btn-danger-pill"
                onClick={handleOpenDiscardModal}
                data-testid="discard-draft-btn"
                title="Discard this bug report draft"
              >
                <span aria-hidden="true">🗑</span>
                <span>Discard Draft</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="discard-modal">
          <div className="modal-dialog">
            <h3 className="modal-title">Discard this bug report?</h3>
            <p className="modal-body">
              This will permanently delete this draft and its associated screenshot evidence from
              local storage. This action cannot be undone.
            </p>

            {discardError && (
              <div className="editor-alert editor-alert-error" style={{ marginBottom: 16 }}>
                {discardError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelDiscard}
                disabled={isDiscarding}
                data-testid="cancel-discard-btn"
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDiscard}
                disabled={isDiscarding}
                data-testid="confirm-discard-btn"
              >
                {isDiscarding ? 'Deleting...' : 'Discard and Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Feedback and Error Alerts */}
      {copyFeedback && (
        <div className="editor-alert editor-alert-info" role="status" data-testid="copy-feedback-alert">
          <div>
            <strong>Clipboard:</strong> {copyFeedback}
          </div>
        </div>
      )}

      {copyError && (
        <div className="editor-alert editor-alert-error" role="alert" data-testid="copy-error-alert">
          <div>
            <strong>Clipboard Notice:</strong> {copyError}
          </div>
        </div>
      )}

      {/* Export Success Alert */}
      {exportSuccessMessage && (
        <div className="editor-alert editor-alert-success" data-testid="export-success-alert">
          <div>
            <strong>Export Complete:</strong> {exportSuccessMessage}
          </div>
        </div>
      )}

      {/* Export Error Alert */}
      {exportError && (
        <div className="editor-alert editor-alert-error" data-testid="export-error-alert">
          <div>
            <strong>Export Error:</strong> {exportError}
          </div>
        </div>
      )}

      {/* Save Error Alert */}
      {saveError && (
        <div className="editor-alert editor-alert-error" data-testid="save-error-alert">
          <div>
            <strong>Storage Error:</strong> {saveError}
          </div>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRetrySave}
              data-testid="retry-save-btn"
            >
              Retry Save
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="editor-loading" data-testid="editor-loading">
          Loading report draft...
        </div>
      )}

      {/* Draft Discarded State */}
      {isDiscarded && (
        <div className="editor-alert editor-alert-info" data-testid="draft-discarded-notice">
          <strong>Draft Discarded</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            This draft and its screenshot evidence have been permanently deleted from local storage.
            You can close this tab or capture a new bug from the extension popup.
          </p>
        </div>
      )}

      {/* No Draft ID State: Shows guidance and displays ReportManagement below */}
      {!isLoading && !draftId && !errorMessage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="editor-alert editor-alert-info" data-testid="editor-empty">
            <strong>No report draft selected.</strong>
            <p style={{ margin: '8px 0 0 0' }}>
              Open the BugSnap extension popup on any webpage and click &quot;Capture Bug&quot;
              to capture a new defect report, or manage existing reports and retention settings below.
            </p>
          </div>
          <ReportManagement onOpenReport={handleOpenReportFromManagement} />
        </div>
      )}

      {/* Error State: Display error message and ReportManagement for recovery */}
      {!isLoading && errorMessage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="editor-alert editor-alert-error" data-testid="editor-error">
            <strong>Unable to load draft:</strong> {errorMessage}
          </div>
          <ReportManagement onOpenReport={handleOpenReportFromManagement} />
        </div>
      )}

      {/* View Mode: Report Management & Retention Settings */}
      {viewMode === 'management' && (
        <ReportManagement
          onOpenReport={handleOpenReportFromManagement}
          currentReportId={draftId}
          onBackToEditor={draftId ? () => setViewMode('editor') : undefined}
        />
      )}

      {/* View Mode: Editor */}
      {viewMode === 'editor' && (
        <>
          {draft && !isDiscarded && (
            <>
              {/* Full-Screen Workspace Body */}
              <div className="editor-main-body">
                {/* Visual Evidence Full-Screen Canvas */}
                <main className="screenshot-fullscreen-container" data-testid="screenshot-card">
                  {draft.screenshotDataUrl ? (
                    <div className="fullscreen-canvas-wrapper">
                      <AnnotationCanvas
                        imageSrc={draft.screenshotDataUrl}
                        annotations={annotations}
                        onAnnotationsChange={handleAnnotationsChange}
                        onCompositeRendered={handleCompositeRendered}
                        onExportReport={handleExport}
                      />
                    </div>
                  ) : (
                    <div className="empty-screenshot-placeholder">
                      <p>No screenshot image available.</p>
                    </div>
                  )}
                </main>

                {/* Collapsible Page Context & Diagnostics Panel */}
                <aside
                  className={`editor-sidebar-panel ${showSidePanel ? 'sidebar-open' : 'sidebar-collapsed'}`}
                  data-testid="metadata-card"
                  aria-label="Page Context and Diagnostics"
                >
                  <div className="sidebar-section">
                    <div className="sidebar-header">
                      <h3>Page Context</h3>
                      <button
                        type="button"
                        className="sidebar-close-btn"
                        onClick={() => setShowSidePanel(false)}
                        title="Close Page Context"
                        aria-label="Close Page Context"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="metadata-grid">
                      <div className="metadata-item">
                        <span className="metadata-label">Report Summary</span>
                        <strong className="metadata-value metadata-summary" data-testid="derived-summary-preview">
                          {(draft.title && draft.title.trim()) || deriveReportSummary(draft)}
                        </strong>
                      </div>

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
                  </div>

                  {/* Advanced Diagnostics Collapsible Section */}
                  <details className="sidebar-diagnostics-disclosure">
                    <summary className="sidebar-diagnostics-summary">
                      <span>Diagnostics &amp; Session Data</span>
                    </summary>
                    <div className="sidebar-diagnostics-content">
                      {draft.debugSession && (
                        <div className="diagnostics-panel" data-testid="console-session-summary">
                          <h4>
                            Runtime error session:{' '}
                            {draft.debugSession.status === 'active' ? 'collecting page errors' : 'stopped'}
                          </h4>
                          <p style={{ margin: '4px 0 0' }}>
                            Captured <strong>{draft.debugSession.consoleEvents.length}</strong> runtime event
                            {draft.debugSession.consoleEvents.length === 1 ? '' : 's'} and{' '}
                            <strong>{draft.debugSession.networkEvents?.length || 0}</strong> network timing
                            {(draft.debugSession.networkEvents?.length || 0) === 1 ? '' : 's'}.
                          </p>
                        </div>
                      )}
                      {draft.debugSession && <DebugTimeline session={draft.debugSession} />}
                      {draft.debugSession && (
                        <EvidenceReview session={draft.debugSession} onChange={handleEvidenceReviewChange} />
                      )}
                      <EnvironmentDiagnostics metadata={draft.metadata} />
                    </div>
                  </details>
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
