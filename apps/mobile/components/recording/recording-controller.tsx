/**
 * Story 4.2 mobile demo unit — wires button + pill + state machine +
 * expo-audio recorder + resumable upload into a single screen-level
 * surface. Story 1.6 will hoist the pill into the global header (shared
 * across screens via Expo Router); the wiring contract stays the same.
 *
 * Story 4.3 — replaced the `ConsentModalStub` with the real
 * `ConsentModal` (shape A). When orchestrator returns shape C, the
 * controller routes to the `/consent-qr` Expo Router screen.
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
import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { buildAuthDeps } from '../../hooks/use-auth';
import { useRecording } from '../../hooks/use-recording';
import { useRecordingHeartbeat } from '../../hooks/use-recording-heartbeat';
import { useRecordingStateMachine } from '../../hooks/use-recording-state-machine';
import { useResumableUpload } from '../../hooks/use-resumable-upload';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';
import { createPresignedPoster } from '../../lib/recording/presigned-poster';
import { ConsentModal } from './consent-modal';
import { RecordingButton } from './recording-button';
import { type RecordingState as PillState, RecordingStatusPill } from './recording-status-pill';
import { UploadRetryBanner } from './upload-retry-banner';
import { useConsentStore } from './use-consent-store';

export interface RecordingControllerProps {
  meetingSource?: MeetingSource;
  tenantPolicy?: ConsentPolicy;
  participants?: ReadonlyArray<ConsentParticipantInput>;
  customDisclosure?: string;
  orgName?: string;
  tenantId?: string;
  meetingId?: string;
}

const DEFAULT_POLICY: ConsentPolicy = { default: 'us' };

export function RecordingController({
  meetingSource = 'mobile-mic',
  tenantPolicy = DEFAULT_POLICY,
  participants = [],
  customDisclosure,
  orgName,
  tenantId,
  meetingId,
}: RecordingControllerProps) {
  const machine = useRecordingStateMachine();
  const recording = useRecording();
  const authDeps = useMemo(() => buildAuthDeps(), []);
  const presignedPoster = useMemo(
    () =>
      createPresignedPoster({
        apiBase: resolveApiBaseUrl(),
        // Mobile auth-fetch typing matches the poster's signature shape.
        authFetch: authDeps.authFetch as unknown as Parameters<
          typeof createPresignedPoster
        >[0]['authFetch'],
      }),
    [authDeps.authFetch],
  );
  const [exhaustedRecordingId, setExhaustedRecordingId] = useState<string | null>(null);
  const [exhaustedLastError, setExhaustedLastError] = useState<string | null>(null);
  const upload = useResumableUpload({
    poster: presignedPoster.poster,
    onProgress: (fraction) => machine.reportProgress(fraction),
    onBudgetExhausted: ({ recordingId, lastError }) => {
      setExhaustedRecordingId(recordingId);
      setExhaustedLastError(lastError.message);
      machine.fail('upload-retry-exhausted', true);
      const apiBase = resolveApiBaseUrl();
      const url = `${apiBase}/api/v1/recordings/${recordingId}/abort`;
      void (
        authDeps.authFetch as unknown as (url: string, init?: RequestInit) => Promise<Response>
      )(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'upload-retry-exhausted' }),
      });
    },
  });

  // Story 4.4 — heartbeat while uploading (and beyond). The mobile
  // hook respects AppState; when iOS suspends the timer the next
  // foreground tick resumes pings within ≤30s, well inside the 90s
  // server TTL.
  const heartbeatRecordingId =
    machine.state.kind === 'uploading' ? machine.state.recordingId : null;
  useRecordingHeartbeat(heartbeatRecordingId, {
    authFetch: authDeps.authFetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<Response>,
    apiBase: resolveApiBaseUrl(),
  });
  const consentStore = useConsentStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  const [ackToken] = useState(() => generateLocalId());

  useEffect(() => {
    if (machine.state.kind !== 'recording') return;
    const startedAt = machine.state.startedAt;
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [machine.state]);

  useEffect(() => {
    if (machine.state.kind === 'idle') setElapsedSeconds(0);
  }, [machine.state.kind]);

  const onStart = useCallback(() => {
    machine.requestConsent();
  }, [machine]);

  const onAcknowledgeConsent = useCallback(async () => {
    try {
      await recording.start();
      machine.grantConsent();

      const record: ConsentRecord = {
        tenantId: tenantId ?? '00000000-0000-0000-0000-000000000000',
        meetingId: meetingId ?? '00000000-0000-0000-0000-000000000000',
        shape: 'A',
        legalBasis,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedVia: 'modal',
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
      // Story 2.1 — initiate → upload-in-chunks → complete.
      const session = await presignedPoster.initiate({
        contentType: result.mimeType,
        ...(meetingId !== undefined ? { meetingId } : {}),
      });
      machine.startUpload(session.recordingId);
      const uploadResult = await upload.upload({
        recordingId: session.recordingId,
        uploadId: session.uploadId,
        fileUri: result.uri,
        mimeType: result.mimeType,
      });
      const parts = uploadResult.parts.map((p) => ({
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

  const showQrLink = shapeCSurface !== undefined && machine.state.kind === 'recording';

  return (
    <View className="flex-1 gap-4 p-6 bg-bg">
      <RecordingStatusPill state={pillState} elapsedSeconds={elapsedSeconds} />
      <RecordingButton state={machine.state} onStart={onStart} onStop={onStop} onRetry={onRetry} />
      {machine.state.kind === 'error' &&
      machine.state.reason === 'upload-retry-exhausted' &&
      exhaustedRecordingId ? (
        <UploadRetryBanner
          recordingId={exhaustedRecordingId}
          {...(exhaustedLastError ? { lastErrorMessage: exhaustedLastError } : {})}
          onRetry={() => {
            setExhaustedRecordingId(null);
            setExhaustedLastError(null);
            machine.reset();
          }}
          onUploadManually={() => {
            setExhaustedRecordingId(null);
            setExhaustedLastError(null);
            machine.reset();
          }}
        />
      ) : machine.state.kind === 'error' ? (
        <View className="rounded-md border border-border bg-surface p-3">
          <Text accessibilityRole="alert" className="text-sm text-fg">
            {machine.state.reason}
          </Text>
        </View>
      ) : null}
      {showQrLink ? (
        <Link
          href={{ pathname: '/consent-qr', params: { ackToken } }}
          accessibilityRole="link"
          className="rounded-md border border-border bg-surface p-3"
        >
          <Text className="text-sm font-medium text-fg">Show in-person consent QR →</Text>
        </Link>
      ) : null}
      <ConsentModal
        open={machine.state.kind === 'requesting-consent'}
        legalBasis={legalBasis}
        {...(customDisclosure !== undefined ? { customDisclosure } : {})}
        {...(orgName !== undefined ? { orgName } : {})}
        onAcknowledge={onAcknowledgeConsent}
        onDecline={onCancelConsent}
      />
    </View>
  );
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
