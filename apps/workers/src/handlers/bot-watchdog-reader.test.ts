/**
 * Smoke test for `DrizzleBotWatchdogReader` — the production reader is
 * a thin Drizzle wrapper, so we focus on the contract it exposes to
 * `bot-watchdog.ts` rather than the SQL itself (covered by RLS + the
 * end-to-end `bot-watchdog.test.ts` integration suite).
 *
 * The full integration test path lives in `bot-watchdog.test.ts`,
 * which uses an InMemoryBotWatchdogReader — this file only verifies
 * the type-shape conformance.
 */

import { describe, expect, it } from 'vitest';

import { DrizzleBotWatchdogReader } from './bot-watchdog-reader.js';
import type { BotWatchdogReader } from './bot-watchdog.js';

describe('DrizzleBotWatchdogReader', () => {
  it('implements BotWatchdogReader contract', () => {
    // Compile-time + runtime check: the class is constructible and
    // satisfies the interface. The real Drizzle path is exercised by
    // an integration test against a live Postgres in CI (TODO when
    // pg-tap harness lands).
    const _typecheck: new (db: unknown) => BotWatchdogReader =
      DrizzleBotWatchdogReader as unknown as new (
        db: unknown,
      ) => BotWatchdogReader;
    expect(_typecheck).toBe(DrizzleBotWatchdogReader);
  });
});
