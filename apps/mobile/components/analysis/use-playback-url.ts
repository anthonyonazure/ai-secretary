/**
 * Mobile `usePlaybackUrl` — RN counterpart of the web hook.
 *
 * Resolves the meeting → recording → presigned-GET URL chain via
 * `GET /api/v1/meetings/:meetingId/playback-url`. The presigned URL
 * has a 15-min TTL by default; React Query's `staleTime` is set just
 * under that so playback stays robust on long sessions.
 */

import {
  type RecordingPlaybackResponse,
  recordingPlaybackResponseSchema,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildAuthDeps } from '../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';
import { type AuthFetch, readProblemDetails } from '../../lib/auth/auth-fetch';

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

const STALE_TIME_MS = 12 * 60 * 1000;

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
