import { BugReport, PageMetadata } from '../shared/types';
import { DEFAULT_SEVERITY } from '../shared/constants';
import { generateDraftId, saveReport } from '../shared/storage';
import { isRestrictedUrl, getRestrictedUrlMessage } from '../shared/urlUtils';

export interface CaptureResult {
  success: boolean;
  draft?: BugReport;
  error?: string;
}

export async function captureActiveTab(): Promise<CaptureResult> {
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
