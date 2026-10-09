import { BugReport, RetentionSettings, ActiveEditLock, CleanupResult } from './types';
import { DEFAULT_RETENTION_SETTINGS, RETENTION_PERIOD_OPTIONS, EDIT_LOCK_TIMEOUT_MS } from './constants';

export const DB_NAME = 'bugsnap_db';
export const DB_VERSION = 2;
export const STORE_NAME = 'reports';
export const SETTINGS_STORE = 'settings';
export const LOCKS_STORE = 'locks';

// In-memory fallback for test environments or when IndexedDB is unavailable
const memoryStore = new Map<string, BugReport>();
const memorySettings = new Map<string, unknown>();
const memoryLocks = new Map<string, ActiveEditLock>();

export function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(LOCKS_STORE)) {
        db.createObjectStore(LOCKS_STORE, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB database.'));
  });
}

/* ==========================================================================
   Report Persistence
   ========================================================================== */

export async function saveReport(report: BugReport): Promise<void> {
  if (!hasIndexedDB()) {
    memoryStore.set(report.id, { ...report });
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(report);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to save report.'));
  });
}

export async function getReport(id: string): Promise<BugReport | null> {
  if (!hasIndexedDB()) {
    const item = memoryStore.get(id);
    return item ? { ...item } : null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result ? (request.result as BugReport) : null);
    };
    request.onerror = () => reject(request.error ?? new Error(`Failed to retrieve report ${id}.`));
  });
}

export async function listReports(): Promise<BugReport[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values());
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve((request.result as BugReport[]) ?? []);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list reports.'));
  });
}

