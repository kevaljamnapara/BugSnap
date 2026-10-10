import React, { useEffect, useState, useRef, useCallback } from 'react';
import './Editor.css';
import { APP_NAME, SEVERITY_LEVELS, EDIT_LOCK_HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import { BugReport, Severity, Annotation } from '../shared/types';
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
} from './exportUtils';
import { ReportManagement } from './ReportManagement';
import { cropImageDataUrl } from '../shared/cropUtils';

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

  // Form Fields State
  const [title, setTitle] = useState<string>('');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [reproductionSteps, setReproductionSteps] = useState<string>('');
  const [expectedBehavior, setExpectedBehavior] = useState<string>('');
  const [actualBehavior, setActualBehavior] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');

  // Annotation State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotatedScreenshotDataUrl, setAnnotatedScreenshotDataUrl] = useState<string | undefined>(
    undefined,
  );

  // Form Validation State
  const [titleTouched, setTitleTouched] = useState<boolean>(false);

  // Autosave & Persistence State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
        setTitle(loaded.title || '');
        setSeverity(loaded.severity || 'Medium');
        setReproductionSteps(loaded.reproductionSteps || '');
        setExpectedBehavior(loaded.expectedBehavior || '');
        setActualBehavior(loaded.actualBehavior || '');
        setAdditionalNotes(loaded.additionalNotes || '');
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

  // Autosave Function
  const triggerSave = useCallback(
    async (updatedFields: {
      title: string;
      severity: Severity;
      reproductionSteps: string;
      expectedBehavior: string;
      actualBehavior: string;
      additionalNotes: string;
      annotations?: Annotation[];
      annotatedScreenshotDataUrl?: string;
    }) => {
      if (!draft) return;

      // Renew session lock on each save activity
      renewEditLock(draft.id, sessionIdRef.current).catch(() => {});

      setSaveStatus('saving');
      setSaveError(null);

      const nextAnnotations =
        updatedFields.annotations !== undefined ? updatedFields.annotations : annotations;
      const nextAnnotatedScreenshot =
        updatedFields.annotatedScreenshotDataUrl !== undefined
          ? updatedFields.annotatedScreenshotDataUrl
          : annotatedScreenshotDataUrl;

      const updatedReport: BugReport = {
        ...draft,
        ...updatedFields,
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

  // Debounced Autosave Trigger for form fields
  const handleFieldChange = (
    field: 'title' | 'severity' | 'reproductionSteps' | 'expectedBehavior' | 'actualBehavior' | 'additionalNotes',
    value: string,
  ) => {
    isDirtyRef.current = true;

    const newValues = {
      title: field === 'title' ? value : title,
      severity: field === 'severity' ? (value as Severity) : severity,
      reproductionSteps: field === 'reproductionSteps' ? value : reproductionSteps,
      expectedBehavior: field === 'expectedBehavior' ? value : expectedBehavior,
      actualBehavior: field === 'actualBehavior' ? value : actualBehavior,
      additionalNotes: field === 'additionalNotes' ? value : additionalNotes,
    };

    if (field === 'title') setTitle(value);
    if (field === 'severity') setSeverity(value as Severity);
    if (field === 'reproductionSteps') setReproductionSteps(value);
    if (field === 'expectedBehavior') setExpectedBehavior(value);
    if (field === 'actualBehavior') setActualBehavior(value);
    if (field === 'additionalNotes') setAdditionalNotes(value);

    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerSave({
        ...newValues,
        annotations,
        annotatedScreenshotDataUrl,
      });
    }, 400);
  };

  // Immediate Save on Blur (e.g. user leaves field)
  const handleFieldBlur = () => {
    if (isDirtyRef.current && draft) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      triggerSave({
        title,
        severity,
        reproductionSteps,
        expectedBehavior,
        actualBehavior,
        additionalNotes,
        annotations,
        annotatedScreenshotDataUrl,
      });
      isDirtyRef.current = false;
    }
  };

  // Immediate Autosave on Annotation change
  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations);
    isDirtyRef.current = true;
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerSave({
        title,
        severity,
        reproductionSteps,
        expectedBehavior,
        actualBehavior,
        additionalNotes,
        annotations: newAnnotations,
        annotatedScreenshotDataUrl,
      });
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
    triggerSave({
      title,
      severity,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
      additionalNotes,
      annotations,
      annotatedScreenshotDataUrl,
    });
  };

  // Export Report Flow
  const handleExport = async () => {
    if (!draft) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccessMessage(null);

    const effectiveTitle = title.trim() || draft.metadata.title || 'Untitled Bug';
    const reportToExport: BugReport = {
      ...draft,
      title: effectiveTitle,
      severity,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
      additionalNotes,
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
      const effectiveTitle = title.trim() || draft.metadata.title || 'Untitled Bug';
      const stem = generateFilenameStem(effectiveTitle, draft.metadata.capturedAt);
      const mdContent = generateMarkdownReport(
        {
          ...draft,
          title: effectiveTitle,
          severity,
          reproductionSteps,
          expectedBehavior,
          actualBehavior,
          additionalNotes,
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

  const isTitleEmpty = title.trim().length === 0;

  return (
    <div className="editor-layout">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <h1>{APP_NAME} — Report Editor</h1>
          <div className="header-badges">
            <span className="badge badge-draft">Draft</span>
            {draftId && <span className="badge badge-id">ID: {draftId}</span>}
          </div>
        </div>

        <div className="header-actions">
          {/* Autosave Status Indicator */}
          {draft && !isDiscarded && viewMode === 'editor' && (
            <div className="save-status-container" data-testid="save-status">
              <span className={`status-dot status-dot-${saveStatus}`} />
              <span className={`status-text ${saveStatus === 'error' ? 'status-text-error' : ''}`}>
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved locally'}
                {saveStatus === 'error' && 'Save failed'}
              </span>
            </div>
          )}

          {/* Manage Reports & Settings Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setViewMode(viewMode === 'editor' ? 'management' : 'editor')}
            data-testid="manage-reports-btn"
          >
            {viewMode === 'editor' ? 'Manage Reports & Settings' : '← Back to Editor'}
          </button>

          {/* Copy Screenshot Button */}
          {draft && !isDiscarded && viewMode === 'editor' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyScreenshot}
              data-testid="copy-screenshot-btn"
              title="Copy screenshot image to clipboard"
            >
              Copy Screenshot
            </button>
          )}

          {draft?.debugSession?.status === 'active' && viewMode === 'editor' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleStopDebugSession}
              data-testid="stop-debug-session-btn"
            >
              Stop Error Session
            </button>
          )}

          {/* Copy Bug Report Button */}
          {draft && !isDiscarded && viewMode === 'editor' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyReport}
              data-testid="copy-report-btn"
              title="Copy Markdown bug report to clipboard"
            >
              Copy Report
            </button>
          )}

          {/* Discard Draft Button */}
          {draft && !isDiscarded && viewMode === 'editor' && (
            <button
              type="button"
              className="btn btn-danger-outline btn-sm"
              onClick={handleOpenDiscardModal}
              data-testid="discard-draft-btn"
            >
              Discard Draft
            </button>
          )}

          {/* Export Report Button */}
          {draft && !isDiscarded && viewMode === 'editor' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="export-report-btn"
              title="Download Markdown report and screenshot evidence"
            >
              {isExporting ? 'Exporting...' : 'Export Report'}
            </button>
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
          {draft?.debugSession && !isDiscarded && (
            <section className="editor-alert editor-alert-info" data-testid="console-session-summary">
              <strong>Runtime error session: </strong>
              {draft.debugSession.status === 'active' ? 'collecting supported page errors' : 'stopped'}.
              {' '}Captured {draft.debugSession.consoleEvents.length} unique event
              {draft.debugSession.consoleEvents.length === 1 ? '' : 's'}.
              <p style={{ margin: '8px 0 0' }}>
                BugSnap cannot read the complete DevTools console. Only supported `error` and
                `unhandledrejection` events from this explicit session are collected locally.
              </p>
            </section>
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

          {/* Main Editor Form & Evidence Grid */}
          {!isLoading && draft && !isDiscarded && (
            <main className="editor-grid">
              {/* Left Column: Form Fields */}
              <section className="editor-card" data-testid="editor-form-card">
                <h2>Defect Details</h2>

                {/* Bug Title (Required) */}
                <div className="form-group">
                  <label htmlFor="report-title" className="form-label">
                    Bug Title <span className="form-required">*</span>
                  </label>
                  <input
                    id="report-title"
                    name="title"
                    type="text"
                    className={`form-input ${titleTouched && isTitleEmpty ? 'form-input-error' : ''}`}
                    placeholder="e.g. Checkout button misaligned on mobile viewport"
                    value={title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    onBlur={() => {
                      setTitleTouched(true);
                      handleFieldBlur();
                    }}
                    data-testid="input-title"
                    aria-required="true"
                    aria-invalid={titleTouched && isTitleEmpty}
                  />
                  {titleTouched && isTitleEmpty && (
                    <span className="field-error-text" data-testid="title-error">
                      Bug title is required.
                    </span>
                  )}
                </div>

                {/* Severity Selector */}
                <div className="form-group">
                  <label className="form-label">Severity Level</label>
                  <div
                    className="severity-selector"
                    role="radiogroup"
                    aria-label="Severity Level"
                    data-testid="severity-selector"
                  >
                    {SEVERITY_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={severity === level}
                        className={`severity-pill ${severity === level ? `severity-pill-active-${level}` : ''}`}
                        onClick={() => handleFieldChange('severity', level)}
                        data-testid={`severity-pill-${level}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reproduction Steps */}
                <div className="form-group">
                  <label htmlFor="report-steps" className="form-label">
                    Reproduction Steps
                  </label>
                  <textarea
                    id="report-steps"
                    name="reproductionSteps"
                    className="form-textarea"
                    rows={4}
                    placeholder={'1. Navigate to /checkout\n2. Select standard shipping\n3. Click Place Order button'}
                    value={reproductionSteps}
                    onChange={(e) => handleFieldChange('reproductionSteps', e.target.value)}
                    onBlur={handleFieldBlur}
                    data-testid="input-steps"
                  />
                </div>

                {/* Expected Behavior */}
                <div className="form-group">
                  <label htmlFor="report-expected" className="form-label">
                    Expected Behavior
                  </label>
                  <textarea
                    id="report-expected"
                    name="expectedBehavior"
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe what should have happened..."
                    value={expectedBehavior}
                    onChange={(e) => handleFieldChange('expectedBehavior', e.target.value)}
                    onBlur={handleFieldBlur}
                    data-testid="input-expected"
                  />
                </div>

                {/* Actual Behavior */}
                <div className="form-group">
                  <label htmlFor="report-actual" className="form-label">
                    Actual Behavior
                  </label>
                  <textarea
                    id="report-actual"
                    name="actualBehavior"
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe what actually happened..."
                    value={actualBehavior}
                    onChange={(e) => handleFieldChange('actualBehavior', e.target.value)}
                    onBlur={handleFieldBlur}
                    data-testid="input-actual"
                  />
                </div>

                {/* Additional Notes */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="report-notes" className="form-label">
                    Additional Notes
                  </label>
                  <textarea
                    id="report-notes"
                    name="additionalNotes"
                    className="form-textarea"
                    rows={3}
                    placeholder="Console errors, device orientation, test credentials used..."
                    value={additionalNotes}
                    onChange={(e) => handleFieldChange('additionalNotes', e.target.value)}
                    onBlur={handleFieldBlur}
                    data-testid="input-notes"
                  />
                </div>
              </section>

              {/* Right Column: Evidence & Metadata */}
              <div className="evidence-column">
                {/* Visual Evidence & Annotation Canvas */}
                <section className="editor-card" data-testid="screenshot-card">
                  <h2>Visual Evidence & Annotations</h2>
                  {draft.screenshotDataUrl ? (
                    <div className="screenshot-preview-container">
                      <AnnotationCanvas
                        imageSrc={draft.screenshotDataUrl}
                        annotations={annotations}
                        onAnnotationsChange={handleAnnotationsChange}
                        onCompositeRendered={handleCompositeRendered}
                        onCopyScreenshot={handleCopyScreenshot}
                        onCopyReport={handleCopyReport}
                        onExportReport={handleExport}
                      />
                      <div className="screenshot-footer">
                        <span>Captured tab viewport</span>
                        {draft.metadata.viewport && (
                          <span>
                            {draft.metadata.viewport.width} × {draft.metadata.viewport.height} px
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>No screenshot image available.</p>
                  )}
                </section>

                {/* Page Metadata */}
                <section className="editor-card" data-testid="metadata-card">
                  <h2>Page Context</h2>
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
              </div>
            </main>
          )}
        </>
      )}
    </div>
  );
};
