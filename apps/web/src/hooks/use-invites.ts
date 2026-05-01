/**
 * Story 1.5d — invites React Query hooks for the web client.
 *
 * Exposes:
 *   - useInvitesList(tenantId)    — admin list query
 *   - useCreateInvite(tenantId)   — admin create mutation
 *   - useRevokeInvite(tenantId)   — admin revoke mutation
 *   - useInviteLookup(token)      — public lookup query (unauthenticated)
 *   - useAcceptInvite()           — public accept mutation; on success
 *                                   the auth store gets the new session.
 *
 * Mirrors `use-auth.ts` patterns. The two public hooks deliberately do
 * NOT pass through `authFetch` — the recipient has no session yet, so
 * we want a bare fetch that doesn't try to attach an Authorization
 * header (which would 401-then-fail-refresh on the server).
 */

import { type AuthResponse, authResponseSchema } from '@aisecretary/shared/schemas/auth';
import {
  type AcceptInviteRequest,
  type CreateInviteRequest,
  type Invite,
  type InviteLookupResponse,
  type InvitesListResponse,
  acceptInviteRequestSchema,
  createInviteRequestSchema,
  inviteLookupResponseSchema,
  inviteSchema,
  invitesListResponseSchema,
} from '@aisecretary/shared/schemas/invites';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { resolveApiBaseUrl } from '../lib/auth/api-client';
import { type AuthFetchError, readProblemDetails } from '../lib/auth/auth-fetch';
import { buildAuthDeps, useAuthStore } from './use-auth';

void createInviteRequestSchema;
void acceptInviteRequestSchema;

const buildUrl = (path: string): string => {
  const base = resolveApiBaseUrl();
  return base.endsWith('/') ? `${base.slice(0, -1)}${path}` : `${base}${path}`;
};

export const invitesQueryKey = (tenantId: string): readonly unknown[] => [
  'invites',
  'list',
  tenantId,
];

export const inviteLookupQueryKey = (token: string): readonly unknown[] => [
  'invites',
  'lookup',
  token,
];

/** Admin: list invites for a tenant. */
export function useInvitesList(tenantId: string | undefined) {
  const { authFetch } = useMemo(() => buildAuthDeps(), []);
  return useQuery<InvitesListResponse>({
    queryKey: invitesQueryKey(tenantId ?? ''),
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await authFetch(buildUrl(`/api/v1/tenants/${tenantId}/invites`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      return invitesListResponseSchema.parse(json);
    },
  });
}

/** Admin: create a new invite. */
export function useCreateInvite(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const { authFetch } = useMemo(() => buildAuthDeps(), []);
  return useMutation<Invite, AuthFetchError, CreateInviteRequest>({
    mutationFn: async (input) => {
      const res = await authFetch(buildUrl(`/api/v1/tenants/${tenantId}/invites`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      return inviteSchema.parse(json);
    },
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({ queryKey: invitesQueryKey(tenantId) });
      }
    },
  });
}

/** Admin: revoke an invite. */
export function useRevokeInvite(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const { authFetch } = useMemo(() => buildAuthDeps(), []);
  return useMutation<void, AuthFetchError, string>({
    mutationFn: async (inviteId) => {
      const res = await authFetch(buildUrl(`/api/v1/tenants/${tenantId}/invites/${inviteId}`), {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) throw await readProblemDetails(res);
    },
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({ queryKey: invitesQueryKey(tenantId) });
      }
    },
  });
}

/** Public: lookup invite metadata by token. Unauthenticated. */
export function useInviteLookup(token: string | undefined) {
  return useQuery<InviteLookupResponse>({
    queryKey: inviteLookupQueryKey(token ?? ''),
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const res = await fetch(buildUrl(`/api/v1/invites/${token}`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      return inviteLookupResponseSchema.parse(json);
    },
  });
}

/**
 * Public: accept an invite. On success, populates the auth store with
 * the new session (same as `signup` / `login`). Subsequent navigation
 * to authenticated routes works without an additional login step.
 */
export function useAcceptInvite() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse, AuthFetchError, AcceptInviteRequest>({
    mutationFn: async (input) => {
      const res = await fetch(buildUrl(`/api/v1/invites/${input.token}/accept`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      return authResponseSchema.parse(json);
    },
    onSuccess: (response) => {
      setSession(response);
    },
  });
}
