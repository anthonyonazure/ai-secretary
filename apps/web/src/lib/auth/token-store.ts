/**
 * Token storage for the web client.
 *
 * Story 1.5e — refresh token is held in an httpOnly cookie set by the
 * `/api/v1/auth/{signup,login,verify-mfa,refresh,accept-invite}` routes.
 * The cookie is `Path=/api/v1/auth`, `SameSite=Lax`, `Secure` in prod —
 * not readable from JS, so XSS can't exfiltrate it. Web clients no longer
 * carry the refresh token in localStorage; the cookie travels with
 * `credentials: 'include'` on every auth-route request.
 *
 * Access token: kept ONLY in the in-memory Zustand store (see
 * `hooks/use-auth.ts`). Lost on tab close — recovered on next mount via
 * a `/auth/refresh` request that re-issues the access token using the
 * cookie-borne refresh.
 *
 * The legacy `loadRefreshToken / saveRefreshToken / clearRefreshToken`
 * helpers are retained as one-time-cleanup no-ops: any old localStorage
 * value left over from the Story 1.5a tradeoff is removed at module load
 * so it can't leak in a future XSS.
 */

const LEGACY_REFRESH_TOKEN_KEY = 'aisecretary.refresh-token';

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Best-effort: scrub any stale localStorage value left over from 1.5a.
// Runs once at module load.
(function scrubLegacyRefreshToken(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // ignore — privacy-mode storage etc.
  }
})();

/** Always returns null — refresh now lives in the httpOnly cookie. Kept for
 * call-site compatibility with the Story 1.5a auth-fetch surface. */
export function loadRefreshToken(): string | null {
  return null;
}

/** No-op — server controls the cookie. Kept for compatibility. */
export function saveRefreshToken(_token: string): void {
  /* no-op under the cookie path */
}

/** No-op — `/auth/logout` clears the cookie server-side. Kept for compatibility. */
export function clearRefreshToken(): void {
  /* no-op under the cookie path */
}

export const __TOKEN_STORE_KEY = LEGACY_REFRESH_TOKEN_KEY;
