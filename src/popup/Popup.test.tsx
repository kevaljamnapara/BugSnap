import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Popup } from './Popup';
import { APP_NAME, APP_VERSION } from '../shared/constants';

describe('Popup Component', () => {
  it('renders BugSnap title and version badge', () => {
    render(<Popup />);
    expect(screen.getByRole('heading', { name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it('renders privacy and cost footer note', () => {
    render(<Popup />);
    expect(screen.getByText(/Offline only • ₹0 budget • Privacy-first/i)).toBeInTheDocument();
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
});
