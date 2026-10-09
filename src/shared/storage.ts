import { BugReport } from './types';

const DB_NAME = 'bugsnap_db';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

// In-memory fallback for test environments or when IndexedDB is unavailable
const memoryStore = new Map<string, BugReport>();

export function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB database.'));
  });
}

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
  if (!hasIndexedDB()) {
    memoryStore.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete report ${id}.`));
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
