import React, { useState, useEffect, useCallback } from 'react';
import './ReportManagement.css';
import { BugReport, RetentionPeriod, RetentionSettings, CleanupResult } from '../shared/types';
import {
  listReports,
  deleteReport,
  getRetentionSettings,
  saveRetentionSettings,
  runRetentionCleanup,
  saveReport,
} from '../shared/storage';
import { RETENTION_PERIOD_OPTIONS, DEFAULT_RETENTION_SETTINGS } from '../shared/constants';
import { createSession, duplicateSession, renameSession, searchSessions } from '../shared/sessionManager';

export interface ReportManagementProps {
  onOpenReport: (reportId: string) => void;
  currentReportId?: string | null;
  onBackToEditor?: () => void;
}

export const ReportManagement: React.FC<ReportManagementProps> = ({
  onOpenReport,
  currentReportId,
  onBackToEditor,
}) => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'saved' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Retention Settings State
  const [retentionSettings, setRetentionSettings] = useState<RetentionSettings>(
    DEFAULT_RETENTION_SETTINGS,
  );
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Cleanup Trigger State
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  // Manual Deletion Modal State
  const [reportToDelete, setReportToDelete] = useState<BugReport | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Session Renaming Modal State
  const [reportToRename, setReportToRename] = useState<BugReport | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameLabel, setRenameLabel] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // Load reports and settings
  const loadData = useCallback(async () => {
    setIsLoadingReports(true);
    setStorageError(null);
    try {
      const [loadedReports, loadedSettings] = await Promise.all([
        listReports(),
        getRetentionSettings(),
      ]);
      // Sort most recent first
      loadedReports.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      setReports(loadedReports);
      setRetentionSettings(loadedSettings);
    } catch (err) {
      setStorageError(
        `Failed to access local storage: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle retention settings change
  const handleToggleRetention = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated: RetentionSettings = {
      ...retentionSettings,
      enabled: e.target.checked,
    };
    setRetentionSettings(updated);
    setSettingsFeedback(null);
    setSettingsError(null);

    try {
      setIsSavingSettings(true);
      await saveRetentionSettings(updated);
      setSettingsFeedback(
        updated.enabled
          ? `Automatic cleanup enabled (${updated.retentionDays} days retention).`
          : 'Automatic cleanup disabled.',
      );
    } catch (err) {
      setSettingsError(
        `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSelectRetentionPeriod = async (period: RetentionPeriod) => {
    const updated: RetentionSettings = {
      ...retentionSettings,
      retentionDays: period,
    };
    setRetentionSettings(updated);
    setSettingsFeedback(null);
    setSettingsError(null);

    try {
      setIsSavingSettings(true);
      await saveRetentionSettings(updated);
      setSettingsFeedback(`Retention period updated to ${period} days.`);
    } catch (err) {
      setSettingsError(
        `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Run cleanup on demand
  const handleRunCleanupNow = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setSettingsError(null);

    try {
      const result = await runRetentionCleanup({ overrideSettings: retentionSettings });
      setCleanupResult(result);
      // Reload reports after cleanup
      await loadData();
    } catch (err) {
      setSettingsError(
        `Cleanup execution failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsCleaning(false);
    }
  };

  // Manual Delete Flow
  const handleOpenDeleteModal = (report: BugReport) => {
    setDeleteError(null);
    setReportToDelete(report);
  };

  const handleCancelDelete = () => {
    setReportToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteReport(reportToDelete.id);
      setReportToDelete(null);
      await loadData();
    } catch (err) {
      setDeleteError(
        `Failed to delete report: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRename = (report: BugReport) => {
    setRenameError(null);
    setRenameTitle(report.title || '');
    setRenameLabel(report.sessionLabel || '');
    setReportToRename(report);
  };

  const handleCancelRename = () => {
    setReportToRename(null);
    setRenameError(null);
  };

  const handleConfirmRename = async () => {
    if (!reportToRename) return;
    setIsRenaming(true);
    setRenameError(null);
    try {
      const updated = renameSession(reportToRename, renameTitle, renameLabel);
      await saveReport(updated);
      setReportToRename(null);
      await loadData();
    } catch (err) {
      setRenameError(`Failed to rename session: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      const created = createSession();
      await saveReport(created);
      await loadData();
      onOpenReport(created.id);
    } catch (err) {
      setStorageError(`Failed to create session: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDuplicate = async (report: BugReport) => {
    try {
      await saveReport(duplicateSession(report));
      await loadData();
    } catch (err) {
      setStorageError(`Failed to duplicate session: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Filter reports
  const filteredReports = searchSessions(reports.filter((r) => {
    if (filterTab === 'saved') return r.status === 'saved';
    if (filterTab === 'draft') return r.status === 'draft';
    return true;
  }), searchQuery);

  const savedCount = reports.filter((r) => r.status === 'saved').length;
  const draftCount = reports.filter((r) => r.status === 'draft').length;

  return (
    <div className="management-layout" data-testid="report-management-view">
      {/* View Header */}
      <div className="management-header">
        <div className="management-header-title">
          <h2>Saved Reports & Storage Management</h2>
          <span className="badge badge-id">
            {reports.length} Total ({savedCount} Saved, {draftCount} Drafts)
          </span>
        </div>

        <div className="management-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCreateSession}
            data-testid="create-session-btn"
          >
            + New Session
          </button>
          {currentReportId && onBackToEditor && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onBackToEditor}
              data-testid="back-to-editor-btn"
            >
              ← Back to Active Editor
            </button>
          )}
        </div>
      </div>

      {/* Storage Error Alert */}
      {storageError && (
        <div className="editor-alert editor-alert-error" data-testid="management-storage-error">
          <div>
            <strong>Storage Error:</strong> {storageError}
          </div>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Automatic Retention Cleanup Settings Card */}
      <section className="settings-card" data-testid="retention-settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Automatic Retention Cleanup</h3>
            <p>
              Automatically purge old reports and all associated screenshots to manage local browser
              storage. Reports actively open in an editor are strictly protected from cleanup.
            </p>
          </div>

          <div className="retention-toggle-container">
            <label className="toggle-label">
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={retentionSettings.enabled}
                onChange={handleToggleRetention}
                disabled={isSavingSettings}
                data-testid="retention-toggle"
                aria-label="Enable automatic retention cleanup"
              />
              <span>
                {retentionSettings.enabled ? 'Enabled' : 'Disabled (Default)'}
              </span>
            </label>
            <span
              className={`toggle-status-badge ${retentionSettings.enabled ? 'toggle-status-enabled' : 'toggle-status-disabled'}`}
              data-testid="retention-status-badge"
            >
              {retentionSettings.enabled ? 'Active' : 'Off'}
            </span>
          </div>
        </div>

        {/* Retention Period Selection */}
        <div className="retention-options-row">
          <span className="retention-options-label">Retention Period</span>
          <div
            className="retention-period-buttons"
            role="radiogroup"
            aria-label="Retention Period"
            data-testid="retention-period-group"
          >
            {RETENTION_PERIOD_OPTIONS.map((period) => (
              <button
                key={period}
                type="button"
                role="radio"
                aria-checked={retentionSettings.retentionDays === period}
                className={`retention-period-btn ${
                  retentionSettings.retentionDays === period ? 'retention-period-btn-active' : ''
                }`}
                onClick={() => handleSelectRetentionPeriod(period)}
                disabled={!retentionSettings.enabled || isSavingSettings}
                data-testid={`retention-option-${period}`}
              >
                {period} Days
              </button>
            ))}
          </div>
        </div>

        {/* Settings Footer / Status */}
        <div className="settings-footer-actions">
          <div>
            {settingsFeedback && (
              <span className="settings-status-msg" data-testid="settings-feedback">
                ✓ {settingsFeedback}
              </span>
            )}
            {settingsError && (
              <span className="settings-error-msg" data-testid="settings-error">
                ⚠ {settingsError}
              </span>
            )}
            {cleanupResult && (
              <span className="settings-status-msg" data-testid="cleanup-result-msg">
                Cleanup completed: {cleanupResult.cleanedCount} expired reports deleted,{' '}
                {cleanupResult.skippedLockedCount} active reports protected.
              </span>
            )}
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRunCleanupNow}
              disabled={isCleaning || !retentionSettings.enabled}
              data-testid="run-cleanup-btn"
              title={
                retentionSettings.enabled
                  ? 'Evaluate and purge reports exceeding retention period'
                  : 'Enable cleanup first to run'
              }
            >
              {isCleaning ? 'Running Cleanup...' : 'Run Cleanup Now'}
            </button>
          </div>
        </div>
      </section>

      {/* Reports List Section */}
      <section className="reports-section" data-testid="reports-list-section">
        <input
          className="form-input"
          aria-label="Search local sessions"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search sessions by title, label, or URL..."
          data-testid="search-sessions-input"
        />
        <div className="reports-section-header">
          <div className="reports-tabs" role="tablist" aria-label="Filter reports">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'all'}
              className={`reports-tab-btn ${filterTab === 'all' ? 'reports-tab-btn-active' : ''}`}
              onClick={() => setFilterTab('all')}
              data-testid="tab-filter-all"
            >
              All Reports ({reports.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'saved'}
              className={`reports-tab-btn ${filterTab === 'saved' ? 'reports-tab-btn-active' : ''}`}
              onClick={() => setFilterTab('saved')}
              data-testid="tab-filter-saved"
            >
              Saved ({savedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'draft'}
              className={`reports-tab-btn ${filterTab === 'draft' ? 'reports-tab-btn-active' : ''}`}
              onClick={() => setFilterTab('draft')}
              data-testid="tab-filter-draft"
            >
              Drafts ({draftCount})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingReports && (
          <div className="editor-loading" data-testid="reports-loading">
            Loading reports and drafts...
          </div>
        )}

        {/* Empty State */}
        {!isLoadingReports && filteredReports.length === 0 && (
          <div className="reports-empty" data-testid="reports-empty-state">
            <h4>No reports found</h4>
            <p>
              {filterTab === 'all'
                ? 'No saved reports or drafts in local storage. Click "Capture Bug" in the extension popup on any webpage to create one.'
                : `No ${filterTab} reports found in local storage.`}
            </p>
          </div>
        )}

        {/* Reports Grid */}
        {!isLoadingReports && filteredReports.length > 0 && (
          <div className="reports-grid" data-testid="reports-grid">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="report-item-card"
                data-testid={`report-card-${report.id}`}
              >
                <div className="report-item-main">
                  <div className="report-item-header">
                    <span
                      className={`badge ${
                        report.status === 'draft' ? 'badge-status-draft' : 'badge-status-saved'
                      }`}
                      data-testid={`badge-status-${report.id}`}
                    >
                      {report.status}
                    </span>
                    <span className="badge badge-id" data-testid={`badge-severity-${report.id}`}>
                      {report.severity}
                    </span>
                    {report.sessionLabel && (
                      <span
                        className="badge badge-session-label"
                        data-testid={`badge-session-label-${report.id}`}
                      >
                        {report.sessionLabel}
                      </span>
                    )}
                    <h3 className="report-item-title" data-testid={`report-title-${report.id}`}>
                      {report.title.trim() || 'Untitled Bug'}
                    </h3>
                  </div>

                  <div className="report-item-meta">
                    {report.metadata.url && (
                      <span>
                        URL:{' '}
                        <a
                          href={report.metadata.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={report.metadata.url}
                        >
                          {report.metadata.title || report.metadata.url}
                        </a>
                      </span>
                    )}
                    <span>
                      Updated:{' '}
                      {new Date(report.updatedAt || report.createdAt).toLocaleDateString()}{' '}
                      {new Date(report.updatedAt || report.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {report.annotations && report.annotations.length > 0 && (
                      <span>{report.annotations.length} annotations</span>
                    )}
                  </div>
                </div>

                <div className="report-item-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenReport(report.id)}
                    data-testid={`open-report-btn-${report.id}`}
                  >
                    Open / Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenRename(report)}
                    data-testid={`rename-session-btn-${report.id}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDuplicate(report)}
                    data-testid={`duplicate-session-btn-${report.id}`}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => handleOpenDeleteModal(report)}
                    data-testid={`delete-report-btn-${report.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rename Session Modal */}
      {reportToRename && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="rename-session-modal"
        >
          <div className="modal-dialog">
            <h3 className="modal-title">Rename Debug Session</h3>
            <p className="modal-body" style={{ margin: '0 0 12px 0' }}>
              Update the session title and optional label for tracking.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>
                  Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="Session title"
                  data-testid="rename-title-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>
                  Session Label (optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={renameLabel}
                  onChange={(e) => setRenameLabel(e.target.value)}
                  placeholder="e.g. Sprint 24, Staging Smoke Test"
                  data-testid="rename-label-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {renameError && (
              <div className="editor-alert editor-alert-error" style={{ marginBottom: 16 }}>
                {renameError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancelRename}
                disabled={isRenaming}
                data-testid="cancel-rename-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmRename}
                disabled={isRenaming}
                data-testid="confirm-rename-btn"
              >
                {isRenaming ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Delete Confirmation Modal */}
      {reportToDelete && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="delete-report-modal"
        >
          <div className="modal-dialog">
            <h3 className="modal-title" style={{ color: '#f87171' }}>
              Delete report permanently?
            </h3>
            <p className="modal-body">
              This will permanently delete &quot;{reportToDelete.title.trim() || 'Untitled Bug'}&quot;
              and all associated original screenshots, annotations, and visual evidence from local
              storage. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="editor-alert editor-alert-error" style={{ marginBottom: 16 }}>
                {deleteError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                data-testid="cancel-delete-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                data-testid="confirm-delete-btn"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
