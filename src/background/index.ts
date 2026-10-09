import { APP_NAME, APP_VERSION } from '../shared/constants';

// BugSnap Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log(`${APP_NAME} v${APP_VERSION} initialized.`);
});
