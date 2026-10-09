import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportManagement } from './ReportManagement';
import * as storage from '../shared/storage';
import { BugReport } from '../shared/types';

describe('ReportManagement Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clearAllStorage();
  });

  const mockReports: BugReport[] = [
    {
      id: 'rep-saved-1',
      status: 'saved',
      title: 'Checkout button broken',
      severity: 'Critical',
      reproductionSteps: 'Step 1',
      expectedBehavior: 'Works',
      actualBehavior: 'Broken',
      additionalNotes: '',
      metadata: {
        url: 'https://example.com/checkout',
        title: 'Checkout Page',
        capturedAt: '2026-10-09T20:00:00.000Z',
      },
      screenshotDataUrl: 'data:image/png;base64,mockPng',
      annotations: [
        {
          id: 'annot-1',
          type: 'rectangle',
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          color: '#ef4444',
          strokeWidth: 4,
        },
      ],
      createdAt: '2026-10-09T20:00:00.000Z',
      updatedAt: '2026-10-09T20:00:00.000Z',
    },
    {
      id: 'rep-draft-2',
      status: 'draft',
      title: 'Navigation bar overlap',
      severity: 'Medium',
      reproductionSteps: 'Step 1',
      expectedBehavior: 'Clean',
      actualBehavior: 'Overlap',
      additionalNotes: '',
      metadata: {
        url: 'https://example.com/home',
        title: 'Home Page',
        capturedAt: '2026-10-09T21:00:00.000Z',
      },
      createdAt: '2026-10-09T21:00:00.000Z',
      updatedAt: '2026-10-09T21:00:00.000Z',
    },
  ];

  it('renders all saved reports and drafts with proper badges and metadata', async () => {
    for (const rep of mockReports) {
      await storage.saveReport(rep);
    }

    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('report-title-rep-saved-1')).toHaveTextContent(
        'Checkout button broken',
      );
      expect(screen.getByTestId('report-title-rep-draft-2')).toHaveTextContent(
        'Navigation bar overlap',
      );
    });

    expect(screen.getByTestId('badge-status-rep-saved-1')).toHaveTextContent('saved');
    expect(screen.getByTestId('badge-status-rep-draft-2')).toHaveTextContent('draft');
    expect(screen.getByTestId('badge-severity-rep-saved-1')).toHaveTextContent('Critical');
  });

  it('filters reports by Saved and Draft tabs', async () => {
    for (const rep of mockReports) {
      await storage.saveReport(rep);
    }

    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('report-title-rep-saved-1')).toBeInTheDocument();
    });

    // Switch to Saved tab
    fireEvent.click(screen.getByTestId('tab-filter-saved'));
    expect(screen.getByTestId('report-title-rep-saved-1')).toBeInTheDocument();
    expect(screen.queryByTestId('report-title-rep-draft-2')).not.toBeInTheDocument();

    // Switch to Drafts tab
    fireEvent.click(screen.getByTestId('tab-filter-draft'));
    expect(screen.queryByTestId('report-title-rep-saved-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('report-title-rep-draft-2')).toBeInTheDocument();
  });

  it('renders helpful empty state when no reports exist', async () => {
    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('reports-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No reports found/i)).toBeInTheDocument();
    });
  });

  it('calls onOpenReport when Open / Edit button is clicked', async () => {
    await storage.saveReport(mockReports[0]);
    const handleOpen = vi.fn();

    render(<ReportManagement onOpenReport={handleOpen} />);

    await waitFor(() => {
      expect(screen.getByTestId('open-report-btn-rep-saved-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('open-report-btn-rep-saved-1'));
    expect(handleOpen).toHaveBeenCalledWith('rep-saved-1');
  });

  it('opens confirmation modal and cancels deletion when Cancel is clicked', async () => {
    await storage.saveReport(mockReports[0]);

    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-report-btn-rep-saved-1')).toBeInTheDocument();
    });

    // Click delete
    fireEvent.click(screen.getByTestId('delete-report-btn-rep-saved-1'));

    // Modal appears
    expect(screen.getByTestId('delete-report-modal')).toBeInTheDocument();
    expect(screen.getByText(/Delete report permanently\?/i)).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByTestId('cancel-delete-btn'));

    expect(screen.queryByTestId('delete-report-modal')).not.toBeInTheDocument();
    expect(await storage.getReport('rep-saved-1')).not.toBeNull();
  });

  it('permanently deletes report and evidence from storage upon confirmation', async () => {
    await storage.saveReport(mockReports[0]);

    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-report-btn-rep-saved-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-report-btn-rep-saved-1'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('delete-report-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('reports-empty-state')).toBeInTheDocument();
    });

    expect(await storage.getReport('rep-saved-1')).toBeNull();
  });

  it('displays error message if manual deletion fails', async () => {
    await storage.saveReport(mockReports[0]);

    vi.spyOn(storage, 'deleteReport').mockRejectedValueOnce(
      new Error('Disk write locked'),
    );

    render(<ReportManagement onOpenReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-report-btn-rep-saved-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-report-btn-rep-saved-1'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Disk write locked/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId('delete-report-modal')).toBeInTheDocument();
  });

  describe('Retention Settings UI', () => {
    it('displays retention cleanup disabled by default with Off badge', async () => {
      render(<ReportManagement onOpenReport={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('retention-toggle')).not.toBeChecked();
        expect(screen.getByTestId('retention-status-badge')).toHaveTextContent('Off');
      });

      // Period buttons disabled while cleanup is off
      expect(screen.getByTestId('retention-option-7')).toBeDisabled();
      expect(screen.getByTestId('retention-option-30')).toBeDisabled();
      expect(screen.getByTestId('retention-option-90')).toBeDisabled();
    });

    it('toggles automatic cleanup and saves setting in storage', async () => {
      render(<ReportManagement onOpenReport={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('retention-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('retention-toggle');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId('retention-status-badge')).toHaveTextContent('Active');
        expect(screen.getByTestId('settings-feedback')).toHaveTextContent(/Automatic cleanup enabled/i);
      });

      const saved = await storage.getRetentionSettings();
      expect(saved.enabled).toBe(true);

      // Period buttons become enabled
      expect(screen.getByTestId('retention-option-7')).not.toBeDisabled();
      expect(screen.getByTestId('retention-option-90')).not.toBeDisabled();
    });

    it('updates retention period and saves in storage', async () => {
      await storage.saveRetentionSettings({ enabled: true, retentionDays: 30 });

      render(<ReportManagement onOpenReport={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('retention-option-90')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retention-option-90'));

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback')).toHaveTextContent('Retention period updated to 90 days.');
      });

      const saved = await storage.getRetentionSettings();
      expect(saved.retentionDays).toBe(90);
    });

    it('triggers manual cleanup on demand and displays result summary', async () => {
      await storage.saveRetentionSettings({ enabled: true, retentionDays: 7 });
      await storage.saveReport(mockReports[0]);

      render(<ReportManagement onOpenReport={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('run-cleanup-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('run-cleanup-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('cleanup-result-msg')).toBeInTheDocument();
      });

      expect(screen.getByTestId('cleanup-result-msg')).toHaveTextContent(/Cleanup completed/i);
    });
  });
});
