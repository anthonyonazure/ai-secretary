/**
 * Story 4.2 demo unit — wires button + pill + state machine + recording
 * hooks into a single end-to-end recording surface. This is the
 * vertical-slice composition; production AppShell integration (Story 1.6)
 * will hoist the pill into the global header slot and the button into
 * the per-route action area, but the wiring contract stays identical.
 *
 * Story 4.3 — replaced the `ConsentModalStub` with the real
 * `ConsentModal` (shape A) + `ConsentQrCard` (shape C). The orchestrator
 * decides which surfaces are required given the meeting context.
 */

import {
  type ConsentLegalBasis,
  ConsentOrchestrator,
  type ConsentParticipantInput,
  type ConsentPolicy,
  type ConsentRecord,
  type ConsentSurface,
  type MeetingSource,
} from '@aisecretary/consent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildAuthDeps } from '../../../hooks/use-auth';
import { useRecording } from '../../../hooks/use-recording';
import { useRecordingHeartbeat } from '../../../hooks/use-recording-heartbeat';
import { useRecordingStateMachine } from '../../../hooks/use-recording-state-machine';
import { useResumableUpload } from '../../../hooks/use-resumable-upload';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';
import { createPresignedPoster } from '../../../lib/recording/presigned-poster';
import { ConsentModal } from './consent-modal';
import { ConsentQrCard } from './consent-qr-card';
import { RecordingButton } from './recording-button';
import { useSyncRecordingPill } from './recording-state-store';
import { type RecordingState as PillState, RecordingStatusPill } from './recording-status-pill';
import { UploadRetryBanner } from './upload-retry-banner';
import { useConsentStore } from './use-consent-store';

export interface RecordingControllerProps {
  /** Meeting context — defaults are scoped for the Story 4.2 vertical-slice demo. */
  meetingSource?: MeetingSource;
  tenantPolicy?: ConsentPolicy;
  participants?: ReadonlyArray<ConsentParticipantInput>;
  /** Org-configurable disclosure paragraph appended to the default copy. */
  customDisclosure?: string;
  orgName?: string;
  /** Best-effort tenant + meeting ids; placeholders until Story 1.4 lands. */
  tenantId?: string;
  meetingId?: string;
}

const DEFAULT_POLICY: ConsentPolicy = { default: 'us' };

