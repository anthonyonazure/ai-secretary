/**
 * IndexedDB-backed offline queue for in-flight uploads. Per arch-addendums
 * § 6, in-flight upload session state must survive tab close so a user
 * who slammed their laptop shut mid-upload can resume on next visit.
 *
 * Schema is intentionally tiny:
 *   - `sessions` object store keyed by `id` (= recordingId for now; the
 *     real Story 2.1 endpoint may return a distinct `uploadId`).
 *   - Each value persists the original Blob + presigned-endpoint URL +
 *     last-acknowledged chunk index + retry attempt counter +
 *     budget-started-at timestamp.
 *
 * Story 4.5 will read `budgetStartedAt` to enforce the 10-min wall-clock
 * retry budget. We persist the field now so 4.5 doesn't migrate schema.
 */

import { type IDBPDatabase, openDB } from 'idb';

export interface PersistedUploadSession {
  id: string;
  recordingId: string;
  uploadId: string;
  endpoint: string;
  mimeType: string;
  blob: Blob;
  totalBytes: number;
  lastAckedChunkIndex: number;
  retryAttempts: number;
  budgetStartedAt: number;
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
}

const DB_NAME = 'aisecretary.upload-queue';
const DB_VERSION = 1;
const STORE = 'sessions';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable in this environment');
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function isQueueAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    await getDb();
    return true;
  } catch {
    return false;
  }
}

export async function enqueueUpload(session: PersistedUploadSession): Promise<void> {
  const db = await getDb();
  await db.put(STORE, session);
}

export async function updateUpload(
  id: string,
  patch: Partial<PersistedUploadSession>,
): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(STORE, id)) as PersistedUploadSession | undefined;
  if (!existing) return;
  await db.put(STORE, { ...existing, ...patch, updatedAt: Date.now() });
}

export async function dequeueUpload(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function listPendingUploads(): Promise<PersistedUploadSession[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as PersistedUploadSession[];
  return all.filter((session) => session.status !== 'completed');
}

/**
 * Test-only escape hatch — drops the cached DB promise so the next call
 * re-opens it. Avoids cross-test bleed.
 */
export function __resetUploadQueueForTests(): void {
  dbPromise = null;
}
