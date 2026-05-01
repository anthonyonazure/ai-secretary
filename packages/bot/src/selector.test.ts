import { describe, expect, it } from 'vitest';

import { selectBotProviderKind } from './selector.js';

describe('selectBotProviderKind', () => {
  it('picks zoom for zoom_bot in production', () => {
    expect(selectBotProviderKind({ source: 'zoom_bot', mode: 'production' })).toBe('zoom');
  });

  it('picks teams for teams_bot in production', () => {
    expect(selectBotProviderKind({ source: 'teams_bot', mode: 'production' })).toBe('teams');
  });

  it('picks mock for any source in dev mode', () => {
    expect(selectBotProviderKind({ source: 'zoom_bot', mode: 'dev' })).toBe('mock');
    expect(selectBotProviderKind({ source: 'teams_bot', mode: 'dev' })).toBe('mock');
  });

  it('picks mock for any source in test mode', () => {
    expect(selectBotProviderKind({ source: 'zoom_bot', mode: 'test' })).toBe('mock');
    expect(selectBotProviderKind({ source: 'teams_bot', mode: 'test' })).toBe('mock');
  });

  it('forceMock overrides production mode', () => {
    expect(selectBotProviderKind({ source: 'zoom_bot', mode: 'production', forceMock: true })).toBe(
      'mock',
    );
  });
});
