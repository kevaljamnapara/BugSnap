import { APP_NAME, APP_VERSION, DEFAULT_SEVERITY } from '../shared/constants';
import { runRetentionCleanup, generateDraftId, saveReport, getReport } from '../shared/storage';
import { BugReport, ConsoleEventKind } from '../shared/types';
import { appendConsoleEvent, normalizeConsoleEvent } from '../shared/consoleSession';

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
  if (message?.type === 'BUGSNAP_CONSOLE_EVENT') {
    (async () => {
      const reportId = typeof message.reportId === 'string' ? message.reportId : '';
      const kind: ConsoleEventKind = message.event?.kind === 'unhandled-rejection'
        ? 'unhandled-rejection'
        : 'runtime-error';
      if (!reportId) return;
      const report = await getReport(reportId);
      if (!report?.debugSession || report.debugSession.status !== 'active') return;
      const event = normalizeConsoleEvent(kind, message.event || {});
      await saveReport({
        ...report,
        debugSession: {
          ...report.debugSession,
          consoleEvents: appendConsoleEvent(report.debugSession.consoleEvents, event),
        },
        updatedAt: new Date().toISOString(),
      });
    })().catch(() => undefined);
    return;
  }

  if (message?.type === 'BUGSNAP_STOP_CONSOLE_SESSION') {
    (async () => {
      const reportId = typeof message.reportId === 'string' ? message.reportId : '';
      const report = reportId ? await getReport(reportId) : null;
      if (!report?.debugSession) {
        sendResponse({ success: false, error: 'Debug session was not found.' });
        return;
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: report.debugSession.tabId },
          func: () => {
            const cleanup = (window as Window & { __bugSnapConsoleCleanup?: () => void }).__bugSnapConsoleCleanup;
            cleanup?.();
          },
        });
      } catch {
        // A closed or restricted tab should still stop local collection.
      }
      await saveReport({
        ...report,
        debugSession: { ...report.debugSession, status: 'stopped', stoppedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      });
      sendResponse({ success: true });
    })().catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'BUGSNAP_START_CONSOLE_SESSION') {
    (async () => {
      const reportId = typeof message.reportId === 'string' ? message.reportId : '';
      const tabId = typeof message.tabId === 'number' ? message.tabId : null;
      const report = reportId ? await getReport(reportId) : null;
      if (!report || tabId === null) {
        sendResponse({ success: false, error: 'Unable to start a debug session for this report.' });
        return;
      }
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (activeReportId: string) => {
          const sessionWindow = window as Window & { __bugSnapConsoleCleanup?: () => void };
          sessionWindow.__bugSnapConsoleCleanup?.();
          const send = (kind: string, payload: Record<string, unknown>) => {
            chrome.runtime.sendMessage({ type: 'BUGSNAP_CONSOLE_EVENT', reportId: activeReportId, event: { kind, ...payload, timestamp: new Date().toISOString() } });
          };
          const onError = (event: ErrorEvent) => send('runtime-error', {
            message: event.message,
            stack: event.error instanceof Error ? event.error.stack : undefined,
            source: event.filename,
          });
          const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            send('unhandled-rejection', {
              message: reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection'),
              stack: reason instanceof Error ? reason.stack : undefined,
            });
          };
          window.addEventListener('error', onError);
          window.addEventListener('unhandledrejection', onRejection);
          sessionWindow.__bugSnapConsoleCleanup = () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            delete sessionWindow.__bugSnapConsoleCleanup;
          };
        },
        args: [reportId],
      });
      await saveReport({
        ...report,
        debugSession: { tabId, status: 'active', startedAt: new Date().toISOString(), consoleEvents: [] },
        updatedAt: new Date().toISOString(),
      });
      sendResponse({ success: true });
    })().catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

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

