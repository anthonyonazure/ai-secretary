import {
  type BotSessionListResponse,
  type BotSessionResponse,
  isBotSessionActive,
  pickPrimaryBotSession,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../hooks/use-auth';
import { fetchBotSessions } from '../../lib/bot-sessions/api-client';

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
): UseBotSessionsForMeetingResult => {
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery<BotSessionListResponse>({
    queryKey: ['bot-sessions-for-meeting', meetingId ?? null],
    queryFn: () =>
      fetchBotSessions(accessToken, { ...(meetingId ? { meetingId } : {}), limit: 20 }),
    enabled: !!meetingId && !!accessToken,
    refetchInterval: (q) => {
      const latest = q.state.data;
      if (!latest) return DEFAULT_POLL_INTERVAL_MS;
      const primary = pickPrimaryBotSession(latest.items);
      if (primary && isBotSessionActive(primary.status)) return DEFAULT_POLL_INTERVAL_MS;
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
