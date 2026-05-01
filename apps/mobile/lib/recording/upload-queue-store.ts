/**
 * Mobile offline queue. Backed by `expo-file-system` JSON serialization in
 * the app's document directory — survives app cold-start and integrates
 * with `expo-task-manager` background uploads (Story 4.5).
 *
 * The store lazily loads from disk on first read; writes flush eagerly so
 * a crash mid-recording doesn't lose the queue. `expo-sqlite` would be
 * the natural upgrade path once the queue grows past O(10) items.
 */

import * as FileSystem from 'expo-file-system';

const QUEUE_FILENAME = 'aisecretary-upload-queue.json';

export interface PersistedUploadSession {
  id: string;
  recordingId: string;
  uploadId: string;
  endpoint: string;
  mimeType: string;
  fileUri: string;
  totalBytes: number;
  lastAckedChunkIndex: number;
  retryAttempts: number;
  budgetStartedAt: number;
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
}

interface QueueDoc {
  version: 1;
  sessions: PersistedUploadSession[];
}

const EMPTY_DOC: QueueDoc = { version: 1, sessions: [] };

let cache: QueueDoc | null = null;

function queueUri(): string {
  const root = FileSystem.documentDirectory ?? '';
  return `${root}${QUEUE_FILENAME}`;
}

async function loadDoc(): Promise<QueueDoc> {
  if (cache) return cache;
  try {
    const info = await FileSystem.getInfoAsync(queueUri());
    if (!info.exists) {
      cache = { ...EMPTY_DOC, sessions: [] };
      return cache;
    }
    const raw = await FileSystem.readAsStringAsync(queueUri());
    const parsed = JSON.parse(raw) as QueueDoc;
    cache = parsed.version === 1 ? parsed : { ...EMPTY_DOC, sessions: [] };
    return cache;
  } catch {
    cache = { ...EMPTY_DOC, sessions: [] };
    return cache;
  }
}

async function saveDoc(doc: QueueDoc): Promise<void> {
  cache = doc;
  await FileSystem.writeAsStringAsync(queueUri(), JSON.stringify(doc));
}

export async function isQueueAvailable(): Promise<boolean> {
  try {
    await loadDoc();
    return true;
  } catch {
    return false;
  }
}

export async function enqueueUpload(session: PersistedUploadSession): Promise<void> {
  const doc = await loadDoc();
  const next: QueueDoc = {
    version: 1,
    sessions: [...doc.sessions.filter((s) => s.id !== session.id), session],
  };
  await saveDoc(next);
}

export async function updateUpload(
  id: string,
  patch: Partial<PersistedUploadSession>,
): Promise<void> {
  const doc = await loadDoc();
  const next: QueueDoc = {
    version: 1,
    sessions: doc.sessions.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    ),
  };
  await saveDoc(next);
}

export async function dequeueUpload(id: string): Promise<void> {
  const doc = await loadDoc();
  const next: QueueDoc = {
    version: 1,
    sessions: doc.sessions.filter((s) => s.id !== id),
  };
  await saveDoc(next);
}

export async function listPendingUploads(): Promise<PersistedUploadSession[]> {
  const doc = await loadDoc();
  return doc.sessions.filter((s) => s.status !== 'completed');
}

export function __resetUploadQueueForTests(): void {
  cache = null;
}