export function RecordingController({
  meetingSource = 'web-mic',
  tenantPolicy = DEFAULT_POLICY,
  participants = [],
  customDisclosure,
  orgName,
  tenantId,
  meetingId,
}: RecordingControllerProps) {
  const machine = useRecordingStateMachine();
  const recording = useRecording();
  // Story 2.1 — build the presigned poster once per mount. `buildAuthDeps`
  // wires the auth-fetch wrapper bound to the in-memory access token store,
  // so 401s trigger the standard refresh-and-retry behaviour.
  const authDeps = useMemo(() => buildAuthDeps(), []);
  const presignedPoster = useMemo(
    () =>
      createPresignedPoster({
        apiBase: resolveApiBaseUrl(),
        authFetch: authDeps.authFetch,
      }),
    [authDeps.authFetch],
  );
  // Track the recording id we last saw so the banner + abort path can
  // reference it after the FSM transitions to `error`.
  const [exhaustedRecordingId, setExhaustedRecordingId] = useState<string | null>(null);
  const [exhaustedLastError, setExhaustedLastError] = useState<string | null>(null);
  const upload = useResumableUpload({
    poster: presignedPoster.poster,
    onProgress: (fraction) => machine.reportProgress(fraction),
    onBudgetExhausted: ({ recordingId, lastError }) => {
      setExhaustedRecordingId(recordingId);
      setExhaustedLastError(lastError.message);
      machine.fail('upload-retry-exhausted', true);
      // Tell the server we've given up; the abort handler enqueues
      // push + email escalation when the reason matches.
      const apiBase = resolveApiBaseUrl();
      const url = `${apiBase}/api/v1/recordings/${recordingId}/abort`;
      void authDeps.authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'upload-retry-exhausted' }),
      });
    },
  });

  // Story 4.4 — emit a 30s heartbeat while the recording is in-flight.
  // The hook stops when `recordingId` flips to null (terminal states).
  const heartbeatRecordingId =
    machine.state.kind === 'recording' || machine.state.kind === 'uploading'
      ? machine.state.kind === 'recording'
        ? null // pre-upload, no server-side recording row yet
        : machine.state.recordingId
      : null;
  useRecordingHeartbeat(heartbeatRecordingId, {
    authFetch: authDeps.authFetch,
    apiBase: resolveApiBaseUrl(),
  });
  const consentStore = useConsentStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);

  const surfaces = useMemo<ConsentSurface[]>(
    () =>
      ConsentOrchestrator.surfacesFor({
        meetingSource,
        tenantPolicy,
        participants,
      }),
    [meetingSource, tenantPolicy, participants],
  );

  const shapeASurface = surfaces.find((s) => s.shape === 'A');
  const shapeCSurface = surfaces.find((s) => s.shape === 'C');
  const legalBasis: ConsentLegalBasis = shapeASurface?.legalBasis ?? 'legitimate-interest';

  // Drive the elapsed-seconds counter purely off the machine's startedAt
  // so the pill stays in sync without leaking platform state.
  useEffect(() => {
    if (machine.state.kind !== 'recording') return;
    const startedAt = machine.state.startedAt;
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [machine.state]);

  // Reset the elapsed counter whenever we leave the recording cluster.
  useEffect(() => {
    if (machine.state.kind === 'idle') setElapsedSeconds(0);
  }, [machine.state.kind]);

  const onStart = useCallback(() => {
    machine.requestConsent();
  }, [machine]);

  const onAcknowledgeConsent = useCallback(async () => {
    try {
      const { deviceName: name } = await recording.start();
      setDeviceName(name);
      machine.grantConsent(name);

      // Capture the shape-A acknowledgment to the local store. Real
      // persistence to /api/v1/consents lands in Story 1.4 follow-up
      // — see use-consent-store.ts.
      const record: ConsentRecord = {
        tenantId: tenantId ?? '00000000-0000-0000-0000-000000000000',
        meetingId: meetingId ?? '00000000-0000-0000-0000-000000000000',
        shape: 'A',
        legalBasis,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedVia: 'modal',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };
      consentStore.add(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recording could not start';
      machine.denyConsent(message);
    }
  }, [machine, recording, consentStore, tenantId, meetingId, legalBasis]);

  const onCancelConsent = useCallback(() => {
    machine.denyConsent('User cancelled consent');
    machine.reset();
  }, [machine]);

  const onStop = useCallback(async () => {
    machine.stop();
    try {
      const result = await recording.stop();
      // Story 2.1 — three-step lifecycle:
      //   1. POST /initiate mints a server-side recording id + upload id.
      //   2. uploadBlobInChunks via the presigned poster (per-chunk PUTs).
      //   3. POST /complete with the etags collected from each PUT.
      const session = await presignedPoster.initiate({
        contentType: result.mimeType,
        sizeBytes: result.blob.size,
        ...(meetingId !== undefined ? { meetingId } : {}),
      });
      machine.startUpload(session.recordingId);
      const uploadResult = await upload.upload({
        recordingId: session.recordingId,
        uploadId: session.uploadId,
        blob: result.blob,
        mimeType: result.mimeType,
      });
      const parts = uploadResult.parts.map((p) => ({
        // Multipart parts in S3 are 1-indexed; chunk-uploader uses 0-indexed.
        partNumber: p.chunkIndex + 1,
        etag: p.etag,
      }));
      await presignedPoster.complete(session.recordingId, parts);
      machine.finishUpload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      machine.fail(message, true);
    }
  }, [machine, recording, upload, presignedPoster, meetingId]);

  const onRetry = useCallback(() => {
    machine.reset();
  }, [machine]);

  const pillState = useMemo<PillState>(() => {
    switch (machine.state.kind) {
      case 'recording':
      case 'uploading':
        return 'recording';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  }, [machine.state.kind]);

  // Story 1.6 — bridge our state machine into the global pill store so
  // `AppShellFrame` can render the pill in its own slot. The controller
  // still mounts its own `RecordingStatusPill` below as a redundant
  // local surface for the recording demo route; both reflect the same
  // store / state machine and stay in sync without restructuring the
  // controller's internals.
  useSyncRecordingPill({
    state: pillState,
    elapsedSeconds,
    ...(deviceName !== undefined ? { device: { name: deviceName, type: 'builtin' as const } } : {}),
  });

  const consentOpen = machine.state.kind === 'requesting-consent';
  const visibilityWarning =
    !recording.isVisible && machine.state.kind === 'recording'
      ? 'Tab is hidden — mobile browsers may pause recording until you return.'
      : null;

  // The shape C QR is rendered alongside the active recording when org
  // policy demands it. It surfaces an opaque ack-token; Story 1.4 mints
  // the real token server-side.
  const showQrCard = shapeCSurface !== undefined && machine.state.kind === 'recording';
  // One token per controller mount — kept stable across re-renders.
  const [ackToken] = useState(() => generateLocalId());

  return (
    <section className="flex flex-col gap-4 p-6" aria-label="Meeting recording">
      <RecordingStatusPill
        state={pillState}
        elapsedSeconds={elapsedSeconds}
        {...(deviceName !== undefined
          ? { device: { name: deviceName, type: 'builtin' as const } }
          : {})}
      />
      <RecordingButton
        state={machine.state}
        onStart={onStart}
        onStop={onStop}
        onRetry={onRetry}
        disabled={!recording.isSupported}
      />
      {!recording.isSupported ? (
        <output className="text-sm text-fg-muted">
          Recording is not supported in this browser.
        </output>
      ) : null}
      {visibilityWarning ? (
        <output className="rounded-md bg-accent-soft p-3 text-sm text-fg-muted">
          {visibilityWarning}
        </output>
      ) : null}
      {machine.state.kind === 'error' &&
      machine.state.reason === 'upload-retry-exhausted' &&
      exhaustedRecordingId ? (
        <UploadRetryBanner
          recordingId={exhaustedRecordingId}
          {...(exhaustedLastError ? { lastErrorMessage: exhaustedLastError } : {})}
          onRetry={() => {
            // Wipe the prior banner state, drop the FSM back to idle so
            // the user can re-stop and re-upload. A real "retry the
            // pending blob" path lives in the resumable-upload hook +
            // upload-queue-store; for now we surface the entry point and
            // let the user re-stop.
            setExhaustedRecordingId(null);
            setExhaustedLastError(null);
            machine.reset();
          }}
          onUploadManually={() => {
            // Story 4.5 — leaves the recording on-device. The user can
            // export the bytes via the queue store; that surface lives
            // in a follow-up.
            setExhaustedRecordingId(null);
            setExhaustedLastError(null);
            machine.reset();
          }}
        />
      ) : machine.state.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm text-fg"
        >
          {machine.state.reason}
        </div>
      ) : null}
      <ConsentModal
        open={consentOpen}
        legalBasis={legalBasis}
        {...(customDisclosure !== undefined ? { customDisclosure } : {})}
        {...(orgName !== undefined ? { orgName } : {})}
        onAcknowledge={onAcknowledgeConsent}
        onDecline={onCancelConsent}
      />
      {showQrCard ? <ConsentQrCard ackToken={ackToken} /> : null}
    </section>
  );
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
