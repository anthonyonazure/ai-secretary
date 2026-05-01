import { describe, expect, it } from 'vitest';

import { deriveHeartbeatWindow } from './use-heartbeat-window.js';

describe('deriveHeartbeatWindow', () => {
  it('returns "fresh" when not capturing (gate)', () => {
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: 1_700_000_000_000,
      now: 1_700_000_120_000,
      isCapturing: false,
    });
    expect(r.state).toBe('fresh');
    expect(r.showAtRiskBanner).toBe(false);
  });

  it('returns "never" when no heartbeat has fired yet', () => {
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: null,
      now: 1_700_000_000_000,
      isCapturing: true,
    });
    expect(r.state).toBe('never');
    expect(r.secondsSinceLastPing).toBe(-1);
  });

  it('returns "fresh" inside the 30s window', () => {
    const now = 1_700_000_000_000;
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: now - 15_000,
      now,
      isCapturing: true,
    });
    expect(r.state).toBe('fresh');
    expect(r.secondsSinceLastPing).toBe(15);
    expect(r.showAtRiskBanner).toBe(false);
  });

  it('returns "warning" between 30s and 90s', () => {
    const now = 1_700_000_000_000;
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: now - 60_000,
      now,
      isCapturing: true,
    });
    expect(r.state).toBe('warning');
    expect(r.showAtRiskBanner).toBe(false);
  });

  it('returns "at-risk" past the 90s threshold', () => {
    const now = 1_700_000_000_000;
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: now - 95_000,
      now,
      isCapturing: true,
    });
    expect(r.state).toBe('at-risk');
    expect(r.showAtRiskBanner).toBe(true);
    expect(r.secondsSinceLastPing).toBe(95);
  });

  it('clamps negative elapsed to zero (clock drift)', () => {
    const now = 1_700_000_000_000;
    const r = deriveHeartbeatWindow({
      lastHeartbeatMs: now + 5000,
      now,
      isCapturing: true,
    });
    expect(r.secondsSinceLastPing).toBe(0);
    expect(r.state).toBe('fresh');
  });
});
