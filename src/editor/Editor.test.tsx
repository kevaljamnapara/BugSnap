import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Editor } from './Editor';
import * as storage from '../shared/storage';
import { BugReport } from '../shared/types';

describe('Editor Component — Phase 3 Features', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clearAllReports();
    window.history.pushState({}, '', '/editor.html');
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

  it('restores all saved report fields upon reload', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('input-title')).toHaveValue('Initial Bug Title');
    });

    expect(screen.getByTestId('input-steps')).toHaveValue('Step 1: Open app');
    expect(screen.getByTestId('input-expected')).toHaveValue('Should load fine');
    expect(screen.getByTestId('input-actual')).toHaveValue('Crashes on startup');
    expect(screen.getByTestId('input-notes')).toHaveValue('Chrome 129 on macOS');

    // Severity pill active
    const mediumPill = screen.getByTestId('severity-pill-Medium');
    expect(mediumPill).toHaveAttribute('aria-checked', 'true');

    // Evidence & metadata visible
    expect(screen.getByTestId('screenshot-img')).toBeInTheDocument();
    expect(screen.getByTestId('meta-url')).toHaveTextContent('https://example.com/checkout');
    expect(screen.getByTestId('meta-viewport')).toHaveTextContent('1440 × 900 px');
  });

  it('validates required bug title and shows validation error when blurred empty', async () => {
    const draftEmptyTitle: BugReport = { ...mockDraft, title: '' };
    await storage.saveReport(draftEmptyTitle);
    window.history.pushState({}, '', `/editor.html?id=${draftEmptyTitle.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('input-title')).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId('input-title');
    expect(screen.queryByTestId('title-error')).not.toBeInTheDocument();

    // Blur empty title
    fireEvent.blur(titleInput);

    expect(screen.getByTestId('title-error')).toBeInTheDocument();
    expect(screen.getByTestId('title-error')).toHaveTextContent('Bug title is required.');
  });

  it('updates report fields and autosaves changes to storage with debounce', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('input-title')).toHaveValue('Initial Bug Title');
    });

    // Update title
    const titleInput = screen.getByTestId('input-title');
    fireEvent.change(titleInput, { target: { value: 'Updated Bug Title' } });

    // Update steps
    const stepsInput = screen.getByTestId('input-steps');
    fireEvent.change(stepsInput, { target: { value: 'New Step 1, New Step 2' } });

    // Update severity to Critical
    const criticalPill = screen.getByTestId('severity-pill-Critical');
    fireEvent.click(criticalPill);

    // Should indicate saving
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saving...');

    // Wait for debounced autosave to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('save-status')).toHaveTextContent('Saved locally');
      },
      { timeout: 2000 },
    );

    // Verify persisted in storage
    const stored = await storage.getReport(mockDraft.id);
    expect(stored?.title).toBe('Updated Bug Title');
    expect(stored?.reproductionSteps).toBe('New Step 1, New Step 2');
    expect(stored?.severity).toBe('Critical');
  });

  it('handles storage save failures visibly without discarding user input', async () => {
    await storage.saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('input-title')).toHaveValue('Initial Bug Title');
    });

    // Mock saveReport failure
    vi.spyOn(storage, 'saveReport').mockRejectedValueOnce(
      new Error('QuotaExceededError: storage full'),
    );

    // Change title
    fireEvent.change(screen.getByTestId('input-title'), {
      target: { value: 'Title that fails to save' },
    });

    // Wait for save error to appear
    await waitFor(
      () => {
        expect(screen.getByTestId('save-error-alert')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    expect(screen.getByTestId('save-status')).toHaveTextContent('Save failed');
    expect(screen.getByTestId('save-error-alert')).toHaveTextContent('QuotaExceededError');

    // Crucial: User input is preserved in the form!
    expect(screen.getByTestId('input-title')).toHaveValue('Title that fails to save');
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
});
