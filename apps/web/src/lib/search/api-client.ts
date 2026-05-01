/**
 * Search API client — wraps `GET /api/v1/search` from Story 7.2.
 */

import { type SearchResponse, searchResponseSchema } from '@aisecretary/shared';
import { resolveApiBaseUrl } from '../auth/api-client';

export interface SearchCorpusParams {
  q: string;
  meetingId?: string;
  limit?: number;
}

export class SearchRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SearchRequestError';
  }
}

export const searchCorpus = async (
  accessToken: string | null,
  params: SearchCorpusParams,
): Promise<SearchResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const search = new URLSearchParams();
  search.set('q', params.q);
  if (params.meetingId) search.set('meetingId', params.meetingId);
  if (params.limit) search.set('limit', String(params.limit));
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${baseUrl}/api/v1/search?${search.toString()}`, { headers });
  if (!res.ok) {
    throw new SearchRequestError(res.status, `Search failed (${res.status})`);
  }
  const json = (await res.json()) as unknown;
  return searchResponseSchema.parse(json);
};
