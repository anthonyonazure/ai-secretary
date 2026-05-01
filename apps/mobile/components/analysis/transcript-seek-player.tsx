import type { CitationRef, SpeakerTurn } from '@aisecretary/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { FIXTURE_MEETING_TITLE } from './speaker-turns.fixture';
import { usePlaybackUrl } from './use-playback-url';
import { useSpeakerTurns } from './use-speaker-turns';

/**
 * Mobile `TranscriptSeekPlayer` — RN counterpart of the web modal. Opens
 * via `CitationChip` press; uses `expo-audio` `useAudioPlayer` for
 * playback. Seeks to `spanStartMs - 5000` (clamped at 0), auto-plays,
 * and scrolls the cited turn into view.
 *
 * Story 2.1 follow-up landed: `usePlaybackUrl` resolves the meeting →
 * recording → presigned-GET URL chain via the API. While the URL is
 * loading or no completed recording exists, the modal renders the
 * transcript without audio (expo-audio accepts `null` and returns a
 * no-op-ready player).
 */

export interface TranscriptSeekPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citation: CitationRef;
  meetingTitle?: string;
}

const PRE_ROLL_MS = 5_000;

export function TranscriptSeekPlayer({
  open,
  onOpenChange,
  citation,
  meetingTitle,
}: TranscriptSeekPlayerProps) {
  const { turns, isLoading } = useSpeakerTurns(citation.meetingId);
  const { url: playbackUrl } = usePlaybackUrl(citation.meetingId);
  const [activeTurnId, setActiveTurnId] = useState(citation.turnId);
  const scrollRef = useRef<ScrollView | null>(null);
  const turnOffsets = useRef<Map<string, number>>(new Map());

  // `useAudioPlayer` accepts `null` and returns a no-op-ready player —
  // matches the loading / no-recording states of `usePlaybackUrl`.
  const player = useAudioPlayer(playbackUrl ?? null);
  const status = useAudioPlayerStatus(player);

  const seekToTurn = useCallback(
    (turn: SpeakerTurn) => {
      setActiveTurnId(turn.turnId);
      const targetSec = Math.max(0, (turn.spanStartMs - PRE_ROLL_MS) / 1000);
      void player.seekTo(targetSec).catch(() => undefined);
      try {
        player.play();
      } catch {
        // ignore — stub source has no media to play
      }
      const offset = turnOffsets.current.get(turn.turnId);
      if (offset !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, offset - 80), animated: true });
      }
    },
    [player],
  );

  useEffect(() => {
    if (open) setActiveTurnId(citation.turnId);
  }, [citation.turnId, open]);

  // Initial seek when the dialog opens. Open-transition only — see
  // the web counterpart for the rationale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: open-transition only
  useEffect(() => {
    if (!open || isLoading) return;
    const initial = turns.find((t) => t.turnId === citation.turnId);
    if (initial) seekToTurn(initial);
  }, [open, isLoading]);

  const togglePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, status.playing]);

  const headerTitle = meetingTitle ?? FIXTURE_MEETING_TITLE;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onOpenChange(false)}
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel={`Transcript player — ${headerTitle}`}
        className="flex-1 bg-surface"
      >
        <View className="flex-row items-start justify-between gap-3 border-b border-border p-4">
          <View className="flex-1">
            <Text className="text-base font-semibold text-fg">{headerTitle}</Text>
            <Text className="mt-1 text-xs text-fg-muted">
              {citation.speaker ? `${citation.speaker} · ` : ''}
              {formatTimestamp(citation.spanStartMs)} — playing 5s of context before the cited span.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close transcript player"
            onPress={() => onOpenChange(false)}
            testID="transcript-seek-player-close"
            className="h-9 w-9 items-center justify-center rounded-md border border-border"
          >
            <Text className="text-fg-muted">✕</Text>
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} className="flex-1 p-4" testID="transcript-turn-list">
          {isLoading ? (
            <Text className="text-sm text-fg-muted">Loading transcript…</Text>
          ) : turns.length === 0 ? (
            <Text className="text-sm text-fg-muted">
              No transcript available for this meeting yet.
            </Text>
          ) : (
            <View className="gap-3">
              {turns.map((turn) => {
                const isActive = turn.turnId === activeTurnId;
                return (
                  <Pressable
                    key={turn.turnId}
                    accessibilityRole="button"
                    accessibilityLabel={`Seek to turn at ${formatTimestamp(turn.spanStartMs)}`}
                    onPress={() => seekToTurn(turn)}
                    onLayout={(event) => {
                      turnOffsets.current.set(turn.turnId, event.nativeEvent.layout.y);
                    }}
                    testID={`turn-${turn.turnId}`}
                    className={`rounded-md border p-3 ${
                      isActive ? 'border-accent bg-accent-soft' : 'border-border bg-bg'
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-semibold text-fg">
                        {turn.speaker ?? 'Unknown speaker'}
                      </Text>
                      <Text className="font-mono text-xs text-fg-muted">
                        {formatTimestamp(turn.spanStartMs)}
                      </Text>
                    </View>
                    <Text className="mt-1 text-sm text-fg leading-normal">{turn.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View className="flex-row items-center gap-3 border-t border-border p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pause' : 'Play'}
            onPress={togglePlayPause}
            testID="transcript-seek-player-toggle"
            className="h-11 w-11 items-center justify-center rounded-md bg-accent"
          >
            <Text className="text-bg">{status.playing ? '❚❚' : '▶'}</Text>
          </Pressable>
          <Text
            className="flex-1 font-mono text-xs text-fg-muted"
            testID="transcript-seek-player-time"
          >
            {formatTimestamp(Math.floor((status.currentTime ?? 0) * 1000))}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
