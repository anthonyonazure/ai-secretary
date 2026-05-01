import { describe, expect, it } from 'vitest';

import { parseSseFrames } from './sse-client.js';

const frame = (data: object) =>
  `event: ${(data as { kind?: string }).kind ?? 'delta'}\ndata: ${JSON.stringify(data)}\n\n`;

describe('parseSseFrames (mobile)', () => {
  it('parses a single delta', () => {
    const r = parseSseFrames(frame({ kind: 'delta', text: 'hi' }));
    expect(r.events).toEqual([{ kind: 'delta', text: 'hi' }]);
  });

  it('keeps a partial frame as remainder', () => {
    const r = parseSseFrames(`event: delta\ndata: {"kind":"delta","text":"a"}\n\nevent: del`);
    expect(r.events).toHaveLength(1);
    expect(r.remainder.startsWith('event: del')).toBe(true);
  });

  it('parses retrieval + delta + done in order', () => {
    const buf =
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
      }) +
      frame({ kind: 'delta', text: 'hello' }) +
      frame({ kind: 'done', emptyState: 'confident', faithfulness: 0.95 });
    const r = parseSseFrames(buf);
    expect(r.events.map((e) => e.kind)).toEqual(['retrieval', 'delta', 'done']);
  });

  it('skips malformed frames', () => {
    const r = parseSseFrames('event: delta\ndata: bad\n\n');
    expect(r.events).toHaveLength(0);
  });
});
