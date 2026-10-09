import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from './Editor';
import { saveReport, clearAllReports } from '../shared/storage';
import { BugReport } from '../shared/types';

describe('Editor Component', () => {
  beforeEach(async () => {
    await clearAllReports();
    // Reset window.location
    window.history.pushState({}, '', '/editor.html');
  });

  const mockDraft: BugReport = {
    id: 'draft-999',
    status: 'draft',
    title: '',
    severity: 'Medium',
    reproductionSteps: '',
    expectedBehavior: '',
    actualBehavior: '',
    additionalNotes: '',
    metadata: {
      url: 'https://example.com/products/42',
      title: 'Product 42 Details',
      capturedAt: '2026-10-09T22:15:00.000Z',
      viewport: { width: 1920, height: 1080 },
      platform: 'MacIntel',
    },
    screenshotDataUrl: 'data:image/png;base64,mockPngEvidenceData',
    createdAt: '2026-10-09T22:15:00.000Z',
    updatedAt: '2026-10-09T22:15:00.000Z',
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

  it('loads and renders metadata and screenshot when valid draft ID is provided', async () => {
    await saveReport(mockDraft);
    window.history.pushState({}, '', `/editor.html?id=${mockDraft.id}`);

    render(<Editor />);

    // Wait for draft to load
    await waitFor(() => {
      expect(screen.getByTestId('metadata-card')).toBeInTheDocument();
    });

    // Check header ID badge
    expect(screen.getByText(`ID: ${mockDraft.id}`)).toBeInTheDocument();

    // Check metadata items
    expect(screen.getByTestId('meta-title')).toHaveTextContent('Product 42 Details');
    expect(screen.getByTestId('meta-url')).toHaveTextContent('https://example.com/products/42');
    expect(screen.getByTestId('meta-viewport')).toHaveTextContent('1920 × 1080 px');
    expect(screen.getByTestId('meta-platform')).toHaveTextContent('MacIntel');

    // Check screenshot image
    const screenshotImg = screen.getByTestId('screenshot-img');
    expect(screenshotImg).toBeInTheDocument();
    expect(screenshotImg).toHaveAttribute('src', 'data:image/png;base64,mockPngEvidenceData');
  });

  it('omits viewport metadata cleanly when viewport is missing from draft', async () => {
    const draftWithoutViewport: BugReport = {
      ...mockDraft,
      id: 'draft-no-viewport',
      metadata: {
        url: 'https://example.com/simple',
        title: 'Simple',
        capturedAt: '2026-10-09T22:15:00.000Z',
      },
    };

    await saveReport(draftWithoutViewport);
    window.history.pushState({}, '', `/editor.html?id=${draftWithoutViewport.id}`);

    render(<Editor />);

    await waitFor(() => {
      expect(screen.getByTestId('metadata-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('meta-viewport')).not.toBeInTheDocument();
  });
});
