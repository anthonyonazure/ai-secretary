/**
 * My Actions API client — Story 8.5.
 *
 * Wraps `GET /api/v1/action-items` + `PATCH /api/v1/action-items/:id` and
 * validates the responses with zod so a schema-drift between API + web
 * surfaces as a developer-friendly error during dev.
 */

import {
  type ActionItemRow,
  type ActionItemStatus,
  type ListActionItemsResponse,
  actionItemRowSchema,
  listActionItemsResponseSchema,
} from '@aisecretary/shared';
import { resolveApiBaseUrl } from '../auth/api-client';

export interface ListActionItemsParams {
  status?: readonly ActionItemStatus[];
  meetingId?: string;
  dueBefore?: string;
  cursor?: string;
  limit?: number;
}

export class ActionItemsRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ActionItemsRequestError';
  }
}

const buildHeaders = (accessToken: string | null): Record<string, string> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
};

export const fetchActionItems = async (
  accessToken: string | null,
  params: ListActionItemsParams = {},
): Promise<ListActionItemsResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const search = new URLSearchParams();
  if (params.status && params.status.length > 0) search.set('status', params.status.join(','));
  if (params.meetingId) search.set('meetingId', params.meetingId);
  if (params.dueBefore) search.set('dueBefore', params.dueBefore);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const url = `${baseUrl}/api/v1/action-items${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: buildHeaders(accessToken) });
  if (!res.ok) {
    throw new ActionItemsRequestError(res.status, `Failed to load action items (${res.status})`);
  }
  const json = (await res.json()) as unknown;
  return listActionItemsResponseSchema.parse(json);
};

export const updateActionItemStatus = async (
  accessToken: string | null,
  id: string,
  status: ActionItemStatus,
): Promise<ActionItemRow> => {
  const baseUrl = resolveApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/action-items/${id}`, {
    method: 'PATCH',
    headers: { ...buildHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new ActionItemsRequestError(
      res.status,
      `Failed to update action item ${id} (${res.status})`,
    );
  }
  const json = (await res.json()) as unknown;
  return actionItemRowSchema.parse(json);
};
