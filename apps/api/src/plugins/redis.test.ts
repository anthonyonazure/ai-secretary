import { describe, expect, it } from 'vitest';
import { InMemoryHeartbeatStore } from './redis.js';

describe('InMemoryHeartbeatStore', () => {
  it('reports a freshly-set heartbeat as not lost', async () => {
    const store = new InMemoryHeartbeatStore();
    await store.setHeartbeat('rec-1', 90);
    expect(await store.isHeartbeatLost('rec-1')).toBe(false);
  });

  it('reports an unset heartbeat as lost', async () => {
    const store = new InMemoryHeartbeatStore();
    expect(await store.isHeartbeatLost('rec-missing')).toBe(true);
  });

  it('expires heartbeats once TTL elapses', async () => {
    const store = new InMemoryHeartbeatStore();
    // 0 seconds = effectively expired immediately.
    await store.setHeartbeat('rec-2', 0);
    // Force a one-tick gap via an awaited microtask.
    await Promise.resolve();
    expect(await store.isHeartbeatLost('rec-2')).toBe(true);
  });

  it('tracks watchdog-fired markers within their TTL window', async () => {
    const store = new InMemoryHeartbeatStore();
    expect(await store.hasWatchdogFired('rec-3')).toBe(false);
    await store.markWatchdogFired('rec-3', 300);
    expect(await store.hasWatchdogFired('rec-3')).toBe(true);
  });

  it('clears all state on __reset()', async () => {
    const store = new InMemoryHeartbeatStore();
    await store.setHeartbeat('a', 90);
    await store.markWatchdogFired('a', 300);
    store.__reset();
    expect(await store.isHeartbeatLost('a')).toBe(true);
    expect(await store.hasWatchdogFired('a')).toBe(false);
  });
});
