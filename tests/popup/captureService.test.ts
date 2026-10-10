import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureActiveTab } from '../../src/popup/captureService';
import { getReport, clearAllReports } from '../../src/shared/storage';

describe('captureService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAllReports();
  });

  it('captures active tab, persists draft, and opens editor with draft ID', async () => {
    // Mock tab query
    const mockTab: chrome.tabs.Tab = {
      id: 42,
      index: 0,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      incognito: false,
      url: 'https://example.com/checkout',
      title: 'Checkout Page',
      width: 1440,
      height: 900,
      selected: true,
      discarded: false,
      autoDiscardable: false,
      groupId: -1,
      frozen: false,
    };

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTab]);
    (chrome.tabs.captureVisibleTab as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'data:image/png;base64,mockPngBase64Data',
    );
    (chrome.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `chrome-extension://mock-id/${path}`,
    );
    (chrome.tabs.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await captureActiveTab();

    expect(result.success).toBe(true);
    expect(result.draft).toBeDefined();
    expect(result.draft?.metadata.url).toBe('https://example.com/checkout');
    expect(result.draft?.metadata.title).toBe('Checkout Page');
    expect(result.draft?.metadata.viewport).toEqual({ width: 1440, height: 900 });
    expect(result.draft?.screenshotDataUrl).toBe('data:image/png;base64,mockPngBase64Data');
    expect(result.draft?.status).toBe('draft');

    // Verify stored locally
    const stored = await getReport(result.draft!.id);
    expect(stored).toEqual(result.draft);

    // Verify editor tab opened
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: `chrome-extension://mock-id/editor.html?id=${result.draft!.id}`,
    });
  });

  it('returns an error and avoids capture for restricted browser pages', async () => {
    const restrictedTab = {
      id: 99,
      url: 'chrome://settings',
      title: 'Settings',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([restrictedTab]);

    const result = await captureActiveTab();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Browser internal pages');
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('returns an error when no active tab is found', async () => {
    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await captureActiveTab();

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab found');
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('handles capture API failures gracefully with a retryable error', async () => {
    const mockTab = {
      id: 10,
      url: 'https://example.com',
      title: 'Example',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTab]);
    (chrome.tabs.captureVisibleTab as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Cannot access contents of the page'),
    );

    const result = await captureActiveTab();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Screenshot capture failed');
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('omits viewport metadata cleanly when tab dimensions are missing', async () => {
    const mockTab = {
      id: 11,
      url: 'https://example.com/no-dimensions',
      title: 'No Dim',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTab]);
    (chrome.tabs.captureVisibleTab as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'data:image/png;base64,mockPngData',
    );
    (chrome.tabs.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await captureActiveTab();

    expect(result.success).toBe(true);
    expect(result.draft?.metadata.viewport).toBeUndefined();
  });

  it('injects selection overlay via chrome.scripting.executeScript for region capture', async () => {
    const mockTab = {
      id: 55,
      url: 'https://example.com/app',
      title: 'App',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTab]);
    (chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await captureActiveTab('region');

    expect(result.success).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 55 },
      func: expect.any(Function),
    });
  });

  it('rejects region capture on restricted pages before script injection', async () => {
    const mockTab = {
      id: 56,
      url: 'chrome://extensions',
      title: 'Extensions',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTab]);

    const result = await captureActiveTab('region');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Browser internal pages');
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('captures active tab successfully even when tab url is undefined', async () => {
    const mockTabWithoutUrl: chrome.tabs.Tab = {
      id: 77,
      index: 0,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: false,
      groupId: -1,
      frozen: false,
    };

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockTabWithoutUrl]);
    (chrome.tabs.captureVisibleTab as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'data:image/png;base64,mockPngBase64Data',
    );
    (chrome.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `chrome-extension://mock-id/${path}`,
    );
    (chrome.tabs.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await captureActiveTab();

    expect(result.success).toBe(true);
    expect(result.draft).toBeDefined();
    expect(result.draft?.metadata.url).toBe('');
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, { format: 'png' });
  });

  it('identifies restricted pages using pendingUrl', async () => {
    const pendingRestrictedTab = {
      id: 88,
      pendingUrl: 'chrome://settings',
      windowId: 1,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([pendingRestrictedTab]);

    const result = await captureActiveTab();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Browser internal pages');
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('falls back to currentWindow if lastFocusedWindow returns no tabs', async () => {
    const fallbackTab = {
      id: 99,
      url: 'https://example.com/fallback',
      windowId: 2,
    } as chrome.tabs.Tab;

    (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // lastFocusedWindow
      .mockResolvedValueOnce([fallbackTab]); // currentWindow

    (chrome.tabs.captureVisibleTab as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'data:image/png;base64,mockPngBase64Data',
    );
    (chrome.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `chrome-extension://mock-id/${path}`,
    );
    (chrome.tabs.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await captureActiveTab();

    expect(result.success).toBe(true);
    expect(result.draft?.metadata.url).toBe('https://example.com/fallback');
    expect(chrome.tabs.query).toHaveBeenCalledTimes(2);
  });
});
