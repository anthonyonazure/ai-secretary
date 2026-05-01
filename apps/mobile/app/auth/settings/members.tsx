/**
 * `/auth/settings/members` — Story 1.5d (mobile).
 *
 * Admin-only screen that lists pending + historical invites and lets
 * an `org_admin` create / revoke. Mirrors the web `/settings/members`
 * route shape.
 *
 * Note: this is parked under `app/auth/settings/` rather than a
 * dedicated authenticated layout because the mobile app's tab/stack
 * structure for authenticated surfaces is wired in a follow-up
 * story; for now Expo Router renders this screen directly. The
 * underlying React Query hooks + auth-fetch handle the session check
 * implicitly (calls 401 redirect to /auth/login on the consumer
 * side).
 */

import {
  type CreateInviteRequest,
  type Invite,
  inviteSchema,
  invitesListResponseSchema,
} from '@aisecretary/shared/schemas/invites';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { InviteCreateForm } from '../../../components/invites/invite-create-form';
import { InviteList } from '../../../components/invites/invite-list';
import { useAuth, useAuthStore } from '../../../hooks/use-auth';
import { createAuthApiClient, resolveApiBaseUrl } from '../../../lib/auth/api-client';
import { type AuthFetch, createAuthFetch, readProblemDetails } from '../../../lib/auth/auth-fetch';
import { loadRefreshToken } from '../../../lib/auth/token-store';

export default function MembersScreen() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const isAdmin = user?.role === 'org_admin' || user?.role === 'super_admin';
  const baseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const authFetch = useMemo<AuthFetch>(
    () =>
      createAuthFetch({
        getAccessToken: () => useAuthStore.getState().accessToken,
        onRefresh: async () => {
          const token = await loadRefreshToken();
          if (!token) return null;
          try {
            const bare = createAuthApiClient({
              authFetch: globalThis.fetch.bind(globalThis) as AuthFetch,
              baseUrl,
            });
            const r = await bare.refresh({ refreshToken: token });
            await useAuthStore.getState().setSession(r);
            return r.accessToken;
          } catch {
            return null;
          }
        },
        onRefreshFailure: () => {
          void useAuthStore.getState().clear();
        },
      }),
    [baseUrl],
  );

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [serverError, setServerError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const refresh = async (): Promise<void> => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${baseUrl}/api/v1/tenants/${tenantId}/invites`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      const parsed = invitesListResponseSchema.parse(json);
      setInvites(parsed.items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable per (isAdmin, tenantId).
  useEffect(() => {
    if (isAdmin && tenantId) {
      void refresh();
    }
  }, [isAdmin, tenantId]);

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-bg p-6">
        <View className="w-full max-w-md flex-col gap-2 rounded-md border border-border bg-surface p-6">
          <Text className="text-xl font-semibold text-fg">Members</Text>
          <Text className="text-sm text-fg-muted">
            Inviting members is admin-only. Ask an org admin to add new teammates.
          </Text>
        </View>
      </View>
    );
  }

  const handleCreate = async (values: CreateInviteRequest): Promise<void> => {
    if (!tenantId) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await authFetch(`${baseUrl}/api/v1/tenants/${tenantId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await readProblemDetails(res);
      const json = (await res.json()) as unknown;
      const created = inviteSchema.parse(json);
      setInvites((prev) => [created, ...prev]);
    } catch (err) {
      setServerError(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (inviteId: string): Promise<void> => {
    if (!tenantId) return;
    setRevoking(true);
    try {
      const res = await authFetch(`${baseUrl}/api/v1/tenants/${tenantId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) throw await readProblemDetails(res);
      await refresh();
    } finally {
      setRevoking(false);
    }
  };

  return (
    <ScrollView contentContainerClassName="min-h-full bg-bg" keyboardShouldPersistTaps="handled">
      <View className="flex-1 p-6">
        <View className="mb-6 flex-col gap-1">
          <Text className="text-2xl font-semibold text-fg">Members</Text>
          <Text className="text-sm text-fg-muted">
            Invite teammates and manage pending invites.
          </Text>
        </View>
        <InviteCreateForm
          onSubmit={handleCreate}
          serverError={serverError}
          isSubmitting={submitting}
        />
        <View className="mt-6">
          {loading ? (
            <ActivityIndicator />
          ) : error ? (
            <Text accessibilityRole="alert" className="text-sm text-fg">
              Could not load invites. Please refresh.
            </Text>
          ) : (
            <InviteList invites={invites} onRevoke={handleRevoke} isRevoking={revoking} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
