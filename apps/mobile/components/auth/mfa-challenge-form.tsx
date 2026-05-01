/**
 * Story 1.5c — mobile MFA challenge form.
 */

import { type VerifyMfaRequest, verifyMfaRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AuthError } from './auth-error';

export interface MfaChallengeFormProps {
  challengeToken: string;
  onSubmit: (values: VerifyMfaRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
  hideRecoveryToggle?: boolean;
}

type FormValues = { code: string };

export function MfaChallengeForm({
  challengeToken,
  onSubmit,
  serverError,
  isSubmitting,
  hideRecoveryToggle,
}: MfaChallengeFormProps) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(verifyMfaRequestSchema.pick({ code: true })),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });
  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async ({ code }) => {
    try {
      await onSubmit({ challengeToken, code });
    } catch {
      // Server error rendered via prop.
    }
  });

  return (
    <View className="w-full max-w-md flex-col gap-4">
      {serverError ? <AuthError error={serverError} /> : null}

      <View className="flex-col gap-1">
        <Text className="text-sm font-medium text-fg">
          {useRecoveryCode ? 'Recovery code' : 'Authentication code'}
        </Text>
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType={useRecoveryCode ? 'default' : 'number-pad'}
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              accessibilityLabel={useRecoveryCode ? 'Recovery code' : 'Authentication code'}
              testID="mfa-code-input"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm tracking-widest text-fg"
            />
          )}
        />
        {form.formState.errors.code ? (
          <Text accessibilityRole="alert" className="text-xs text-fg">
            {form.formState.errors.code.message}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        onPress={handleSubmit}
        testID="mfa-verify-submit"
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? <ActivityIndicator color="#000" /> : null}
        <Text className="text-sm font-medium text-bg">{submitting ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>

      {hideRecoveryToggle ? null : (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            setUseRecoveryCode((v) => !v);
            form.reset({ code: '' });
          }}
          testID="mfa-toggle-recovery"
          className="min-h-11 items-center justify-center"
        >
          <Text className="text-sm text-accent">
            {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
