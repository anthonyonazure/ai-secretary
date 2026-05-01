/**
 * Story 1.5a — mobile signup form.
 *
 * react-hook-form + zod resolver against `signupRequestSchema`. Renders
 * RN `<TextInput>` for fields and a manual region picker (two
 * Pressables) so we don't need an extra picker dep for the slice.
 *
 * Story 1.9 — user-facing strings routed through `useT`; keys live in
 * `apps/mobile/lib/i18n/locales/{en,fr}.json`.
 */

import {
  type Region,
  type SignupRequest,
  signupRequestSchema,
} from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, type Path, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AuthFetchError } from '../../lib/auth/auth-fetch';
import { useT } from '../../lib/i18n/use-t';
import { AuthError } from './auth-error';

export interface SignupFormProps {
  onSubmit: (values: SignupRequest) => Promise<void>;
  serverError?: unknown;
  onSwitchToLogin?: () => void;
  defaultRegion?: Region;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<SignupRequest>> = [
  'tenantName',
  'region',
  'email',
  'password',
  'name',
];

export function SignupForm({
  onSubmit,
  serverError,
  onSwitchToLogin,
  defaultRegion = 'us',
  isSubmitting,
}: SignupFormProps) {
  const { t } = useT();
  const form = useForm<SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    defaultValues: {
      tenantName: '',
      region: defaultRegion,
      email: '',
      password: '',
      name: '',
    },
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

  return (
    <View className="w-full max-w-md flex-col gap-4">
      {serverError ? <AuthError error={serverError} /> : null}

      <ControlledField
        name="name"
        label={t('auth.signup.name')}
        autoComplete="name"
        textContentType="name"
        control={form.control}
        error={form.formState.errors.name?.message}
      />

      <ControlledField
        name="tenantName"
        label={t('auth.signup.tenantName')}
        autoComplete="organization"
        control={form.control}
        error={form.formState.errors.tenantName?.message}
      />

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">{t('auth.signup.region')}</Text>
        <Controller
          control={form.control}
          name="region"
          render={({ field }) => (
            <View className="flex-row gap-2">
              <RegionOption
                label={t('auth.signup.region.us')}
                selected={field.value === 'us'}
                onPress={() => field.onChange('us')}
              />
              <RegionOption
                label={t('auth.signup.region.eu')}
                selected={field.value === 'eu'}
                onPress={() => field.onChange('eu')}
              />
            </View>
          )}
        />
        <Text className="text-xs text-fg-muted">{t('auth.signup.region.helper')}</Text>
      </View>

      <ControlledField
        name="email"
        label={t('auth.signup.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        control={form.control}
        error={form.formState.errors.email?.message}
      />

      <ControlledField
        name="password"
        label={t('auth.signup.password')}
        secureTextEntry
        autoComplete="password-new"
        textContentType="newPassword"
        helper={t('auth.signup.password.helper')}
        control={form.control}
        error={form.formState.errors.password?.message}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        onPress={handleSubmit}
        testID="signup-submit"
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? <ActivityIndicator color="#000" /> : null}
        <Text className="text-sm font-medium text-bg">
          {submitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </Text>
      </Pressable>

      {onSwitchToLogin ? (
        <Pressable
          accessibilityRole="link"
          onPress={onSwitchToLogin}
          className="min-h-11 items-center justify-center"
        >
          <Text className="text-sm text-fg-muted">
            {t('auth.signup.haveAccount')}{' '}
            <Text className="text-accent">{t('auth.signup.signIn')}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface ControlledFieldProps {
  name: Path<SignupRequest>;
  label: string;
  helper?: string;
  error?: string | undefined;
  control: ReturnType<typeof useForm<SignupRequest>>['control'];
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: string;
  textContentType?: string;
}

function ControlledField({
  name,
  label,
  helper,
  error,
  control,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
}: ControlledFieldProps) {
  return (
    <View className="flex-col gap-1">
      <Text className="text-sm font-medium text-fg">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            value={typeof field.value === 'string' ? field.value : ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            secureTextEntry={secureTextEntry}
            // biome-ignore lint/suspicious/noExplicitAny: RN type unions for these props are too narrow for our pass-through.
            keyboardType={keyboardType as any}
            // biome-ignore lint/suspicious/noExplicitAny: same as above.
            autoCapitalize={autoCapitalize as any}
            // biome-ignore lint/suspicious/noExplicitAny: same as above.
            autoComplete={autoComplete as any}
            // biome-ignore lint/suspicious/noExplicitAny: same as above.
            textContentType={textContentType as any}
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            accessibilityLabel={label}
            accessibilityState={{ disabled: false }}
          />
        )}
      />
      {helper && !error ? <Text className="text-xs text-fg-muted">{helper}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-xs text-fg">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function RegionOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 flex-1 items-center justify-center rounded-md border px-3 ${
        selected ? 'border-accent bg-accent-soft' : 'border-border bg-bg'
      }`}
    >
      <Text className="text-sm text-fg">{label}</Text>
    </Pressable>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<SignupRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<SignupRequest>, message);
    }
  }
}
