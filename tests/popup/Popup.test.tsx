import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Popup } from '../../src/popup/Popup';
import { APP_NAME, APP_VERSION } from '../../src/shared/constants';
import * as captureService from '../../src/popup/captureService';

describe('Popup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders BugSnap title and version badge', () => {
    render(<Popup />);
    expect(screen.getByRole('heading', { name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it('renders Capture Bug and Open Report Editor buttons', () => {
    render(<Popup />);
    expect(screen.getByTestId('capture-bug-btn')).toBeInTheDocument();
    expect(screen.getByTestId('open-editor-btn')).toBeInTheDocument();
  });

  it('triggers captureActiveTab when Capture Bug is clicked', async () => {
    const captureSpy = vi.spyOn(captureService, 'captureActiveTab').mockResolvedValue({
      success: true,
      draft: {
        id: 'draft-123',
        status: 'draft',
        title: '',
        severity: 'Medium',
        reproductionSteps: '',
        expectedBehavior: '',
        actualBehavior: '',
        additionalNotes: '',
        metadata: {
          url: 'https://example.com',
          title: 'Example',
          capturedAt: '2026-10-09T22:00:00.000Z',
        },
        createdAt: '2026-10-09T22:00:00.000Z',
        updatedAt: '2026-10-09T22:00:00.000Z',
      },
    });

    render(<Popup />);
    const captureBtn = screen.getByTestId('capture-bug-btn');
    fireEvent.click(captureBtn);

    expect(captureSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
    });
  });

  it('prevents duplicate clicks while capture is in progress', async () => {
    let resolveCapture: (value: captureService.CaptureResult) => void;
    const capturePromise = new Promise<captureService.CaptureResult>((resolve) => {
      resolveCapture = resolve;
    });

    const captureSpy = vi.spyOn(captureService, 'captureActiveTab').mockReturnValue(capturePromise);

    render(<Popup />);
    const captureBtn = screen.getByTestId('capture-bug-btn');

    // First click
    fireEvent.click(captureBtn);
    expect(captureBtn).toBeDisabled();
    expect(captureBtn).toHaveTextContent('Capturing...');

    // Second click while pending
    fireEvent.click(captureBtn);
    expect(captureSpy).toHaveBeenCalledTimes(1); // Only called once!

    // Resolve the promise
    resolveCapture!({ success: true });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
  });

  it('displays error banner and retry button on capture failure', async () => {
    vi.spyOn(captureService, 'captureActiveTab').mockResolvedValue({
      success: false,
      error: 'Browser internal pages cannot be captured.',
    });

    render(<Popup />);
    const captureBtn = screen.getByTestId('capture-bug-btn');
    fireEvent.click(captureBtn);

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
      expect(
        screen.getByText('Browser internal pages cannot be captured.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('retry-capture-btn')).toBeInTheDocument();
    });
  });

  it('allows retrying capture from the error banner', async () => {
    const captureSpy = vi
      .spyOn(captureService, 'captureActiveTab')
      .mockResolvedValueOnce({
        success: false,
        error: 'First attempt failed',
      })
      .mockResolvedValueOnce({
        success: true,
      });

    render(<Popup />);
    fireEvent.click(screen.getByTestId('capture-bug-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('retry-capture-btn');
    fireEvent.click(retryBtn);

    expect(captureSpy).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
    });
  });

  it('allows dismissing the error banner', async () => {
    vi.spyOn(captureService, 'captureActiveTab').mockResolvedValue({
      success: false,
      error: 'Error to dismiss',
    });

    render(<Popup />);
    fireEvent.click(screen.getByTestId('capture-bug-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('dismiss-error-btn'));
    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });

  it('invokes chrome.tabs.create with editor URL when Open Report Editor is clicked', () => {
    render(<Popup />);
    const editorButton = screen.getByTestId('open-editor-btn');
    fireEvent.click(editorButton);

    expect(chrome.runtime.getURL).toHaveBeenCalledWith('editor.html');
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://mock-extension-id/editor.html',
    });
  });

  it('triggers captureActiveTab with region mode when Select Region is clicked', async () => {
    const captureSpy = vi.spyOn(captureService, 'captureActiveTab').mockResolvedValue({
      success: true,
    });

    render(<Popup />);
    const regionBtn = screen.getByTestId('capture-region-btn');
    await waitFor(async () => {
      fireEvent.click(regionBtn);
    });

    expect(captureSpy).toHaveBeenCalledWith('region');
  });

  it('renders Full Page as unsupported quiet note rather than a primary capture button', () => {
    render(<Popup />);
    // Full Page is not rendered as a primary capture button in the modes section
    expect(screen.queryByTestId('capture-fullpage-btn')).not.toBeInTheDocument();

    // Instead rendered as an accessible quiet notice with clear explanation
    const note = screen.getByTestId('capture-fullpage-note');
    expect(note).toBeInTheDocument();
    expect(note).toHaveAttribute(
      'title',
      'Not available in Chrome extensions without debugger access',
    );
    expect(note).toHaveTextContent(/Full Page:/i);
    expect(note).toHaveTextContent(/Not available in Chrome extensions without debugger access/i);
  });

  it('renders Start Error Session with plain description of what is collected', () => {
    render(<Popup />);
    expect(screen.getByTestId('start-debug-session-btn')).toBeInTheDocument();
    expect(
      screen.getByText('Record console errors and failed network calls on this tab until you stop.'),
    ).toBeInTheDocument();
  });
});
