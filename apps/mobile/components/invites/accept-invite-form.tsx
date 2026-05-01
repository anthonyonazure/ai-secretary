/**
 * Story 1.5d — accept-invite form (mobile).
 *
 * Native counterpart to the web form. The tenant binding is
 * pre-resolved via the public lookup endpoint and passed in as
 * `lookup`. The recipient sets only name + password.
 */

import {
  type AcceptInviteRequest,
  type InviteLookupResponse,
  acceptInviteRequestSchema,
} from '@aisecretary/shared/schemas/invites';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, type Path, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AuthFetchError } from '../../lib/auth/auth-fetch';
import { AuthError } from '../auth/auth-error';

export interface AcceptInviteFormProps {
  lookup: InviteLookupResponse;
  token: string;
  onSubmit: (values: AcceptInviteRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<AcceptInviteRequest>> = ['name', 'password', 'token'];

export function AcceptInviteForm({
  lookup,
  token,
  onSubmit,
  serverError,
  isSubmitting,
}: AcceptInviteFormProps) {
  const form = useForm<AcceptInviteRequest>({
    resolver: zodResolver(acceptInviteRequestSchema),
    defaultValues: { token, password: '', name: '' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({ ...values, token });
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  return (
    <View className="w-full max-w-md flex-col gap-4">
      {serverError ? <AuthError error={serverError} /> : null}

      <View className="flex-col gap-2 rounded-md border border-border bg-surface p-4">
        <Text className="text-sm text-fg">
          You're joining <Text className="font-semibold">{lookup.tenantName}</Text> as a{' '}
          <Text className="font-semibold">{lookup.role}</Text>.
        </Text>
        <Text className="text-xs text-fg-muted">
          Invited by {lookup.inviterName} · {lookup.email}
        </Text>
      </View>

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Your name</Text>
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <TextInput
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              accessibilityLabel="Your name"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          )}
        />
        {form.formState.errors.name ? (
          <Text accessibilityRole="alert" className="text-xs text-fg">
            {form.formState.errors.name.message}
          </Text>
        ) : null}
      </View>

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Password</Text>
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => (
            <TextInput
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
              accessibilityLabel="Password"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          )}
        />
        <Text className="text-xs text-fg-muted">Minimum 12 characters.</Text>
        {form.formState.errors.password ? (
          <Text accessibilityRole="alert" className="text-xs text-fg">
            {form.formState.errors.password.message}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        onPress={handleSubmit}
        testID="accept-invite-submit"
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? <ActivityIndicator color="#000" /> : null}
        <Text className="text-sm font-medium text-bg">
          {submitting ? 'Joining…' : `Join ${lookup.tenantName}`}
        </Text>
      </Pressable>
    </View>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<AcceptInviteRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<AcceptInviteRequest>, message);
    }
  }
}
