/**
 * Story 1.5d — admin invite-create form (mobile).
 *
 * Mirrors the web form's wire contract (zod resolver +
 * react-hook-form). The role picker is rendered as three Pressables
 * to avoid pulling in an extra picker dep, matching the SignupForm
 * region picker pattern.
 */

import {
  type CreateInviteRequest,
  createInviteRequestSchema,
} from '@aisecretary/shared/schemas/invites';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, type Path, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AuthFetchError } from '../../lib/auth/auth-fetch';
import { AuthError } from '../auth/auth-error';

export interface InviteCreateFormProps {
  onSubmit: (values: CreateInviteRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<CreateInviteRequest>> = ['email', 'role', 'ttlDays'];

export function InviteCreateForm({ onSubmit, serverError, isSubmitting }: InviteCreateFormProps) {
  const form = useForm<CreateInviteRequest>({
    resolver: zodResolver(createInviteRequestSchema),
    defaultValues: { email: '', role: 'org_member' },
    mode: 'onBlur',
  });
  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset({ email: '', role: 'org_member' });
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  return (
    <View className="w-full flex-col gap-4 rounded-md border border-border bg-surface p-4">
      {serverError ? <AuthError error={serverError} /> : null}

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Email</Text>
        <Controller
          control={form.control}
          name="email"
          render={({ field }) => (
            <TextInput
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          )}
        />
        {form.formState.errors.email ? (
          <Text accessibilityRole="alert" className="text-xs text-fg">
            {form.formState.errors.email.message}
          </Text>
        ) : null}
      </View>

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">Role</Text>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <View className="flex-row gap-2">
              {(['org_admin', 'org_member', 'org_viewer'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: field.value === value }}
                  onPress={() => field.onChange(value)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-md border px-3 ${
                    field.value === value ? 'border-accent bg-accent-soft' : 'border-border bg-bg'
                  }`}
                >
                  <Text className="text-sm text-fg">
                    {value === 'org_admin' ? 'Admin' : value === 'org_member' ? 'Member' : 'Viewer'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        onPress={handleSubmit}
        testID="invite-create-submit"
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? <ActivityIndicator color="#000" /> : null}
        <Text className="text-sm font-medium text-bg">
          {submitting ? 'Sending invite…' : 'Send invite'}
        </Text>
      </Pressable>
    </View>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<CreateInviteRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<CreateInviteRequest>, message);
    }
  }
}