export async function deleteReport(id: string): Promise<void> {
  // Purge any memory locks associated with this report
  for (const [sessionId, lock] of memoryLocks.entries()) {
    if (lock.reportId === id) {
      memoryLocks.delete(sessionId);
    }
  }

  if (!hasIndexedDB()) {
    memoryStore.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, LOCKS_STORE], 'readwrite');
    const reportStore = tx.objectStore(STORE_NAME);
    const lockStore = tx.objectStore(LOCKS_STORE);

    reportStore.delete(id);

    // Also purge any active locks belonging to this reportId to prevent orphaned locks
    const lockReq = lockStore.getAll();
    lockReq.onsuccess = () => {
      const locks = (lockReq.result as ActiveEditLock[]) ?? [];
      for (const l of locks) {
        if (l.reportId === id) {
          lockStore.delete(l.sessionId);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed to delete report ${id}.`));
  });
}

export async function clearAllReports(): Promise<void> {
  memoryStore.clear();
  if (!hasIndexedDB()) {
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear reports.'));
  });
}

/* ==========================================================================
   Retention Settings Persistence
   ========================================================================== */

export async function getRetentionSettings(): Promise<RetentionSettings> {
  if (!hasIndexedDB()) {
    const item = memorySettings.get('retention') as RetentionSettings | undefined;
    return item ? { ...item } : { ...DEFAULT_RETENTION_SETTINGS };
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get('retention');

    request.onsuccess = () => {
      if (request.result && request.result.value) {
        resolve(request.result.value as RetentionSettings);
      } else {
        resolve({ ...DEFAULT_RETENTION_SETTINGS });
      }
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to retrieve retention settings.'));
  });
}

export async function saveRetentionSettings(settings: RetentionSettings): Promise<void> {
  if (!RETENTION_PERIOD_OPTIONS.includes(settings.retentionDays)) {
    throw new Error(
      `Invalid retention period: ${settings.retentionDays}. Allowed options are 7, 30, and 90 days.`,
    );
  }

  if (!hasIndexedDB()) {
    memorySettings.set('retention', { ...settings });
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.put({ key: 'retention', value: { ...settings } });

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to save retention settings.'));
  });
}

/* ==========================================================================
   Active Edit Session Locks
   ========================================================================== */

export async function acquireEditLock(reportId: string, sessionId: string): Promise<void> {
  const lock: ActiveEditLock = {
    reportId,
    sessionId,
    lastHeartbeat: Date.now(),
  };

  if (!hasIndexedDB()) {
    memoryLocks.set(sessionId, lock);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCKS_STORE, 'readwrite');
    const store = tx.objectStore(LOCKS_STORE);
    const request = store.put(lock);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to acquire edit lock.'));
  });
}

export async function renewEditLock(reportId: string, sessionId: string): Promise<void> {
  return acquireEditLock(reportId, sessionId);
}

export async function releaseEditLock(sessionId: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryLocks.delete(sessionId);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCKS_STORE, 'readwrite');
    const store = tx.objectStore(LOCKS_STORE);
    const request = store.delete(sessionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to release edit lock.'));
  });
}

export async function getActiveLocks(): Promise<ActiveEditLock[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryLocks.values());
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCKS_STORE, 'readonly');
    const store = tx.objectStore(LOCKS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve((request.result as ActiveEditLock[]) ?? []);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list edit locks.'));
  });
}

export async function clearAllLocks(): Promise<void> {
  memoryLocks.clear();
  if (!hasIndexedDB()) {
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCKS_STORE, 'readwrite');
    const store = tx.objectStore(LOCKS_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear edit locks.'));
  });
}

export async function isReportLocked(
  reportId: string,
  now = Date.now(),
  timeoutMs = EDIT_LOCK_TIMEOUT_MS,
): Promise<boolean> {
  // 1. Primary check: Unexpired lock in memory / IndexedDB
  const locks = await getActiveLocks();
  const hasFreshLock = locks.some((l) => l.reportId === reportId && now - l.lastHeartbeat <= timeoutMs);
  if (hasFreshLock) {
    return true;
  }

  // 2. Secondary defense: Check open browser tabs if chrome.tabs API is accessible (e.g. suspended tab)
  if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
    try {
      const openTabs = await chrome.tabs.query({});
      if (Array.isArray(openTabs)) {
        const hasOpenEditorTab = openTabs.some((tab) => {
          if (!tab || !tab.url) return false;
          return (
            tab.url.includes(`editor.html?id=${encodeURIComponent(reportId)}`) ||
            tab.url.includes(`editor.html?id=${reportId}`)
          );
        });
        if (hasOpenEditorTab) {
          return true;
        }
      }
    } catch {
      // Gracefully continue if tab query is restricted or unsupported in this context
    }
  }

  return false;
}

/* ==========================================================================
   Automatic Retention Cleanup
   ========================================================================== */

/**
 * Determines effective timestamp for a report based on last activity.
 * Timestamp Policy: updatedAt -> createdAt -> metadata.capturedAt
 * If all timestamps are missing or unparseable, returns null (fail-safe to prevent accidental deletion).
 */
export function getEffectiveReportTimestamp(report: BugReport): number | null {
  const candidates = [report.updatedAt, report.createdAt, report.metadata?.capturedAt];
  for (const dateStr of candidates) {
    if (dateStr) {
      const time = new Date(dateStr).getTime();
      if (!isNaN(time) && time > 0) {
        return time;
      }
    }
  }
  return null;
}

/**
 * Runs the retention cleanup algorithm according to approved rules:
 * 1. Cleanup only runs if explicitly enabled by user.
 * 2. Retention periods: 7, 30, or 90 days.
 * 3. Reports actively being edited (with a fresh heartbeat lock) are strictly protected.
 * 4. Stale locks (> 45s) are treated as expired.
 * 5. Eligible records and all associated screenshots/annotations are completely deleted.
 */
export async function runRetentionCleanup(options?: {
  now?: number;
  overrideSettings?: RetentionSettings;
  deleteFn?: (id: string) => Promise<void>;
}): Promise<CleanupResult> {
  const settings = options?.overrideSettings ?? (await getRetentionSettings());
  const deleteHandler = options?.deleteFn ?? deleteReport;

  if (!settings.enabled) {
    return {
      success: true,
      enabled: false,
      retentionDays: settings.retentionDays,
      cutoffTimestamp: 0,
      cleanedCount: 0,
      skippedLockedCount: 0,
      deletedIds: [],
      errors: [],
    };
  }

  const now = options?.now ?? Date.now();
  const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffTimestamp = now - retentionMs;

  let allReports: BugReport[] = [];
  try {
    allReports = await listReports();
  } catch (err) {
    return {
      success: false,
      enabled: true,
      retentionDays: settings.retentionDays,
      cutoffTimestamp,
      cleanedCount: 0,
      skippedLockedCount: 0,
      deletedIds: [],
      errors: [
        `Failed to list reports for cleanup: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  let cleanedCount = 0;
  let skippedLockedCount = 0;
  const deletedIds: string[] = [];
  const errors: string[] = [];

  for (const report of allReports) {
    try {
      const locked = await isReportLocked(report.id, now);
      if (locked) {
        skippedLockedCount++;
        continue;
      }

      const timestamp = getEffectiveReportTimestamp(report);
      // Strictly older than cutoff (< cutoffTimestamp)
      if (timestamp !== null && timestamp < cutoffTimestamp) {
        await deleteHandler(report.id);
        cleanedCount++;
        deletedIds.push(report.id);
      }
    } catch (err) {
      errors.push(
        `Failed to delete expired report "${report.id}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    enabled: true,
    retentionDays: settings.retentionDays,
    cutoffTimestamp,
    cleanedCount,
    skippedLockedCount,
    deletedIds,
    errors,
  };
}

/**
 * Clears all stores in both memory and IndexedDB. Used primarily for test resetting.
 */
export async function clearAllStorage(): Promise<void> {
  memoryStore.clear();
  memorySettings.clear();
  memoryLocks.clear();

  if (!hasIndexedDB()) {
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, SETTINGS_STORE, LOCKS_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(SETTINGS_STORE).clear();
    tx.objectStore(LOCKS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear storage.'));
  });
}
