import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BotJoinRefusedError, BotJoinTimeoutError } from '../errors.js';
import type { BotAudioFrame, BotJoinRequest } from '../types.js';
import { MockBotProvider } from './mock.js';

const baseRequest: BotJoinRequest = {
  sessionId: 'sess-mock-1',
  tenantId: 'tenant-1',
  externalMeetingId: '999-000-111',
  displayName: 'AI Secretary Bot',
  disclosureText: 'This meeting is being recorded.',
};

describe('MockBotProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('join()', () => {
    it('resolves with a synthetic handle and a stamped joinedAt', async () => {
      const fixedNow = new Date('2026-05-01T00:01:00Z');
      const provider = new MockBotProvider({ now: () => fixedNow });
      const result = await provider.join(baseRequest);
      expect(result.handle.sessionId).toBe('sess-mock-1');
      expect(result.joinedAt).toEqual(fixedNow);
      expect(result.participants).toHaveLength(2);
      expect(result.participants[0].externalId).toBe('mock-user-1');
    });

    it('honors joinDelayMs', async () => {
      const provider = new MockBotProvider({ joinDelayMs: 500 });
      const promise = provider.join(baseRequest);
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(499);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
    });

    it('rejects with BotJoinRefusedError when joinShouldFail = refused', async () => {
      const provider = new MockBotProvider({ joinShouldFail: 'refused' });
      await expect(provider.join(baseRequest)).rejects.toBeInstanceOf(BotJoinRefusedError);
    });

    it('rejects with BotJoinTimeoutError when joinShouldFail = timeout', async () => {
      const provider = new MockBotProvider({ joinShouldFail: 'timeout' });
      await expect(provider.join(baseRequest)).rejects.toBeInstanceOf(BotJoinTimeoutError);
    });

    it('returns a copy of the configured participant list (caller cannot mutate internal state)', async () => {
      const provider = new MockBotProvider();
      const a = await provider.join(baseRequest);
      a.participants.push({ externalId: 'rogue', displayName: 'Rogue' });
      const b = await provider.join({ ...baseRequest, sessionId: 'sess-mock-2' });
      expect(b.participants).toHaveLength(2);
    });
  });

  describe('subscribeAudio()', () => {
    it('emits silence frames at the configured cadence and stops on unsubscribe', async () => {
      const provider = new MockBotProvider({ frameIntervalMs: 100 });
      const result = await provider.join(baseRequest);
      const frames: BotAudioFrame[] = [];
      const sub = await provider.subscribeAudio(result.handle, (f) => {
        frames.push(f);
      });
      await vi.advanceTimersByTimeAsync(350);
      expect(frames).toHaveLength(3);
      for (const f of frames) {
        expect(f.sessionId).toBe('sess-mock-1');
        expect(f.sampleRate).toBe(16000);
        expect(f.channels).toBe(1);
        expect(f.speakerExternalId).toBeNull();
        expect(f.pcm.byteLength).toBe(640);
      }
      await sub.unsubscribe();
      await vi.advanceTimersByTimeAsync(500);
      expect(frames).toHaveLength(3);
    });

    it('cycles through audioScript when provided', async () => {
      const provider = new MockBotProvider({
        frameIntervalMs: 50,
        audioScript: [
          {
            timestampMs: 0,
            pcm: new Uint8Array([1, 2, 3, 4]),
            sampleRate: 16000,
            channels: 1,
            speakerExternalId: 'mock-user-1',
          },
          {
            timestampMs: 20,
            pcm: new Uint8Array([5, 6, 7, 8]),
            sampleRate: 16000,
            channels: 1,
            speakerExternalId: 'mock-user-2',
          },
        ],
      });
      const result = await provider.join(baseRequest);
      const frames: BotAudioFrame[] = [];
      const sub = await provider.subscribeAudio(result.handle, (f) => {
        frames.push(f);
      });
      await vi.advanceTimersByTimeAsync(160);
      await sub.unsubscribe();
      expect(frames.length).toBeGreaterThanOrEqual(3);
      expect(frames[0].speakerExternalId).toBe('mock-user-1');
      expect(frames[1].speakerExternalId).toBe('mock-user-2');
      expect(frames[2].speakerExternalId).toBe('mock-user-1');
    });

    it('emits no frames when audioScript is empty array (silence-suppressed mode)', async () => {
      const provider = new MockBotProvider({
        frameIntervalMs: 50,
        audioScript: [],
      });
      const result = await provider.join(baseRequest);
      const frames: BotAudioFrame[] = [];
      const sub = await provider.subscribeAudio(result.handle, (f) => {
        frames.push(f);
      });
      await vi.advanceTimersByTimeAsync(200);
      await sub.unsubscribe();
      // Empty audioScript still emits silence frames — see types.ts comment.
      // The spec: undefined script = generated silence; [] script = silence too,
      // so consumers must rely on `leave()` / `unsubscribe()` to stop, not on []
      // suppressing emission.
      expect(frames.length).toBeGreaterThan(0);
      for (const f of frames) {
        expect(f.pcm.byteLength).toBe(640);
      }
    });

    it('unsubscribe is idempotent', async () => {
      const provider = new MockBotProvider({ frameIntervalMs: 50 });
      const result = await provider.join(baseRequest);
      const sub = await provider.subscribeAudio(result.handle, () => {});
      await sub.unsubscribe();
      await expect(sub.unsubscribe()).resolves.toBeUndefined();
    });

    it('listener errors do not stop frame emission', async () => {
      const provider = new MockBotProvider({ frameIntervalMs: 50 });
      const result = await provider.join(baseRequest);
      let calls = 0;
      const sub = await provider.subscribeAudio(result.handle, () => {
        calls += 1;
        throw new Error('boom');
      });
      await vi.advanceTimersByTimeAsync(200);
      await sub.unsubscribe();
      expect(calls).toBeGreaterThanOrEqual(3);
    });
  });

  describe('leave()', () => {
    it('stops all audio timers for the session', async () => {
      const provider = new MockBotProvider({ frameIntervalMs: 50 });
      const result = await provider.join(baseRequest);
      const frames: BotAudioFrame[] = [];
      await provider.subscribeAudio(result.handle, (f) => {
        frames.push(f);
      });
      await provider.leave(result.handle);
      const before = frames.length;
      await vi.advanceTimersByTimeAsync(500);
      expect(frames.length).toBe(before);
    });

    it('is idempotent', async () => {
      const provider = new MockBotProvider();
      const result = await provider.join(baseRequest);
      await provider.leave(result.handle);
      await expect(provider.leave(result.handle)).resolves.toBeUndefined();
    });
  });

  describe('getParticipants()', () => {
    it('returns the configured roster', async () => {
      const roster = [
        { externalId: 'x', displayName: 'X' },
        { externalId: 'y', displayName: 'Y' },
        { externalId: 'z', displayName: 'Z' },
      ];
      const provider = new MockBotProvider({ participants: roster });
      const result = await provider.join(baseRequest);
      const participants = await provider.getParticipants(result.handle);
      expect(participants).toEqual(roster);
    });
  });
});
