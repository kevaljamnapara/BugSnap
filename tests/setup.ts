import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Minimal Chrome API mock for testing environment
export const chromeMock = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: undefined,
  },
  tabs: {
    query: vi.fn(),
    captureVisibleTab: vi.fn(),
    create: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
};

// Assign mock to global window
Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
});

// Mock window.close so jsdom window isn't destroyed during test teardown
if (typeof window !== 'undefined') {
  window.close = vi.fn();
}

// Polyfill Blob.prototype.arrayBuffer in jsdom test environment using FileReader
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(this);
    });
  };
}
