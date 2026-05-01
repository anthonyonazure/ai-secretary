/**
 * `usePlaybackUrl` — resolves the meeting → recording → presigned-GET URL
 * chain for `TranscriptSeekPlayer`.
 *
 * The citation surface only carries `meetingId`; the API hides the
 * `recordingId` lookup behind `GET /api/v1/meetings/:meetingId/playback-url`.
 * This hook just consumes that endpoint — see Story 2.1 follow-up notes.
 *
 * The presigned URL has a short TTL (default 15 minutes). React Query's
 * `staleTime` is set just under that so the URL is refreshed before it
 * goes stale, keeping playback robust on long sessions.
 */

import {
  type RecordingPlaybackResponse,
  recordingPlaybackResponseSchema,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildAuthDeps } from '../../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';
import { type AuthFetch, readProblemDetails } from '../../../lib/auth/auth-fetch';

export interface UsePlaybackUrlResult {
  url: string | null;
  expiresAt: string | null;
  contentType: string | null;
  isLoading: boolean;
  isError: boolean;
}

export interface UsePlaybackUrlOptions {
  authFetch?: AuthFetch;
  apiBase?: string;
}

const STALE_TIME_MS = 12 * 60 * 1000; // 12 min — under the 15-min URL TTL.

export function usePlaybackUrl(
  meetingId: string | undefined,
  options: UsePlaybackUrlOptions = {},
): UsePlaybackUrlResult {
  const apiBase = options.apiBase ?? resolveApiBaseUrl();
  const authFetch = useMemo(
    () => options.authFetch ?? buildAuthDeps({ baseUrl: apiBase }).authFetch,
    [options.authFetch, apiBase],
  );

  const query = useQuery<RecordingPlaybackResponse>({
    queryKey: ['playback-url', meetingId],
    enabled: Boolean(meetingId),
    staleTime: STALE_TIME_MS,
    queryFn: async ({ signal }) => {
      const url = `${apiBase}/api/v1/meetings/${meetingId}/playback-url`;
      const response = await authFetch(url, { signal });
      if (!response.ok) {
        throw await readProblemDetails(response);
      }
      const json = (await response.json()) as unknown;
      return recordingPlaybackResponseSchema.parse(json);
    },
  });

  return {
    url: query.data?.url ?? null,
    expiresAt: query.data?.expiresAt ?? null,
    contentType: query.data?.contentType ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
