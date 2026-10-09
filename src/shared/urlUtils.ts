const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'view-source:',
  'data:',
  'javascript:',
];

export function isRestrictedUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') {
    return true;
  }

  const trimmed = url.trim().toLowerCase();

  if (RESTRICTED_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }

  if (
    trimmed.includes('chrome.google.com/webstore') ||
    trimmed.includes('chromewebstore.google.com')
  ) {
    return true;
  }

  return false;
}

export function getRestrictedUrlMessage(url?: string): string {
  if (!url) {
    return 'No active page found to capture. Please open a webpage and try again.';
  }

  const trimmed = url.trim().toLowerCase();

  if (
    trimmed.startsWith('chrome://') ||
    trimmed.startsWith('edge://') ||
    trimmed.startsWith('about:')
  ) {
    return 'Browser internal pages (such as settings, extensions, and new tab pages) cannot be captured.';
  }

  if (
    trimmed.includes('chrome.google.com/webstore') ||
    trimmed.includes('chromewebstore.google.com')
  ) {
    return 'Chrome Web Store pages are restricted by browser security policies and cannot be captured.';
  }

  if (trimmed.startsWith('chrome-extension://')) {
    return 'Extension internal pages cannot be captured.';
  }

  return 'This page is restricted by browser security policies and cannot be captured. Please switch to a regular website (e.g. https://).';
}
