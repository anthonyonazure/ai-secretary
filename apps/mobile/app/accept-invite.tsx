/**
 * `/accept-invite` — Story 1.5d. Mobile (Expo Router) screen.
 *
 * Reached via deep link `aisecretary:///accept-invite?token=…` (custom
 * scheme registered in `app.json` `expo.scheme`). The same URL also
 * serves the web flow at `/accept-invite?token=…` — the email body
 * uses the web URL by default; the mobile deep link is intercepted by
 * Expo Router when the AI Secretary app is installed and the iOS
 * Universal Link / Android App Link domain is configured (set up in
 * `expo.ios.associatedDomains` + `expo.android.intentFilters` in a
 * follow-up infra story; the scheme handler below is enough for the
 * MVP).
 */

import { type AuthResponse, authResponseSchema } from '@aisecretary/shared/schemas/auth';
import {
  type AcceptInviteRequest,
  type InviteLookupResponse,
  inviteLookupResponseSchema,
} from '@aisecretary/shared/schemas/invites';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { AcceptInviteForm } from '../components/invites/accept-invite-form';
import { useAuthStore } from '../hooks/use-auth';
import { resolveApiBaseUrl } from '../lib/auth/api-client';
import { AuthFetchError, readProblemDetails } from '../lib/auth/auth-fetch';

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;
  const [lookup, setLookup] = useState<InviteLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<unknown>(null);
  const [serverError, setServerError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBaseUrl()}/api/v1/invites/${token}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw await readProblemDetails(res);
        }
        const json = (await res.json()) as unknown;
        if (cancelled) return;
        setLookup(inviteLookupResponseSchema.parse(json));
      } catch (err) {
        if (cancelled) return;
        setLookupError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (values: AcceptInviteRequest): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${resolveApiBaseUrl()}/api/v1/invites/${values.token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        throw await readProblemDetails(res);
      }
      const json = (await res.json()) as unknown;
      const parsed: AuthResponse = authResponseSchema.parse(json);
      await setSession(parsed);
      router.replace('/');
    } catch (err) {
      setServerError(err);
      if (err instanceof AuthFetchError) {
        // Re-throw so the form's setError path runs.
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <View className="flex-1 items-center justify-center bg-bg p-6">
        <View className="w-full max-w-md flex-col gap-2 rounded-md border border-border bg-surface p-6">
          <Text className="text-xl font-semibold text-fg">Invalid invite link</Text>
          <Text className="text-sm text-fg-muted">
            This URL is missing an invite token. Ask your admin to send a fresh invite.
          </Text>
        </View>
      </View>
    );
  }

  if (!lookup && !lookupError) {
    return (
      <View className="flex-1 items-center justify-center bg-bg p-6">
        <ActivityIndicator />
      </View>
    );
  }

  if (lookupError || !lookup) {
    return (
      <View className="flex-1 items-center justify-center bg-bg p-6">
        <View className="w-full max-w-md flex-col gap-2 rounded-md border border-border bg-surface p-6">
          <Text className="text-xl font-semibold text-fg">This invite is no longer valid</Text>
          <Text className="text-sm text-fg-muted">
            It may have expired, been revoked, or already been accepted.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerClassName="min-h-full bg-bg" keyboardShouldPersistTaps="handled">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-md flex-col gap-6">
          <View className="flex-col gap-2">
            <Text className="text-2xl font-semibold text-fg">Accept your invite</Text>
            <Text className="text-sm text-fg-muted">Set a password and you're in.</Text>
          </View>
          <AcceptInviteForm
            lookup={lookup}
            token={token}
            serverError={serverError}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        </View>
      </View>
    </ScrollView>
  );
}
