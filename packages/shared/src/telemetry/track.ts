/**
 * Typed `track()` wrapper that funnels every product telemetry call
 * through the registered-signal allowlist. Direct `posthog.capture()`
 * calls are banned by the `check:telemetry` CI gate — call sites must use
 * this wrapper so the registry stays the single source of truth.
 *
 * The actual transport is dependency-injected: `setTelemetryTransport`
 * lets the bootstrap code wire PostHog (web), expo-posthog (mobile), or a
 * server-side sink without baking a hard SDK dep into `packages/shared`.
 * Tests inject a capturing transport.
 */

import { type TelemetrySignalName, findTelemetrySignal } from './registry.js';

export interface TelemetryEvent {
  name: TelemetrySignalName;
  /** Free-form properties. Keep PII out unless the signal is declared
   *  `pii: 'identifiable'` in the registry — the CI gate doesn't enforce
   *  this; reviewers do. */
  properties?: Record<string, unknown>;
  /** Override the user/session that the event is attributed to. Default
   *  is whatever the transport's current identity is. */
  distinctId?: string;
}

export interface TelemetryTransport {
  capture(event: TelemetryEvent): void;
}

const noopTransport: TelemetryTransport = {
  capture: () => {
    /* default — no-op until a real transport is installed */
  },
};

let activeTransport: TelemetryTransport = noopTransport;

/** Wire the runtime transport (web / mobile / server bootstrap). */
export function setTelemetryTransport(transport: TelemetryTransport): void {
  activeTransport = transport;
}

/** Restore the no-op transport — for tests that want a clean slate. */
export function resetTelemetryTransport(): void {
  activeTransport = noopTransport;
}

/**
 * Emit a registered telemetry event.
 *
 * The `name` parameter is typed against the registry so misspellings or
 * unregistered names fail at TS-check. Runtime double-check via
 * `findTelemetrySignal` exists for callers that have widened the type
 * (e.g. dynamic event names in dev tooling) — those throw rather than
 * silently emit.
 */
export function track(name: TelemetrySignalName, properties?: Record<string, unknown>): void {
  const signal = findTelemetrySignal(name);
  if (!signal) {
    throw new Error(
      `track(): event '${name}' is not in the telemetry registry. Add it to packages/shared/src/telemetry/registry.ts before emitting.`,
    );
  }
  activeTransport.capture({ name, ...(properties !== undefined ? { properties } : {}) });
}

/**
 * Variant for call sites that already know the distinctId (e.g. backend
 * workers attributing to a specific user without relying on transport
 * identity).
 */
export function trackAs(
  name: TelemetrySignalName,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  const signal = findTelemetrySignal(name);
  if (!signal) {
    throw new Error(
      `trackAs(): event '${name}' is not in the telemetry registry. Add it to packages/shared/src/telemetry/registry.ts before emitting.`,
    );
  }
  activeTransport.capture({
    name,
    distinctId,
    ...(properties !== undefined ? { properties } : {}),
  });
}
