import { describe, expect, it } from 'vitest';

import { parseSseFrames } from './sse-client.js';

const frame = (data: object) =>
  `event: ${(data as { kind?: string }).kind ?? 'delta'}\ndata: ${JSON.stringify(data)}\n\n`;

describe('parseSseFrames', () => {
  it('returns no events for an empty buffer', () => {
    expect(parseSseFrames('')).toEqual({ events: [], remainder: '' });
  });

  it('parses a single delta frame', () => {
    const r = parseSseFrames(frame({ kind: 'delta', text: 'hello' }));
    expect(r.events).toEqual([{ kind: 'delta', text: 'hello' }]);
    expect(r.remainder).toBe('');
  });

  it('parses multiple frames in one buffer', () => {
    const r = parseSseFrames(
      frame({ kind: 'delta', text: 'a' }) + frame({ kind: 'delta', text: 'b' }),
    );
    expect(r.events).toHaveLength(2);
    expect(r.events[0]?.kind).toBe('delta');
  });

  it('keeps a partial frame as remainder', () => {
    const r = parseSseFrames(`event: delta\ndata: {"kind":"delta","text":"a"}\n\nevent: del`);
    expect(r.events).toHaveLength(1);
    expect(r.remainder.startsWith('event: del')).toBe(true);
  });

  it('parses a retrieval event with citations', () => {
    const r = parseSseFrames(
      frame({
        kind: 'retrieval',
        citations: [
          {
            meetingId: '00000000-0000-0000-0000-000000000abc',
            turnId: 't-1',
            spanStartMs: 0,
            spanEndMs: 1000,
          },
        ],
      }),
    );
    expect(r.events[0]?.kind).toBe('retrieval');
  });

  it('parses a done event with empty-state', () => {
    const r = parseSseFrames(frame({ kind: 'done', emptyState: 'confident', faithfulness: 0.95 }));
    expect(r.events[0]?.kind).toBe('done');
  });

  it('parses an error event', () => {
    const r = parseSseFrames(frame({ kind: 'error', code: 'rate-limited', message: 'Slow down.' }));
    expect(r.events[0]?.kind).toBe('error');
  });

  it('skips malformed frames without throwing', () => {
    const r = parseSseFrames('event: delta\ndata: not-json\n\n');
    expect(r.events).toHaveLength(0);
  });

  it('skips a frame that has no data line', () => {
    const r = parseSseFrames('event: delta\n\n');
    expect(r.events).toHaveLength(0);
  });
});
