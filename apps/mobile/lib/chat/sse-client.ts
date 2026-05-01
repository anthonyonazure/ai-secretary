/**
 * Mobile SSE chat client — Story 7.4.
 *
 * Mirrors the web client (`apps/web/src/lib/chat/sse-client.ts`). RN's
 * `fetch` returns a ReadableStream on a recent enough engine; we use
 * the same parsing logic.
 */

import { type ChatEvent, type ChatRequest, chatEventSchema } from '@aisecretary/shared';

export interface StreamChatInput {
  baseUrl: string;
  accessToken: string | null;
  body: ChatRequest;
  signal?: AbortSignal;
  onEvent: (event: ChatEvent) => void;
}

export const parseSseFrames = (
  buffer: string,
): { events: ReadonlyArray<ChatEvent>; remainder: string } => {
  const events: ChatEvent[] = [];
  let remainder = buffer;
  while (true) {
    const boundary = remainder.indexOf('\n\n');
    if (boundary === -1) break;
    const frame = remainder.slice(0, boundary);
    remainder = remainder.slice(boundary + 2);
    const lines = frame.split('\n');
    let dataLine: string | null = null;
    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataLine = line.slice(5).trim();
      }
    }
    if (dataLine === null || dataLine.length === 0) continue;
    try {
      const parsed = chatEventSchema.parse(JSON.parse(dataLine));
      events.push(parsed);
    } catch {
      // Skip malformed frame.
    }
  }
  return { events, remainder };
};

export async function streamChat(input: StreamChatInput): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (input.accessToken) headers.Authorization = `Bearer ${input.accessToken}`;
  const res = await fetch(`${input.baseUrl}/api/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input.body),
    signal: input.signal ?? null,
  });
  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`);
  }
  if (!res.body) {
    throw new Error('Chat response had no body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseFrames(buffer);
    buffer = remainder;
    for (const event of events) {
      input.onEvent(event);
      if (event.kind === 'done' || event.kind === 'error') {
        return;
      }
    }
  }
}
