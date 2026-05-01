/**
 * Mobile `useSpeakerTurns` — RN counterpart of the web hook.
 *
 * Wired to `GET /api/v1/meetings/:meetingId/speaker-turns` (Story 2.1
 * follow-up). Fixture file kept for Storybook + pure-logic tests.
 */

import {
  type SpeakerTurn,
  type SpeakerTurnsResponse,
  speakerTurnsResponseSchema,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildAuthDeps } from '../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';
import { type AuthFetch, readProblemDetails } from '../../lib/auth/auth-fetch';

export interface UseSpeakerTurnsResult {
  turns: SpeakerTurn[];
  isLoading: boolean;
  isError: boolean;
}

export interface UseSpeakerTurnsOptions {
  authFetch?: AuthFetch;
  apiBase?: string;
}

export function useSpeakerTurns(
  meetingId: string | undefined,
  options: UseSpeakerTurnsOptions = {},
): UseSpeakerTurnsResult {
  const apiBase = options.apiBase ?? resolveApiBaseUrl();
  const authFetch = useMemo(
    () => options.authFetch ?? buildAuthDeps({ baseUrl: apiBase }).authFetch,
    [options.authFetch, apiBase],
  );

  const query = useQuery<SpeakerTurnsResponse>({
    queryKey: ['speaker-turns', meetingId],
    enabled: Boolean(meetingId),
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const url = `${apiBase}/api/v1/meetings/${meetingId}/speaker-turns`;
      const response = await authFetch(url, { signal });
      if (!response.ok) {
        throw await readProblemDetails(response);
      }
      const json = (await response.json()) as unknown;
      return speakerTurnsResponseSchema.parse(json);
    },
  });

  return {
    turns: query.data?.turns ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
