/**
 * Story 4.2 service worker — minimal "drain the offline upload queue when
 * online" loop. Real workbox strategies (caching, navigation fallback, push
 * subscription) ship with later epics; this file only wires the Background
 * Sync entrypoint plus a connectivity replay so a tab that was offline
 * while a recording finished re-attempts the upload on the next focus.
 *
 * Service worker scope is limited to the host page; the IndexedDB queue is
 * the contract between the page and the worker. Typed against a structural
 * `ServiceWorkerGlobalScope` shape so the file compiles under the same
 * project as the rest of the app without a separate TS project + WebWorker
 * lib carve-out.
 */

interface SwClient {
  postMessage(message: unknown): void;
}

interface SwClientsApi {
  matchAll(options: { includeUncontrolled?: boolean; type?: 'window' }): Promise<SwClient[]>;
  claim(): Promise<void>;
}

interface SwExtendableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface SwSyncEvent extends SwExtendableEvent {
  readonly tag: string;
}

interface SwMessageEvent extends SwExtendableEvent {
  readonly data: unknown;
}

interface SwGlobalScope {
  skipWaiting(): Promise<void>;
  clients: SwClientsApi;
  addEventListener<K extends string>(type: K, listener: (event: never) => void): void;
}

const sw = self as unknown as SwGlobalScope;

const VERSION = 'v1';
const QUEUE_TAG = 'aisecretary-upload-queue';

sw.addEventListener('install', ((event: SwExtendableEvent) => {
  event.waitUntil(sw.skipWaiting());
}) as never);

sw.addEventListener('activate', ((event: SwExtendableEvent) => {
  event.waitUntil(sw.clients.claim());
}) as never);

sw.addEventListener('sync', ((event: SwSyncEvent) => {
  if (event.tag !== QUEUE_TAG) return;
  event.waitUntil(replayQueue());
}) as never);

sw.addEventListener('message', ((event: SwMessageEvent) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'replay-upload-queue') {
    event.waitUntil(replayQueue());
  }
}) as never);

async function replayQueue(): Promise<void> {
  // The actual chunk replay runs in the page (it owns the Blob refs that
  // were captured in IndexedDB). The worker's job is to nudge any open
  // clients to drain the queue. Background-Sync browsers without an open
  // client get the nudge on next focus via the `message` flow above.
  const clients = await sw.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'aisecretary:replay-upload-queue', version: VERSION });
  }
}
