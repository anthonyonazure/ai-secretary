/**
 * `/record` — the recording demo route. The active app shell hosts
 * this content via its `<Outlet />`; the pill mounted top-right of the
 * shell mirrors the controller's state via `useSyncRecordingPill`.
 */

import { createFileRoute } from '@tanstack/react-router';
import { RecordingController } from '../../components/feature/recording/recording-controller';

export const Route = createFileRoute('/_authenticated/record')({
  component: RecordRoute,
});

function RecordRoute() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
      <header>
        <h1 className="font-sans text-2xl font-semibold">Recording</h1>
        <p className="mt-1 text-sm text-fg-muted">
          One-tap recording, offline-first queue, resumable upload substrate.
        </p>
      </header>
      <RecordingController />
    </section>
  );
}
