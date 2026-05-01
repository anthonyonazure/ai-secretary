/// <reference lib="dom" />

import { isRedirect } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../hooks/use-auth';
import { Route as AuthenticatedRoute } from './_authenticated';

/**
 * The `_authenticated` layout route enforces the "must be signed in"
 * gate via `beforeLoad`. We exercise the guard directly — invoking
 * the function with the auth store cleared throws a redirect; with
 * the store hydrated it returns void.
 */
describe('_authenticated route guard (Story 1.6)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticating: false,
      isHydrated: true,
    });
  });

  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticating: false,
      isHydrated: true,
    });
  });

  function callBeforeLoad(): unknown {
    const beforeLoad = AuthenticatedRoute.options.beforeLoad;
    if (typeof beforeLoad !== 'function') {
      throw new Error('Expected beforeLoad to be a function');
    }
    // The guard only reads `location.href`; everything else is ignored
    // for the unauthenticated branch. The signature on the typed router
    // is wide; we cast via `unknown` to satisfy TS without leaking the
    // full router types into the test.
    return (beforeLoad as (ctx: unknown) => unknown)({
      location: { href: '/inbox' },
    });
  }

  it('throws a redirect to /login when the user is null', () => {
    let caught: unknown = null;
    try {
      callBeforeLoad();
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(isRedirect(caught)).toBe(true);
  });

  it('returns void when the user is signed in', () => {
    useAuthStore.setState({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.test',
        name: 'Test',
        role: 'org_admin',
        tenantId: '00000000-0000-0000-0000-000000000002',
        region: 'us',
        isMfaEnabled: false,
      },
      accessToken: 'access-token',
      isAuthenticating: false,
      isHydrated: true,
    });

    expect(() => callBeforeLoad()).not.toThrow();
  });
});
