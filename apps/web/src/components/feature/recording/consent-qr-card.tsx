/**
 * Story 4.3 — In-person QR/URL consent surface (consent shape C).
 *
 * Renders a QR code from a one-time URL plus a live attendee
 * acknowledgment list. The recording user shows the screen to the
 * in-person counterpart, who scans the QR + acknowledges on their own
 * device.
 *
 * Story 1.4 follow-up wires the real polling endpoint
 * (`GET /api/v1/meetings/:id/consents`); for now the polling helper is
 * pluggable and defaults to a stubbed empty-list resolver.
 */

import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

export interface ConsentAcknowledgment {
  id: string;
  recipientLabel: string;
  acknowledgedAt: string; // ISO 8601 UTC
}

export interface ConsentQrCardProps {
  /**
   * Opaque acknowledgment token. The hosting app mints this server-side
   * (Story 1.4 follow-up). Until then, callers can pass a generated
   * UUID — the URL is rendered + encoded but acknowledgments will only
   * land once the API endpoint exists.
   */
  ackToken: string;
  /** Origin used to build the consent URL. Defaults to `location.origin`. */
  origin?: string;
  /** Optional override of the default 3-second poll cadence. */
  pollIntervalMs?: number;
  /**
   * Pluggable acknowledgment loader. Default returns []; real impl
   * (Story 1.4 follow-up) hits `GET /api/v1/meetings/:id/consents`.
   */
  loadAcknowledgments?: () => Promise<ConsentAcknowledgment[]>;
}

const DEFAULT_POLL_MS = 3_000;

const stubLoad: () => Promise<ConsentAcknowledgment[]> = async () => [];

export function ConsentQrCard({
  ackToken,
  origin,
  pollIntervalMs = DEFAULT_POLL_MS,
  loadAcknowledgments = stubLoad,
}: ConsentQrCardProps) {
  const url = useMemo(() => {
    const root =
      origin ??
      (typeof window !== 'undefined' ? window.location.origin : 'https://aisecretary.app');
    return `${root.replace(/\/$/, '')}/consent/${ackToken}`;
  }, [origin, ackToken]);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [acks, setAcks] = useState<ConsentAcknowledgment[]>([]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await loadAcknowledgments();
        if (!cancelled) setAcks(next);
      } catch {
        // TODO(Story 1.4 follow-up): surface poll-error state once the
        // endpoint is real; for the stub path we silently retry.
      }
    };
    void tick();
    const handle = setInterval(tick, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [loadAcknowledgments, pollIntervalMs]);

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6"
      aria-label="In-person consent QR"
    >
      <div className="flex flex-col items-center gap-3">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Scan this QR code to acknowledge the recording"
            width={224}
            height={224}
            className="rounded-md border border-border bg-bg p-2"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-56 w-56 animate-pulse rounded-md border border-border bg-bg"
          />
        )}
        <p className="text-sm text-fg-muted">
          Or open: <span className="font-mono text-fg">{url}</span>
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-fg">Acknowledgments</h3>
        {acks.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">Waiting for the first acknowledgment…</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-fg">
            {acks.map((ack) => (
              <li key={ack.id} className="flex items-center justify-between gap-2">
                <span>{ack.recipientLabel}</span>
                <time dateTime={ack.acknowledgedAt} className="font-mono text-xs text-fg-muted">
                  {formatTime(ack.acknowledgedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  // Minimal HH:MM formatter — avoids pulling date-fns into this module.
  // Once i18n / locale-aware formatters land (Story 1.7) we'll route
  // through `Intl.DateTimeFormat` with the user's locale.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
