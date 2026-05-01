/**
 * fetch wrapper that:
 *   1. Attaches `Authorization: Bearer <accessToken>` when one is available.
 *   2. On a 401, tries to refresh ONCE via the supplied `onRefresh` callback;
 *      on success, retries the original request with the new token. On
 *      failure, clears the token store via `onRefreshFailure` and bubbles
 *      the original 401 to the caller.
 *   3. Surfaces RFC 7807 problem details by parsing the JSON body and
 *      throwing an `AuthFetchError` with the parsed shape.
 *
 * The store + refresh hooks are injected (not imported) so the wrapper
 * stays trivially testable and decoupled from Zustand.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  /** Optional field-level errors keyed by JSON pointer / form path. */
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
}

export class AuthFetchError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(message: string, status: number, problem: ProblemDetails) {
    super(message);
    this.name = 'AuthFetchError';
    this.status = status;
    this.problem = problem;
  }
}

export interface AuthFetchDeps {
  /** Returns the current in-memory access token, or null if signed out. */
  getAccessToken: () => string | null;
  /**
   * Attempts to refresh the access token. Returns the new access token on
   * success, or null on failure. Implementations are responsible for
   * updating the in-memory store before returning.
   */
  onRefresh: () => Promise<string | null>;
  /** Called when refresh fails — clears the in-memory store + storage. */
  onRefreshFailure: () => void;
  /** Custom fetch impl (tests inject a mock). */
  fetchImpl?: typeof fetch;
}

export type AuthFetchOptions = RequestInit & {
  /** When true, skip the Authorization header even if a token exists. */
  skipAuth?: boolean;
};

/**
 * Bound auth-fetch signature. Compatible with the subset of `fetch` we
 * actually call (string URL + optional RequestInit + the optional
 * `skipAuth` extension).
 */
export type AuthFetch = (input: RequestInfo | URL, init?: AuthFetchOptions) => Promise<Response>;

/** Build a configured `authFetch(input, init)` bound to a deps object. */
export function createAuthFetch(deps: AuthFetchDeps): AuthFetch {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return async function authFetch(
    input: RequestInfo | URL,
    options: AuthFetchOptions = {},
  ): Promise<Response> {
    const skipAuth = options.skipAuth ?? false;
    const initial = await sendOnce(input, options, deps.getAccessToken(), {
      fetchImpl,
      skipAuth,
    });
    if (initial.status !== 401 || skipAuth) {
      return initial;
    }

    // 401 path: drain the body so we don't leak the response, then retry once.
    await initial.body?.cancel().catch(() => undefined);

    const refreshed = await deps.onRefresh();
    if (!refreshed) {
      deps.onRefreshFailure();
      // Re-issue the original request without a token so the caller gets a
      // fresh response object to read (the first one's body was cancelled).
      return sendOnce(input, options, null, { fetchImpl, skipAuth: true });
    }

    return sendOnce(input, options, refreshed, {
      fetchImpl,
      skipAuth: false,
    });
  };
}

function mergeAuthHeaders(
  base: HeadersInit | undefined,
  authorization: string | null,
): HeadersInit {
  // Normalise to a Headers instance so we can append / override safely
  // without caring about the input shape (Headers / array / record).
  const headers = new Headers(base ?? undefined);
  if (authorization) {
    headers.set('Authorization', authorization);
  }
  return headers;
}

async function sendOnce(
  input: RequestInfo | URL,
  options: AuthFetchOptions,
  accessToken: string | null,
  ctx: { fetchImpl: typeof fetch; skipAuth: boolean },
): Promise<Response> {
  const authHeader = !ctx.skipAuth && accessToken ? `Bearer ${accessToken}` : null;
  // Strip `skipAuth` from the spread — it's our extension and shouldn't
  // leak into the underlying fetch call.
  const { skipAuth: _skipAuth, ...rest } = options;
  void _skipAuth;
  const init: RequestInit = {
    // Story 1.5e — `credentials: 'include'` makes the browser ship the
    // httpOnly `aisecretary_refresh` cookie on auth-route requests.
    // Caller may override via the spread below.
    credentials: 'include',
    ...rest,
    headers: mergeAuthHeaders(options.headers, authHeader),
  };
  return ctx.fetchImpl(input, init);
}

/**
 * Convenience: parse an RFC 7807 response into an `AuthFetchError`.
 * Caller is responsible for checking `response.ok` first.
 */
export async function readProblemDetails(response: Response): Promise<AuthFetchError> {
  let problem: ProblemDetails = {};
  try {
    const text = await response.text();
    if (text.length > 0) {
      const parsed = JSON.parse(text) as unknown;
      if (parsed !== null && typeof parsed === 'object') {
        problem = parsed as ProblemDetails;
      }
    }
  } catch {
    // Non-JSON response — keep the empty shape.
  }
  const message =
    problem.detail ?? problem.title ?? `Request failed with status ${response.status}`;
  return new AuthFetchError(message, response.status, problem);
}
