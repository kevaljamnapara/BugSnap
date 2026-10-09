import { describe, it, expect } from 'vitest';
import { isRestrictedUrl, getRestrictedUrlMessage } from './urlUtils';

describe('urlUtils', () => {
  describe('isRestrictedUrl', () => {
    it('identifies undefined or empty URLs as restricted', () => {
      expect(isRestrictedUrl(undefined)).toBe(true);
      expect(isRestrictedUrl('')).toBe(true);
    });

    it('identifies internal browser URLs as restricted', () => {
      expect(isRestrictedUrl('chrome://extensions')).toBe(true);
      expect(isRestrictedUrl('chrome://settings')).toBe(true);
      expect(isRestrictedUrl('edge://settings')).toBe(true);
      expect(isRestrictedUrl('about:blank')).toBe(true);
      expect(isRestrictedUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
      expect(isRestrictedUrl('view-source:https://example.com')).toBe(true);
    });

    it('identifies Chrome Web Store URLs as restricted', () => {
      expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/something')).toBe(true);
      expect(isRestrictedUrl('https://chromewebstore.google.com/detail/something')).toBe(true);
    });

    it('identifies normal http and https pages as permitted', () => {
      expect(isRestrictedUrl('https://github.com')).toBe(false);
      expect(isRestrictedUrl('http://localhost:3000')).toBe(false);
      expect(isRestrictedUrl('https://example.com/checkout')).toBe(false);
    });
  });

  describe('getRestrictedUrlMessage', () => {
    it('returns empty/missing tab guidance', () => {
      expect(getRestrictedUrlMessage(undefined)).toContain('No active page found');
    });

    it('returns internal page explanation', () => {
      expect(getRestrictedUrlMessage('chrome://version')).toContain('Browser internal pages');
    });

    it('returns web store explanation', () => {
      expect(getRestrictedUrlMessage('https://chromewebstore.google.com/')).toContain('Chrome Web Store');
    });
  });
});
