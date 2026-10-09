import { APP_NAME, APP_VERSION } from '../shared/constants';
import { runRetentionCleanup } from '../shared/storage';

// BugSnap Background Service Worker
chrome.runtime.onInstalled.addListener(async () => {
  console.log(`${APP_NAME} v${APP_VERSION} initialized.`);
  try {
    await runRetentionCleanup();
  } catch {
    // Fail safely in background without crashing service worker
  }
});

chrome.runtime.onStartup?.addListener(async () => {
  try {
    await runRetentionCleanup();
  } catch {
    // Fail safely in background without crashing service worker
  }
});
