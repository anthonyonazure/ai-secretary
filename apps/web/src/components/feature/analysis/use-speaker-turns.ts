/**
 * `useSpeakerTurns` — fetches the diarized turn list for a meeting.
 *
 * Wired to `GET /api/v1/meetings/:meetingId/speaker-turns` (Story 2.1
 * follow-up). The fixture file at `./speaker-turns.fixture.ts` is kept
 * for Storybook stories and unit tests that need a deterministic input —
 * the production hook reads from the API.
 */

import {
  type SpeakerTurn,
  type SpeakerTurnsResponse,
  speakerTurnsResponseSchema,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildAuthDeps } from '../../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';
import { type AuthFetch, readProblemDetails } from '../../../lib/auth/auth-fetch';

export interface UseSpeakerTurnsResult {
  turns: SpeakerTurn[];
  isLoading: boolean;
  isError: boolean;
}

export interface UseSpeakerTurnsOptions {
  /** Inject a custom auth-fetch (tests). Defaults to the app-wide instance. */
  authFetch?: AuthFetch;
  /** Override the API base URL (tests). */
  apiBase?: string;
}

export function useSpeakerTurns(
  meetingId: string | undefined,
  options: UseSpeakerTurnsOptions = {},
): UseSpeakerTurnsResult {
  const apiBase = options.apiBase ?? resolveApiBaseUrl();
  // Build the auth-fetch wrapper once per hook instance so repeated
  // renders don't re-create the fetch closure on every cycle.
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
