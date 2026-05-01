/**
 * Per-tenant + per-source provider selection.
 *
 * The selector decides WHICH `BotProviderKind` to instantiate; the
 * factory decides HOW. Mirror of `packages/transcription/src/selector.ts`.
 *
 * Rules:
 *   - `source = 'zoom_bot'`  → 'zoom'  in production, 'mock' in `dev`/`test`
 *   - `source = 'teams_bot'` → 'teams' in production, 'mock' in `dev`/`test`
 *   - When `forceMock` is set (for unit tests against real-source rows),
 *     always returns 'mock'.
 *
 * Region pinning is enforced upstream by the worker setting
 * `app.current_region`; the selector doesn't branch on region (the
 * provider config itself is region-scoped — separate Zoom + Teams apps
 * per region).
 */

import type { BotProviderKind, BotSource } from './types.js';

export type RuntimeMode = 'production' | 'dev' | 'test';

export interface BotSelectorInput {
  source: BotSource;
  mode: RuntimeMode;
  /** Test seam: force the mock provider regardless of source/mode. */
  forceMock?: boolean;
}

export const selectBotProviderKind = (input: BotSelectorInput): BotProviderKind => {
  if (input.forceMock) return 'mock';
  if (input.mode === 'dev' || input.mode === 'test') return 'mock';
  switch (input.source) {
    case 'zoom_bot':
      return 'zoom';
    case 'teams_bot':
      return 'teams';
  }
};
