import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Minimal Chrome API mock for testing environment
const chromeMock = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(),
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
});
