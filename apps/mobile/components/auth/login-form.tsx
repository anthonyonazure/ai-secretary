/**
 * Story 1.5a — mobile login form.
 *
 * Story 1.9 — user-facing strings routed through `useT`; keys live in
 * `apps/mobile/lib/i18n/locales/{en,fr}.json`.
 */

import { type LoginRequest, loginRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, type Path, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AuthFetchError } from '../../lib/auth/auth-fetch';
import { useT } from '../../lib/i18n/use-t';
import { AuthError } from './auth-error';

export interface LoginFormProps {
  onSubmit: (values: LoginRequest) => Promise<void>;
  serverError?: unknown;
  onSwitchToSignup?: () => void;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<LoginRequest>> = ['email', 'password'];

export function LoginForm({
  onSubmit,
  serverError,
  onSwitchToSignup,
  isSubmitting,
}: LoginFormProps) {
  const { t } = useT();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  const emailLabel = t('auth.login.email');
  const passwordLabel = t('auth.login.password');

  return (
    <View className="w-full max-w-md flex-col gap-4">
      {serverError ? <AuthError error={serverError} /> : null}

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">{emailLabel}</Text>
        <Controller
          control={form.control}
          name="email"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel={emailLabel}
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
        <Text className="text-sm font-medium text-fg">{passwordLabel}</Text>
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              accessibilityLabel={passwordLabel}
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          )}
        />
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
        testID="login-submit"
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? <ActivityIndicator color="#000" /> : null}
        <Text className="text-sm font-medium text-bg">
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Text>
      </Pressable>

      {onSwitchToSignup ? (
        <Pressable
          accessibilityRole="link"
          onPress={onSwitchToSignup}
          className="min-h-11 items-center justify-center"
        >
          <Text className="text-sm text-fg-muted">
            {t('auth.login.noAccount')}{' '}
            <Text className="text-accent">{t('auth.login.signUp')}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<LoginRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<LoginRequest>, message);
    }
  }
}
