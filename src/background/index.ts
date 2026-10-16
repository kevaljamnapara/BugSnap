import { APP_NAME, APP_VERSION, DEFAULT_SEVERITY } from '../shared/constants';
import { runRetentionCleanup, generateDraftId, saveReport, getReport } from '../shared/storage';
import { BugReport } from '../shared/types';
import {
  appendConsoleEventToSession,
  appendNetworkEventToSession,
  normalizeConsoleEvent,
  normalizeNetworkEvent,
} from '../shared/consoleSession';
import { mainWorldCaptureScript, isolatedRelayScript } from '../content/debugSessionHooks';

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

// Mutex queue per reportId to serialize concurrent mutations without event loss (fixes S4)
const reportMutationQueues = new Map<string, Promise<void>>();

export function enqueueReportMutation(
  reportId: string,
  mutator: (report: BugReport) => Promise<BugReport | void> | BugReport | void,
): Promise<void> {
  const previous = reportMutationQueues.get(reportId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const report = await getReport(reportId);
      if (!report) return;
      const updated = await mutator(report);
      if (updated) {
        await saveReport(updated);
      }
    });

  reportMutationQueues.set(reportId, next);
  return next;
}

// Active session tracking: tabId -> reportId
const activeTabToReportId = new Map<number, string>();
const activeReportToNonce = new Map<string, string>();

// Listen for tab navigation / reload to detect mid-session interruptions (S9)
chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    const reportId = activeTabToReportId.get(tabId);
    if (reportId) {
      enqueueReportMutation(reportId, (report) => {
        if (report.debugSession && report.debugSession.status === 'active') {
          return {
            ...report,
            debugSession: {
              ...report.debugSession,
              interruptedByNavigation: true,
            },
            updatedAt: new Date().toISOString(),
          };
        }
      }).catch(() => undefined);
    }
  }
});

// Coordinate background messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Batch events forwarded from the ISOLATED world bridge
  if (message?.type === 'BUGSNAP_BATCH_EVENTS') {
    const reportId = typeof message.reportId === 'string' ? message.reportId : '';
    const rawEvents = Array.isArray(message.events) ? message.events : [];
    if (!reportId || rawEvents.length === 0) return;

    enqueueReportMutation(reportId, (report) => {
      if (!report.debugSession || report.debugSession.status !== 'active') return;
      let session = { ...report.debugSession };

      for (const item of rawEvents) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'console') {
          const kind = item.event?.kind || 'runtime-error';
          const norm = normalizeConsoleEvent(kind, item.event || {});
          session = appendConsoleEventToSession(session, norm);
        } else if (item.type === 'network') {
          const norm = normalizeNetworkEvent(item.event || {});
          session = appendNetworkEventToSession(session, norm);
        }
      }

      return {
        ...report,
        debugSession: session,
        updatedAt: new Date().toISOString(),
      };
    }).catch(() => undefined);
    return;
  }

  // Page unload notice from isolated relay
  if (message?.type === 'BUGSNAP_PAGE_UNLOAD') {
    const reportId = typeof message.reportId === 'string' ? message.reportId : '';
    if (!reportId) return;
    enqueueReportMutation(reportId, (report) => {
      if (report.debugSession && report.debugSession.status === 'active') {
        return {
          ...report,
          debugSession: {
            ...report.debugSession,
            interruptedByNavigation: true,
          },
          updatedAt: new Date().toISOString(),
        };
      }
    }).catch(() => undefined);
    return;
  }

  // Single network event handler (backward compatibility)
  if (message?.type === 'BUGSNAP_NETWORK_EVENT') {
    const reportId = typeof message.reportId === 'string' ? message.reportId : '';
    if (!reportId) return;
    enqueueReportMutation(reportId, (report) => {
      if (!report.debugSession || report.debugSession.status !== 'active') return;
      const norm = normalizeNetworkEvent(message.event || {});
      return {
        ...report,
        debugSession: appendNetworkEventToSession(report.debugSession, norm),
        updatedAt: new Date().toISOString(),
      };
    }).catch(() => undefined);
    return;
  }

  // Single console event handler (backward compatibility)
  if (message?.type === 'BUGSNAP_CONSOLE_EVENT') {
    const reportId = typeof message.reportId === 'string' ? message.reportId : '';
    if (!reportId) return;
    enqueueReportMutation(reportId, (report) => {
      if (!report.debugSession || report.debugSession.status !== 'active') return;
      const kind = message.event?.kind || 'runtime-error';
      const norm = normalizeConsoleEvent(kind, message.event || {});
      return {
        ...report,
        debugSession: appendConsoleEventToSession(report.debugSession, norm),
        updatedAt: new Date().toISOString(),
      };
    }).catch(() => undefined);
    return;
  }

  // Stop session
  if (message?.type === 'BUGSNAP_STOP_CONSOLE_SESSION') {
    (async () => {
      const reportId = typeof message.reportId === 'string' ? message.reportId : '';
      const report = reportId ? await getReport(reportId) : null;
      if (!report?.debugSession) {
        sendResponse({ success: false, error: 'Debug session was not found.' });
        return;
      }

      const tabId = report.debugSession.tabId;
      activeTabToReportId.delete(tabId);
      activeReportToNonce.delete(reportId);

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: () => {
            const win = window as unknown as { __bugSnapMainCleanup?: () => void };
            win.__bugSnapMainCleanup?.();
          },
        });
      } catch {
        // Tab may have closed or navigated
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'ISOLATED',
          func: () => {
            const win = window as unknown as { __bugSnapRelayCleanup?: () => void };
            win.__bugSnapRelayCleanup?.();
          },
        });
      } catch {
        // Tab may have closed or navigated
      }

      await enqueueReportMutation(reportId, (rep) => {
        if (!rep.debugSession) return;
        return {
          ...rep,
          debugSession: {
            ...rep.debugSession,
            status: 'stopped',
            stoppedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        };
      });

      sendResponse({ success: true });
    })().catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  // Start session
  if (message?.type === 'BUGSNAP_START_CONSOLE_SESSION') {
    (async () => {
      const reportId = typeof message.reportId === 'string' ? message.reportId : '';
      const tabId = typeof message.tabId === 'number' ? message.tabId : null;
      const report = reportId ? await getReport(reportId) : null;
      if (!report || tabId === null) {
        sendResponse({ success: false, error: 'Unable to start a debug session for this report.' });
        return;
      }

      const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      activeTabToReportId.set(tabId, reportId);
      activeReportToNonce.set(reportId, nonce);

      // 1. Inject ISOLATED world relay first
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        func: isolatedRelayScript,
        args: [reportId, nonce],
      });

      // 2. Inject MAIN world capture hooks
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: mainWorldCaptureScript,
        args: [nonce],
      });

      await enqueueReportMutation(reportId, (rep) => {
        return {
          ...rep,
          debugSession: {
            tabId,
            status: 'active',
            startedAt: new Date().toISOString(),
            consoleEvents: [],
            networkEvents: [],
            droppedConsoleCount: 0,
            droppedFailedNetworkCount: 0,
            droppedOtherNetworkCount: 0,
          },
          updatedAt: new Date().toISOString(),
        };
      });

      sendResponse({ success: true });
    })().catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  // Region capture
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
    return true;
  }
});
