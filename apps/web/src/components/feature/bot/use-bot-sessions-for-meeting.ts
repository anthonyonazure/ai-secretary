/**
 * `useBotSessionsForMeeting(meetingId)` — drives the meeting-detail
 * bot-status badge + invite-bot CTA.
 *
 * Polls every 8 seconds while the most recent session is in a non-
 * terminal state (provisioning|joined). Stops polling once the session
 * lands in `ended` or `failed`. Tunable via `pollIntervalMs` (tests).
 */

import {
  type BotSessionListResponse,
  type BotSessionResponse,
  isBotSessionActive,
  pickPrimaryBotSession,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../hooks/use-auth';
import { fetchBotSessions } from '../../../lib/bot-sessions/api-client';

export interface UseBotSessionsForMeetingOptions {
  /** Override the default 8s polling interval (tests). */
  pollIntervalMs?: number;
}

export interface UseBotSessionsForMeetingResult {
  isLoading: boolean;
  isError: boolean;
  sessions: BotSessionResponse[];
  primarySession: BotSessionResponse | null;
  hasActiveSession: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 8_000;

export const useBotSessionsForMeeting = (
  meetingId: string | undefined,
  options: UseBotSessionsForMeetingOptions = {},
): UseBotSessionsForMeetingResult => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const query = useQuery<BotSessionListResponse>({
    queryKey: ['bot-sessions-for-meeting', meetingId ?? null],
    queryFn: () =>
      fetchBotSessions(accessToken, { ...(meetingId ? { meetingId } : {}), limit: 20 }),
    enabled: !!meetingId && !!accessToken,
    refetchInterval: (q) => {
      const latest = q.state.data;
      if (!latest) return pollIntervalMs;
      const primary = pickPrimaryBotSession(latest.items);
      if (primary && isBotSessionActive(primary.status)) return pollIntervalMs;
      return false;
    },
    staleTime: 5_000,
  });

  const sessions = query.data?.items ?? [];
  const primarySession = pickPrimaryBotSession(sessions);
  const hasActiveSession = !!primarySession && isBotSessionActive(primarySession.status);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    sessions,
    primarySession,
    hasActiveSession,
  };
};
