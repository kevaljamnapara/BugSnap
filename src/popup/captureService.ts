import { BugReport, PageMetadata, CaptureMode } from '../shared/types';
import { DEFAULT_SEVERITY } from '../shared/constants';
import { generateDraftId, saveReport } from '../shared/storage';
import { isRestrictedUrl, getRestrictedUrlMessage } from '../shared/urlUtils';
import { initSelectionOverlay } from '../content/selectionOverlay';

export interface CaptureResult {
  success: boolean;
  draft?: BugReport;
  error?: string;
}

export async function startRegionCapture(): Promise<CaptureResult> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return {
      success: false,
      error: 'Chrome extension APIs are not available in this environment.',
    };
  }

  // 1. Locate active tab
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    return {
      success: false,
      error: `Failed to query active tab: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const activeTab = tabs[0];
  if (!activeTab || !activeTab.id) {
    return {
      success: false,
      error: 'No active tab found in the current window. Please select a tab and try again.',
    };
  }

  // 2. Validate against restricted pages
  if (isRestrictedUrl(activeTab.url)) {
    return {
      success: false,
      error: getRestrictedUrlMessage(activeTab.url),
    };
  }

  // 3. Inject selection overlay into page
  try {
    if (chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: initSelectionOverlay,
      });
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Chrome scripting API is not available in this environment.',
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to initialize region capture: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function captureActiveTab(mode: CaptureMode = 'viewport'): Promise<CaptureResult> {
  if (mode === 'region') {
    return startRegionCapture();
  }

  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return {
      success: false,
      error: 'Chrome extension APIs are not available in this environment.',
    };
  }

  // 1. Locate active tab
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    return {
      success: false,
      error: `Failed to query active tab: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const activeTab = tabs[0];
  if (!activeTab || !activeTab.id) {
    return {
      success: false,
      error: 'No active tab found in the current window. Please select a tab and try again.',
    };
  }

  // 2. Validate against restricted pages
  if (isRestrictedUrl(activeTab.url)) {
    return {
      success: false,
      error: getRestrictedUrlMessage(activeTab.url),
    };
  }

  // 3. Capture visible tab
  let screenshotDataUrl: string;
  try {
    const windowId = activeTab.windowId ?? undefined;
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    if (!screenshotDataUrl) {
      return {
        success: false,
        error: 'Screenshot capture returned empty data. The page may still be loading.',
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Screenshot capture failed: ${message}. Ensure the webpage is fully loaded and retry.`,
    };
  }

  // 4. Assemble metadata (omit unavailable properties, never fabricate)
  const metadata: PageMetadata = {
    url: activeTab.url ?? '',
    title: activeTab.title ?? '',
    capturedAt: new Date().toISOString(),
    captureMode: 'viewport',
  };

  if (activeTab.width && activeTab.height) {
    metadata.viewport = {
      width: activeTab.width,
      height: activeTab.height,
    };
  }

  if (typeof navigator !== 'undefined' && navigator.platform) {
    metadata.platform = navigator.platform;
  }

  // 5. Construct Draft Bug Report
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
    metadata,
    screenshotDataUrl,
    createdAt: now,
    updatedAt: now,
  };

  // 6. Persist draft locally
  try {
    await saveReport(draft);
  } catch (err) {
    return {
      success: false,
      error: `Failed to save local draft: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 7. Open editor in a new browser tab with draft ID
  try {
    const editorUrl = chrome.runtime.getURL(`editor.html?id=${encodeURIComponent(draft.id)}`);
    await chrome.tabs.create({ url: editorUrl });
  } catch (err) {
    return {
      success: false,
      error: `Failed to open report editor: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    success: true,
    draft,
  };
}
