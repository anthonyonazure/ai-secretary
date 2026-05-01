/**
 * fetch wrapper for the mobile client. Mirrors the web implementation so
 * the auth contract stays identical across platforms.
 *
 *   1. Auto-attaches `Authorization: Bearer <accessToken>`.
 *   2. On 401, refreshes ONCE and retries with the new token.
 *   3. Surfaces RFC 7807 problem details via AuthFetchError.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  requestId?: string;
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
  getAccessToken: () => string | null;
  onRefresh: () => Promise<string | null>;
  onRefreshFailure: () => void;
  fetchImpl?: typeof fetch;
}

export type AuthFetchOptions = RequestInit & {
  skipAuth?: boolean;
};

export type AuthFetch = (input: RequestInfo | URL, init?: AuthFetchOptions) => Promise<Response>;

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

    await initial.body?.cancel().catch(() => undefined);

    const refreshed = await deps.onRefresh();
    if (!refreshed) {
      deps.onRefreshFailure();
      return sendOnce(input, options, null, { fetchImpl, skipAuth: true });
    }

    return sendOnce(input, options, refreshed, { fetchImpl, skipAuth: false });
  };
}

function mergeAuthHeaders(
  base: HeadersInit | undefined,
  authorization: string | null,
): HeadersInit {
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
  const { skipAuth: _skipAuth, ...rest } = options;
  void _skipAuth;
  const init: RequestInit = {
    ...rest,
    headers: mergeAuthHeaders(options.headers, authHeader),
  };
  return ctx.fetchImpl(input, init);
}

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
    // non-JSON body
  }
  const message =
    problem.detail ?? problem.title ?? `Request failed with status ${response.status}`;
  return new AuthFetchError(message, response.status, problem);
}
