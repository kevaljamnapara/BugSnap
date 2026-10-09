import { APP_NAME, APP_VERSION, DEFAULT_SEVERITY } from '../shared/constants';
import { runRetentionCleanup, generateDraftId, saveReport } from '../shared/storage';
import { BugReport } from '../shared/types';

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

// Coordinate region capture when overlay reports a selection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'BUGSNAP_REGION_CAPTURED') {
    (async () => {
      try {
        const windowId = sender.tab?.windowId;
        const screenshotDataUrl = windowId !== undefined
          ? await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
          : await chrome.tabs.captureVisibleTab({ format: 'png' });
        if (!screenshotDataUrl) {
          sendResponse({ success: false, error: 'Empty screenshot captured.' });
          return;
        }

        const now = new Date().toISOString();
        const draftId = generateDraftId();

        const draft: BugReport = {
          id: draftId,
          status: 'draft',
          title: '',
          severity: DEFAULT_SEVERITY,
          reproductionSteps: '',
          expectedBehavior: '',
          actualBehavior: '',
          additionalNotes: '',
          metadata: {
            url: message.metadata?.url || sender.tab?.url || '',
            title: message.metadata?.title || sender.tab?.title || '',
            capturedAt: now,
            viewport: message.metadata?.viewport,
            captureMode: 'region',
            diagnostics: message.metadata?.diagnostics,
          },
          screenshotDataUrl,
          cropRegion: message.region,
          createdAt: now,
          updatedAt: now,
        };

        await saveReport(draft);

        const editorUrl = chrome.runtime.getURL(`editor.html?id=${encodeURIComponent(draft.id)}`);
        await chrome.tabs.create({ url: editorUrl });
        sendResponse({ success: true, draftId });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

