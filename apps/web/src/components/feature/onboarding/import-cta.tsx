/**
 * `ImportCta` — Story 1.7.
 *
 * "Import existing audio" entry point — co-equal to the sample library
 * per UX spec § F2 user first-launch flow. We deep-link to /record;
 * Story 4.4 owns the actual recording-controller's "import audio file"
 * branch, so the CTA threads in via the controller's existing surface.
 *
 * No file-picker is mounted here directly — the recording-controller
 * route is the single owner of file ingestion logic, and divergent
 * upload paths would risk drift on the resumable-upload retry
 * contract (sibling Story 4.4 / 4.5 territory).
 */

import { Link } from '@tanstack/react-router';
import { UploadCloud } from 'lucide-react';

export function ImportCta() {
  return (
    <section
      aria-labelledby="import-cta-heading"
      className="flex flex-col gap-3"
      data-testid="import-cta"
    >
      <h2 id="import-cta-heading" className="font-sans text-base font-semibold text-fg">
        Import existing audio
      </h2>
      <p className="text-sm text-fg-muted">
        Got a recording from yesterday? Drop it in and AI Secretary will transcribe and analyze it.
      </p>
      <Link
        to="/record"
        className="inline-flex h-11 max-w-fit items-center gap-2 rounded-md border border-accent bg-accent-soft px-4 text-sm font-medium text-fg transition hover:bg-accent hover:text-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        data-testid="import-cta-link"
      >
        <UploadCloud className="h-4 w-4" aria-hidden="true" />
        Import an audio file
      </Link>
    </section>
  );
}
