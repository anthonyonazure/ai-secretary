/**
 * Provider factory. Given a kind + the config bundle, return the
 * concrete provider. Mirrors `packages/transcription/src/factory.ts` —
 * the worker side calls `selectProviderKind()` first, then asks the
 * factory for the instance.
 */

import { MockBotProvider, type MockBotProviderOptions } from './providers/mock.js';
import { TeamsBotProvider, type TeamsBotProviderConfig } from './providers/teams.js';
import { ZoomBotProvider, type ZoomBotProviderConfig } from './providers/zoom.js';
import type { BotProvider, BotProviderKind } from './types.js';

export interface BotProviderFactoryInput {
  kind: BotProviderKind;
  zoom?: ZoomBotProviderConfig;
  teams?: TeamsBotProviderConfig;
  mock?: MockBotProviderOptions;
}

export const createBotProvider = (input: BotProviderFactoryInput): BotProvider => {
  switch (input.kind) {
    case 'mock':
      return new MockBotProvider(input.mock);
    case 'zoom':
      if (!input.zoom) {
        throw new Error('createBotProvider: kind=zoom requires zoom config');
      }
      return new ZoomBotProvider(input.zoom);
    case 'teams':
      if (!input.teams) {
        throw new Error('createBotProvider: kind=teams requires teams config');
      }
      return new TeamsBotProvider(input.teams);
  }
};
