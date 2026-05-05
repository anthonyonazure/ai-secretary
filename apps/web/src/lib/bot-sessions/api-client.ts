/**
 * Bot-sessions API client — GETs the meeting-detail bot-status badge
 * consumes + the POST the InviteBotButton drives.
 *
 * Wraps:
 *   - GET  /api/v1/bot-sessions
 *   - POST /api/v1/bot-sessions
 *
 * Validates with the shared zod contract so a schema-drift between
 * apps/api and the web client surfaces as a developer-friendly error.
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
  /** When true (default), API restricts to caller's own sessions. */
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
  const search = new URLSearchParams();
  if (params.meetingId) search.set('meetingId', params.meetingId);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.mineOnly === false) search.set('mineOnly', 'false');
  const qs = search.toString();
  const url = `${baseUrl}/api/v1/bot-sessions${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: buildHeaders(accessToken) });
  if (!res.ok) {
    throw new BotSessionsRequestError(res.status, `Failed to load bot sessions (${res.status})`);
  }
  const json = (await res.json()) as unknown;
  return botSessionListResponseSchema.parse(json);
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
  const json = (await res.json()) as unknown;
  return botSessionResponseSchema.parse(json);
};
