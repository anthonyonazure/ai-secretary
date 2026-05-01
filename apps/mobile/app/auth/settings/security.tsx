/**
 * `/auth/settings/security` — Story 1.5c mobile security settings.
 *
 * MFA enrollment + disable + recovery-code regenerate. Reachable from
 * the authenticated app shell (via the future settings nav link) and as
 * the redirect target for the force-enroll path on `/auth/login`. The
 * page itself requires an authenticated session — the auth-gate at
 * `app/_layout.tsx` allows the auth group through while unauthenticated
 * but the MFA APIs require a JWT, so unauthenticated visits fall back
 * to the empty state with a "Sign in first" banner.
 */

import type { MfaEnrollResponse } from '@aisecretary/shared/schemas/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MfaEnrollmentCard } from '../../../components/auth/mfa-enrollment-card';
import { MfaRecoveryCodesDisplay } from '../../../components/auth/mfa-recovery-codes-display';
import { useAuth } from '../../../hooks/use-auth';

type FlowState =
  | { kind: 'idle' }
  | { kind: 'enrolling'; enrollment: MfaEnrollResponse }
  | { kind: 'enabled' }
  | { kind: 'regenerated'; recoveryCodes: string[] };

export default function SecurityScreen() {
  const {
    user,
    isAuthenticated,
    enrollMfa,
    confirmMfa,
    disableMfa,
    regenerateRecoveryCodes,
    confirmMfaError,
    disableMfaError,
    regenerateRecoveryCodesError,
  } = useAuth();
  const initial: FlowState = user?.isMfaEnabled ? { kind: 'enabled' } : { kind: 'idle' };
  const [state, setState] = useState<FlowState>(initial);

  if (!isAuthenticated) {
    return (
      <ScrollView contentContainerClassName="min-h-full bg-bg p-6">
        <View className="flex-col gap-3">
          <Text className="text-2xl font-semibold text-fg">Security</Text>
          <Text className="text-sm text-fg-muted">
            Sign in first to manage two-factor authentication.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/auth/login')}
            className="min-h-11 flex-row items-center justify-center rounded-md bg-accent px-4 py-2"
          >
            <Text className="text-sm font-medium text-bg">Go to sign-in</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerClassName="min-h-full bg-bg p-6">
      <View className="flex-col gap-6">
        <View>
          <Text className="text-2xl font-semibold text-fg">Security</Text>
          <Text className="mt-1 text-sm text-fg-muted">
            Manage multi-factor authentication for your account.
          </Text>
        </View>

        {state.kind === 'idle' ? (
          <View className="flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-fg">Two-factor authentication</Text>
            <Text className="text-sm text-fg-muted">
              Add an authenticator app for an extra layer of security.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                const enrollment = await enrollMfa();
                setState({ kind: 'enrolling', enrollment });
              }}
              testID="mfa-enroll-start"
              className="min-h-9 flex-row items-center self-start rounded-md bg-accent px-3 py-1"
            >
              <Text className="text-sm font-medium text-bg">Enable two-factor authentication</Text>
            </Pressable>
          </View>
        ) : null}

        {state.kind === 'enrolling' ? (
          <MfaEnrollmentCard
            otpauthUri={state.enrollment.otpauthUri}
            secret={state.enrollment.secret}
            recoveryCodes={state.enrollment.recoveryCodes}
            serverError={confirmMfaError}
            onConfirm={async ({ code }) => {
              await confirmMfa({ code });
              setState({ kind: 'enabled' });
            }}
          />
        ) : null}

        {state.kind === 'enabled' ? (
          <ManageEnabledMfa
            onDisable={async (password, code) => {
              await disableMfa({ password, code });
              setState({ kind: 'idle' });
            }}
            onRegenerate={async (password, code) => {
              const fresh = await regenerateRecoveryCodes({ password, code });
              setState({ kind: 'regenerated', recoveryCodes: fresh.recoveryCodes });
            }}
            disableError={disableMfaError}
            regenerateError={regenerateRecoveryCodesError}
          />
        ) : null}

        {state.kind === 'regenerated' ? (
          <MfaRecoveryCodesDisplay
            recoveryCodes={state.recoveryCodes}
            onAcknowledge={() => setState({ kind: 'enabled' })}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function ManageEnabledMfa({
  onDisable,
  onRegenerate,
  disableError,
  regenerateError,
}: {
  onDisable: (password: string, code: string) => Promise<void>;
  onRegenerate: (password: string, code: string) => Promise<void>;
  disableError: unknown;
  regenerateError: unknown;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'disable' | 'regenerate' | null>(null);

  return (
    <View
      testID="mfa-manage-enabled"
      className="flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <Text className="text-sm font-semibold text-fg">Two-factor authentication is enabled</Text>
      <Text className="text-sm text-fg-muted">
        To disable MFA or regenerate your recovery codes, re-enter your password and a current
        authenticator code.
      </Text>
      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Password</Text>
        <TextInput
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
        />
      </View>
      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Authenticator code</Text>
        <TextInput
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          value={code}
          onChangeText={setCode}
          accessibilityLabel="Authenticator code"
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm tracking-widest text-fg"
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={async () => {
            setBusy('regenerate');
            try {
              await onRegenerate(password, code);
              setPassword('');
              setCode('');
            } finally {
              setBusy(null);
            }
          }}
          testID="mfa-regenerate-codes"
          className={`min-h-9 flex-row items-center rounded-md border border-border px-3 py-1 ${
            busy ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-sm font-medium text-fg">Regenerate recovery codes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={async () => {
            setBusy('disable');
            try {
              await onDisable(password, code);
            } finally {
              setBusy(null);
            }
          }}
          testID="mfa-disable"
          className={`min-h-9 flex-row items-center rounded-md border border-border px-3 py-1 ${
            busy ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-sm font-medium text-fg">Disable two-factor authentication</Text>
        </Pressable>
      </View>
      {disableError ? (
        <Text accessibilityRole="alert" className="text-sm text-fg">
          Failed to disable MFA — check your password and code.
        </Text>
      ) : null}
      {regenerateError ? (
        <Text accessibilityRole="alert" className="text-sm text-fg">
          Failed to regenerate codes — check your password and code.
        </Text>
      ) : null}
    </View>
  );
}
