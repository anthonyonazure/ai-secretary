import { afterEach, describe, expect, it, vi } from 'vitest';

import { TELEMETRY_REGISTRY, TELEMETRY_SIGNAL_NAMES, findTelemetrySignal } from './registry.js';
import { resetTelemetryTransport, setTelemetryTransport, track, trackAs } from './track.js';

afterEach(() => {
  resetTelemetryTransport();
});

describe('telemetry registry (Story 1.8)', () => {
  it('every entry carries owner + cadence + threshold-action + sink + retention + pii', () => {
    for (const signal of TELEMETRY_REGISTRY) {
      // kebab-case; permits leading digit-letter combos like '7d-...' for
      // time-window-rooted signal names.
      expect(signal.name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(signal.description.length).toBeGreaterThan(20);
      expect(signal.owner.length).toBeGreaterThan(0);
      expect(['daily', 'weekly', 'monthly', 'quarterly']).toContain(signal.cadence);
      expect(signal.thresholdAction.length).toBeGreaterThan(20);
      expect(['posthog', 'internal-table', 'sentry']).toContain(signal.sink);
      expect(signal.retention.length).toBeGreaterThan(0);
      expect(['none', 'pseudonymous', 'identifiable']).toContain(signal.pii);
    }
  });

  it('every name is unique', () => {
    const names = TELEMETRY_REGISTRY.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('seed includes the four Story 1.8 signals', () => {
    expect(TELEMETRY_SIGNAL_NAMES).toContain('first-receipt-thumbs');
    expect(TELEMETRY_SIGNAL_NAMES).toContain('mental-model-free-text');
    expect(TELEMETRY_SIGNAL_NAMES).toContain('7d-activation-rate');
    expect(TELEMETRY_SIGNAL_NAMES).toContain('tab-closer-reengagement-open-rate');
  });

  it('findTelemetrySignal returns undefined for unknown names', () => {
    expect(findTelemetrySignal('made-up-event')).toBeUndefined();
  });
});

describe('track / trackAs (Story 1.8)', () => {
  it('emits via the configured transport when the signal is registered', () => {
    const capture = vi.fn();
    setTelemetryTransport({ capture });
    track('first-receipt-thumbs', { response: 'up' });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({
      name: 'first-receipt-thumbs',
      properties: { response: 'up' },
    });
  });

  it('omits the properties field when no properties are passed', () => {
    const capture = vi.fn();
    setTelemetryTransport({ capture });
    track('7d-activation-rate');
    expect(capture).toHaveBeenCalledWith({ name: '7d-activation-rate' });
  });

  it('throws when called with an unregistered name (runtime guard)', () => {
    setTelemetryTransport({ capture: () => undefined });
    expect(() =>
      // Cast to bypass the TS-narrowed `TelemetrySignalName` so the
      // runtime guard is the thing under test.
      track('not-registered' as unknown as Parameters<typeof track>[0]),
    ).toThrow(/not in the telemetry registry/);
  });

  it('trackAs forwards distinctId on the event payload', () => {
    const capture = vi.fn();
    setTelemetryTransport({ capture });
    trackAs('mental-model-free-text', 'user-123', { text: 'hello' });
    expect(capture).toHaveBeenCalledWith({
      name: 'mental-model-free-text',
      distinctId: 'user-123',
      properties: { text: 'hello' },
    });
  });

  it('the no-op transport is the default after reset', () => {
    resetTelemetryTransport();
    // No transport-side assertion — the default capture is a no-op. The
    // behavioural contract is "no throw + no observable side effect".
    expect(() => track('first-receipt-thumbs')).not.toThrow();
  });
});
