/**
 * Story 4.3 — In-person QR/URL consent surface (consent shape C) for
 * mobile.
 *
 * Renders a QR + live attendee acknowledgment list. The recording user
 * shows the device to the in-person counterpart; they scan + ack on
 * their own phone.
 *
 * Story 1.4 follow-up wires the real polling endpoint
 * (`GET /api/v1/meetings/:id/consents`); the polling helper here is
 * pluggable and defaults to a stubbed empty-list resolver.
 */

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export interface ConsentAcknowledgment {
  id: string;
  recipientLabel: string;
  acknowledgedAt: string;
}

export interface ConsentQrScreenProps {
  ackToken: string;
  origin?: string;
  pollIntervalMs?: number;
  loadAcknowledgments?: () => Promise<ConsentAcknowledgment[]>;
}

const DEFAULT_POLL_MS = 3_000;
const stubLoad: () => Promise<ConsentAcknowledgment[]> = async () => [];

export function ConsentQrScreen({
  ackToken,
  origin = 'https://aisecretary.app',
  pollIntervalMs = DEFAULT_POLL_MS,
  loadAcknowledgments = stubLoad,
}: ConsentQrScreenProps) {
  const url = useMemo(() => `${origin.replace(/\/$/, '')}/consent/${ackToken}`, [origin, ackToken]);

  const [acks, setAcks] = useState<ConsentAcknowledgment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await loadAcknowledgments();
        if (!cancelled) setAcks(next);
      } catch {
        // TODO(Story 1.4 follow-up): surface poll-error state once endpoint is real.
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
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-bg">
      <View
        accessibilityRole="summary"
        accessibilityLabel="In-person consent QR"
        className="flex-1 gap-4 p-6"
      >
        <View className="items-center gap-3 rounded-md border border-border bg-surface p-6">
          <QRCode value={url} size={224} />
          <Text className="text-sm text-fg-muted">Or open:</Text>
          <Text className="font-mono text-sm text-fg">{url}</Text>
        </View>

        <View className="rounded-md border border-border bg-surface p-4">
          <Text className="text-sm font-semibold text-fg">Acknowledgments</Text>
          {acks.length === 0 ? (
            <Text className="mt-2 text-sm text-fg-muted">
              Waiting for the first acknowledgment…
            </Text>
          ) : (
            <View className="mt-2 gap-1">
              {acks.map((ack) => (
                <View key={ack.id} className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm text-fg">{ack.recipientLabel}</Text>
                  <Text className="font-mono text-xs text-fg-muted">
                    {formatTime(ack.acknowledgedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
