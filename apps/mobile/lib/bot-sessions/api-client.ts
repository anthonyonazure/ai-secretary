/**
 * Mobile counterpart of `apps/web/src/lib/bot-sessions/api-client.ts`.
 *
 * Wraps GET + POST `/api/v1/bot-sessions` and validates with the shared
 * zod contract.
 */

import {
  type BotSessionListResponse,
  type BotSessionResponse,
  type BotSourceWire,
  type CreateBotSessionRequest,
  botSessionListResponseSchema,
  botSessionResponseSchema,
} from '@aisecretary/shared';
import { resolveApiBaseUrl } from '../auth/api-client';

export interface ListBotSessionsParams {
  meetingId?: string;
  cursor?: string;
  limit?: number;
  mineOnly?: boolean;
}

export interface CreateBotSessionParams {
  source: BotSourceWire;
  externalMeetingId: string;
  externalMeetingPasscode?: string;
  meetingId?: string;
}

export class BotSessionsRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BotSessionsRequestError';
  }
}

const buildHeaders = (accessToken: string | null): Record<string, string> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
};

export const fetchBotSessions = async (
  accessToken: string | null,
  params: ListBotSessionsParams = {},
): Promise<BotSessionListResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const url = new URL(`${baseUrl}/api/v1/bot-sessions`);
  if (params.meetingId) url.searchParams.set('meetingId', params.meetingId);
  if (params.cursor) url.searchParams.set('cursor', params.cursor);
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.mineOnly === false) url.searchParams.set('mineOnly', 'false');
  const res = await fetch(url.toString(), { headers: buildHeaders(accessToken) });
  if (!res.ok) {
    throw new BotSessionsRequestError(res.status, `Failed to load bot sessions (${res.status})`);
  }
  return botSessionListResponseSchema.parse(await res.json());
};

export const createBotSession = async (
  accessToken: string | null,
  params: CreateBotSessionParams,
): Promise<BotSessionResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const body: CreateBotSessionRequest = {
    source: params.source,
    externalMeetingId: params.externalMeetingId,
    ...(params.externalMeetingPasscode !== undefined
      ? { externalMeetingPasscode: params.externalMeetingPasscode }
      : {}),
    ...(params.meetingId ? { meetingId: params.meetingId } : {}),
  };
  const res = await fetch(`${baseUrl}/api/v1/bot-sessions`, {
    method: 'POST',
    headers: { ...buildHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new BotSessionsRequestError(res.status, `Failed to invite bot (${res.status})`);
  }
  return botSessionResponseSchema.parse(await res.json());
};
