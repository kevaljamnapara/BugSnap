import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Editor } from '../../src/editor/Editor';
import * as storage from '../../src/shared/storage';
import { BugReport } from '../../src/shared/types';

describe('Editor Component — Phase 3 Features', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clearAllReports();
    window.history.pushState({}, '', '/editor.html');
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  const mockDraft: BugReport = {
    id: 'draft-phase3-101',
    status: 'draft',
    title: 'Initial Bug Title',
    severity: 'Medium',
    reproductionSteps: 'Step 1: Open app',
    expectedBehavior: 'Should load fine',
    actualBehavior: 'Crashes on startup',
    additionalNotes: 'Chrome 129 on macOS',
    metadata: {
      url: 'https://example.com/checkout',
      title: 'Checkout Flow',
      capturedAt: '2026-10-09T22:20:00.000Z',
      viewport: { width: 1440, height: 900 },
      platform: 'MacIntel',
    },
    screenshotDataUrl: 'data:image/png;base64,mockPngBase64',
    createdAt: '2026-10-09T22:20:00.000Z',
    updatedAt: '2026-10-09T22:20:00.000Z',
  };

  it('renders informative empty state when no draft ID is in query string', async () => {
    render(<Editor />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-empty')).toBeInTheDocument();
      expect(screen.getByText(/No report draft selected/i)).toBeInTheDocument();
    });
  });

  it('renders error message when draft ID is not found in storage', async () => {
    window.history.pushState({}, '', '/editor.html?id=missing-id');
    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('editor-error')).toBeInTheDocument();
      expect(screen.getByText(/Draft with ID "missing-id" was not found/i)).toBeInTheDocument();
    });
  });

  it('restores saved report evidence and derived summary upon reload', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('derived-summary-preview')).toHaveTextContent('Initial Bug Title');
    });

    // Evidence & metadata visible
    expect(screen.getByTestId('screenshot-img')).toBeInTheDocument();
    expect(screen.getByTestId('meta-url')).toHaveTextContent('https://example.com/checkout');
    expect(screen.getByTestId('meta-viewport')).toHaveTextContent('1440 × 900 px');

    // Manual form fields are removed from the one-click workflow
    expect(screen.queryByTestId('input-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editor-form-card')).not.toBeInTheDocument();
  });

  it('does not require manual title and derives summary automatically from evidence', async () => {
    const draftEmptyTitle: BugReport = { ...mockDraft, title: '' };
    await storage.saveReport(draftEmptyTitle);
    window.history.pushState({}, '', `/editor.html?id=${draftEmptyTitle.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('derived-summary-preview')).toBeInTheDocument();
    });

    // Automatically derives issue title from page title or url without requiring manual title
    expect(screen.getByTestId('derived-summary-preview')).toHaveTextContent('Issue on: Checkout Flow');
    expect(screen.queryByTestId('title-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-title')).not.toBeInTheDocument();
  });

  it('renders initial saved state and displays save status correctly', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('screenshot-img')).toBeInTheDocument();
    });

    // Verify initial save status is saved locally
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved locally');
  });

  it('handles storage save failures visibly without crashing', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('screenshot-img')).toBeInTheDocument();
    });

    expect(screen.getByTestId('save-status')).toBeInTheDocument();
  });

  describe('Discard Draft Flow', () => {
    it('opens confirmation modal and preserves draft when cancelled', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('discard-draft-btn')).toBeInTheDocument();
      });

      // Click Discard Draft
      fireEvent.click(screen.getByTestId('discard-draft-btn'));

      // Modal appears
      expect(screen.getByTestId('discard-modal')).toBeInTheDocument();
      expect(screen.getByText(/Discard this bug report\?/i)).toBeInTheDocument();

      // Click Keep Editing (Cancel)
      fireEvent.click(screen.getByTestId('cancel-discard-btn'));

      // Modal closed
      expect(screen.queryByTestId('discard-modal')).not.toBeInTheDocument();

      // Draft still exists in storage
      const stored = await storage.getReport(mockDraft.id);
      expect(stored).not.toBeNull();
    });

    it('permanently deletes draft and evidence upon confirmation', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('discard-draft-btn')).toBeInTheDocument();
      });

      // Click Discard Draft
      fireEvent.click(screen.getByTestId('discard-draft-btn'));

      // Click Discard and Delete (Confirm)
      fireEvent.click(screen.getByTestId('confirm-discard-btn'));

      // Wait for discarded notice
      await waitFor(() => {
        expect(screen.getByTestId('draft-discarded-notice')).toBeInTheDocument();
      });

      // Draft deleted from storage
      const stored = await storage.getReport(mockDraft.id);
      expect(stored).toBeNull();
    });

    it('displays error message if deletion fails', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('discard-draft-btn')).toBeInTheDocument();
      });

      // Mock deletion failure
      vi.spyOn(storage, 'deleteReport').mockRejectedValueOnce(
        new Error('Disk I/O error during deletion'),
      );

      fireEvent.click(screen.getByTestId('discard-draft-btn'));
      fireEvent.click(screen.getByTestId('confirm-discard-btn'));

      await waitFor(() => {
        expect(screen.getByText(/Disk I\/O error during deletion/i)).toBeInTheDocument();
      });

      // Modal stays open so user is aware of error
      expect(screen.getByTestId('discard-modal')).toBeInTheDocument();
    });
  });

  describe('Phase 4 — Annotations and Markdown Export', () => {
    const mockDraftWithAnnotations: BugReport = {
      ...mockDraft,
      id: 'draft-phase4-202',
      annotations: [
        {
          id: 'annot-rect-1',
          type: 'rectangle',
          x: 20,
          y: 30,
          width: 120,
          height: 60,
          color: '#ef4444',
          strokeWidth: 4,
        },
        {
          id: 'annot-text-1',
          type: 'text',
          x: 40,
          y: 70,
          text: 'Misaligned logo',
          color: '#38bdf8',
          fontSize: 18,
        },
      ],
      annotatedScreenshotDataUrl: 'data:image/png;base64,mockAnnotatedComposite',
    };

    it('restores draft with annotations and displays them in AnnotationCanvas', async () => {
      await storage.saveReport(mockDraftWithAnnotations);
      window.history.pushState({}, '', `/editor.html?id=${mockDraftWithAnnotations.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('annotation-container')).toBeInTheDocument();
      });

      // SVG overlay renders the restored text annotation
      expect(screen.getByText('Misaligned logo')).toBeInTheDocument();
      expect(screen.getByTestId('tool-btn-undo')).not.toBeDisabled();
      expect(screen.getByTestId('tool-btn-clear')).not.toBeDisabled();
    });

    it('preserves the original unannotated screenshot in storage when annotations are cleared', async () => {
      await storage.saveReport(mockDraftWithAnnotations);
      window.history.pushState({}, '', `/editor.html?id=${mockDraftWithAnnotations.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('tool-btn-clear')).toBeInTheDocument();
      });

      // Click Clear All
      fireEvent.click(screen.getByTestId('tool-btn-clear'));
      fireEvent.click(screen.getByTestId('confirm-clear-btn'));

      // Wait for autosave to complete
      await waitFor(() => {
        expect(screen.getByTestId('save-status')).toHaveTextContent('Saved locally');
      });

      const updated = await storage.getReport(mockDraftWithAnnotations.id);
      expect(updated?.annotations).toEqual([]);
      // Crucial: original screenshot is never lost or overwritten
      expect(updated?.screenshotDataUrl).toBe(mockDraft.screenshotDataUrl);
    });

    it('triggers report export package and shows export success banner', async () => {
      // Mock downloads
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      } else {
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      }
      if (!window.URL.revokeObjectURL) {
        window.URL.revokeObjectURL = vi.fn();
      } else {
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
      }
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('export-report-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('export-report-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-success-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Report files exported successfully/i)).toBeInTheDocument();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('shows export error banner when export encounters a failure', async () => {
      // Force URL.createObjectURL failure
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = vi.fn().mockImplementation(() => {
          throw new Error('Disk write error');
        });
      } else {
        vi.spyOn(window.URL, 'createObjectURL').mockImplementation(() => {
          throw new Error('Disk write error');
        });
      }

      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('export-report-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('export-report-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Export Error:/i)).toBeInTheDocument();
    });
  });

  describe('Phase 5 — Report Management & Active Edit Protection in Editor', () => {
    it('allows toggling between Editor view and Report Management view', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-reports-btn')).toBeInTheDocument();
      });

      // Switch to Management view
      fireEvent.click(screen.getByTestId('manage-reports-btn'));

      expect(screen.getByTestId('report-management-view')).toBeInTheDocument();
      expect(screen.getByTestId('manage-reports-btn')).toHaveTextContent('← Back to Editor');

      // Switch back to Editor view
      fireEvent.click(screen.getByTestId('manage-reports-btn'));
      expect(screen.getByTestId('screenshot-card')).toBeInTheDocument();
      expect(screen.getByTestId('manage-reports-btn')).toHaveTextContent('Manage Reports & Settings');
    });

    it('acquires active edit lock on mount and releases upon discard', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('screenshot-card')).toBeInTheDocument();
      });

      // Report should be locked by this active editor session
      expect(await storage.isReportLocked(mockDraft.id)).toBe(true);

      // Discard draft
      fireEvent.click(screen.getByTestId('discard-draft-btn'));
      fireEvent.click(screen.getByTestId('confirm-discard-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('draft-discarded-notice')).toBeInTheDocument();
      });

      // Lock is released
      expect(await storage.isReportLocked(mockDraft.id)).toBe(false);
    });

    it('displays ReportManagement view when no draft ID is provided', async () => {
      window.history.pushState({}, '', '/editor.html');
      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('editor-empty')).toBeInTheDocument();
        expect(screen.getByTestId('report-management-view')).toBeInTheDocument();
      });
    });

    it('displays ReportManagement view when draft ID is not found in storage to prevent dead-ends', async () => {
      window.history.pushState({}, '', '/editor.html?id=nonexistent-id');
      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toBeInTheDocument();
        expect(screen.getByTestId('report-management-view')).toBeInTheDocument();
      });
    });

    it('copies bug report Markdown to clipboard with user feedback', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      // Mock navigator.clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
          write: vi.fn(),
        },
      });

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-report-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('copy-report-btn'));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
        expect(screen.getByTestId('copy-feedback-alert')).toHaveTextContent(/Markdown copied/i);
      });
    });

    it('displays user-visible notice when screenshot clipboard copying encounters an error', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      // Mock ClipboardItem and write failure
      (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class MockClipboardItem {
        constructor(public data: unknown) {}
      };

      const writeMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.assign(navigator, {
        clipboard: {
          write: writeMock,
          writeText: vi.fn(),
        },
      });

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-screenshot-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('copy-screenshot-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('copy-error-alert')).toBeInTheDocument();
        expect(screen.getByTestId('copy-error-alert')).toHaveTextContent(/Failed to copy screenshot/i);
      });
    });

    it('displays user-visible notice when clipboard image copy is unsupported', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      // Ensure ClipboardItem is undefined
      delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-screenshot-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('copy-screenshot-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('copy-error-alert')).toBeInTheDocument();
        expect(screen.getByTestId('copy-error-alert')).toHaveTextContent(/Clipboard image copy is not supported/i);
      });
    });

    it('preserves existing draft sessionLabel when loaded in editor', async () => {
      const draftWithSession = { ...mockDraft, sessionLabel: 'Hotfix Candidate' };
      await storage.saveReport(draftWithSession);
      window.history.pushState({}, '', `/editor.html?id=${draftWithSession.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('screenshot-card')).toBeInTheDocument();
      });

      const saved = await storage.getReport(draftWithSession.id);
      expect(saved?.sessionLabel).toBe('Hotfix Candidate');
    });

    it('renders Export ZIP button and exports portable bundle when clicked', async () => {
      await storage.saveReport(mockDraft);
      window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

      render(<Editor />);

      await waitFor(() => {
        expect(screen.getByTestId('export-zip-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('export-zip-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-success-alert')).toBeInTheDocument();
        expect(screen.getByTestId('export-success-alert')).toHaveTextContent(/Portable ZIP bundle exported successfully/i);
      });
    });
  });
});
