import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mainWorldCaptureScript, isolatedRelayScript } from '../../src/content/debugSessionHooks';

interface WindowWithBugSnapCleanups extends Window {
  __bugSnapMainCleanup?: () => void;
  __bugSnapRelayCleanup?: () => void;
}

interface PostedBatchMessage {
  source: string;
  nonce: string;
  events: Array<{
    type: 'console' | 'network';
    event: {
      url?: string;
      error?: string;
      message?: string;
      status?: number;
      kind?: string;
      level?: string;
    };
  }>;
}

describe('Debug Session Hooks & Isolated Bridge', () => {
  const nonce = 'test-nonce-123';
  let postedMessages: PostedBatchMessage[] = [];

  beforeEach(() => {
    postedMessages = [];
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
      postedMessages.push(data as PostedBatchMessage);
    });
  });

  afterEach(() => {
    const win = window as unknown as WindowWithBugSnapCleanups;
    if (typeof win.__bugSnapMainCleanup === 'function') {
      win.__bugSnapMainCleanup();
    }
    if (typeof win.__bugSnapRelayCleanup === 'function') {
      win.__bugSnapRelayCleanup();
    }
    vi.restoreAllMocks();
  });

  it('preserves console.error and console.warn behavior, calling originals with identical args', () => {
    const originalError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mainWorldCaptureScript(nonce);

    const testError = new Error('Test console error');
    console.error('Error occurred:', testError, { detail: 123 });
    console.warn('Warning: deprecated API', 456);

    expect(originalError).toHaveBeenCalledWith('Error occurred:', testError, { detail: 123 });
    expect(originalWarn).toHaveBeenCalledWith('Warning: deprecated API', 456);

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();

    // Verify cleanup restores originals
    expect(console.error).toBe(originalError);
    expect(console.warn).toBe(originalWarn);
  });

  it('fetch hook preserves Response body readability for the page on failed status >= 400', async () => {
    const jsonBody = JSON.stringify({ error: 'Not Found', code: 404 });
    const mockResponse = new Response(jsonBody, {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' },
    });

    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    window.fetch = mockFetch as unknown as typeof window.fetch;

    mainWorldCaptureScript(nonce);

    // Call wrapped fetch
    const response = await window.fetch('https://api.example.com/missing');

    // Page must still be able to read response body!
    const text = await response.text();
    expect(text).toBe(jsonBody);

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();
  });

  it('fetch hook preserves thrown errors without altering error type or message', async () => {
    const networkError = new TypeError('Failed to fetch');
    const mockFetch = vi.fn().mockRejectedValue(networkError);
    window.fetch = mockFetch as unknown as typeof window.fetch;

    mainWorldCaptureScript(nonce);

    await expect(window.fetch('https://api.example.com/unreachable')).rejects.toThrow('Failed to fetch');

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();
  });

  it('idempotent install does not stack wrappers and cleanup restores originals', () => {
    const baseFetch = vi.fn();
    window.fetch = baseFetch as unknown as typeof window.fetch;

    mainWorldCaptureScript(nonce);
    const firstWrapper = window.fetch;
    expect(firstWrapper).not.toBe(baseFetch);

    // Install again
    mainWorldCaptureScript(nonce);
    expect(window.fetch).toBeDefined();

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();

    // Should restore the underlying baseFetch, not the first wrapper
    expect(window.fetch).toBe(baseFetch);
  });

  it('does not clobber wrapper if page replaced it after BugSnap', () => {
    const baseFetch = vi.fn();
    window.fetch = baseFetch as unknown as typeof window.fetch;

    mainWorldCaptureScript(nonce);

    // Simulate page or another library replacing fetch after us
    const pageFetch = vi.fn();
    window.fetch = pageFetch as unknown as typeof window.fetch;

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();

    // Must NOT clobber the page's new fetch!
    expect(window.fetch).toBe(pageFetch);
  });

  it('subresource load failures are captured via window error listener in capture phase', () => {
    mainWorldCaptureScript(nonce);

    const img = document.createElement('img');
    img.src = 'https://cdn.example.com/broken.png';
    document.body.appendChild(img);

    const errorEvent = new Event('error', { bubbles: false });
    Object.defineProperty(errorEvent, 'target', { value: img });

    window.dispatchEvent(errorEvent);

    const win = window as unknown as WindowWithBugSnapCleanups;
    win.__bugSnapMainCleanup?.();

    // Check posted messages
    const flushes = postedMessages.filter((m) => m.source === 'BUGSNAP_MAIN' && m.nonce === nonce);
    expect(flushes.length).toBeGreaterThan(0);
    const allEvents = flushes.flatMap((f) => f.events);
    const imgEvent = allEvents.find((e) => e.type === 'network' && e.event.url === 'https://cdn.example.com/broken.png');
    expect(imgEvent).toBeDefined();
    expect(imgEvent?.event.error).toBe('Failed to load <img>');

    img.remove();
  });

  it('isolated relay validates nonce and forwards batch events to chrome.runtime.sendMessage', () => {
    const sendMessageSpy = vi.fn();
    (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof sendMessageSpy } } }).chrome = {
      runtime: { sendMessage: sendMessageSpy },
    };

    isolatedRelayScript('rep-123', nonce);

    // 1. Message with incorrect nonce must be rejected
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'BUGSNAP_MAIN',
          nonce: 'wrong-nonce',
          events: [{ type: 'console', event: { message: 'hack' } }],
        },
      }),
    );
    expect(sendMessageSpy).not.toHaveBeenCalled();

    // 2. Message with valid nonce is forwarded
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'BUGSNAP_MAIN',
          nonce,
          events: [{ type: 'console', event: { message: 'valid error' } }],
        },
      }),
    );
    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: 'BUGSNAP_BATCH_EVENTS',
      reportId: 'rep-123',
      events: [{ type: 'console', event: { message: 'valid error' } }],
    });
  });
});
