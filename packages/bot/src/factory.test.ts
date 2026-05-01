import { describe, expect, it } from 'vitest';

import { BotProviderUnavailableError } from './errors.js';
import { createBotProvider } from './factory.js';
import { MockBotProvider } from './providers/mock.js';
import { TeamsBotProvider } from './providers/teams.js';
import { ZoomBotProvider } from './providers/zoom.js';

describe('createBotProvider', () => {
  it('returns a MockBotProvider for kind=mock', () => {
    const p = createBotProvider({ kind: 'mock' });
    expect(p).toBeInstanceOf(MockBotProvider);
    expect(p.kind).toBe('mock');
  });

  it('returns a ZoomBotProvider when full config is supplied', () => {
    const p = createBotProvider({
      kind: 'zoom',
      zoom: {
        accountId: 'a',
        clientId: 'b',
        clientSecret: 'c',
        region: 'us',
      },
    });
    expect(p).toBeInstanceOf(ZoomBotProvider);
  });

  it('throws BotProviderUnavailableError when zoom config is incomplete', () => {
    expect(() =>
      createBotProvider({
        kind: 'zoom',
        zoom: {
          accountId: '',
          clientId: 'b',
          clientSecret: 'c',
          region: 'us',
        },
      }),
    ).toThrow(BotProviderUnavailableError);
  });

  it('throws if kind=zoom but no zoom config supplied', () => {
    expect(() => createBotProvider({ kind: 'zoom' })).toThrow(/zoom config/);
  });

  it('returns a TeamsBotProvider when full config is supplied', () => {
    const p = createBotProvider({
      kind: 'teams',
      teams: {
        azureTenantId: 'a',
        clientId: 'b',
        clientSecret: 'c',
        region: 'us',
      },
    });
    expect(p).toBeInstanceOf(TeamsBotProvider);
  });

  it('throws if kind=teams but no teams config supplied', () => {
    expect(() => createBotProvider({ kind: 'teams' })).toThrow(/teams config/);
  });

  it('passes through MockBotProviderOptions', () => {
    const p = createBotProvider({ kind: 'mock', mock: { joinDelayMs: 25 } });
    expect(p).toBeInstanceOf(MockBotProvider);
  });
});
