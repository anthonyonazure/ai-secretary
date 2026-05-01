/**
 * Story 1.5c — mobile MFA enrollment card.
 *
 * Uses `react-native-qrcode-svg` (already a dep from Story 4.3) to
 * render the otpauth URI as a QR code.
 */

import { type MfaConfirmRequest, mfaConfirmRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AuthError } from './auth-error';
import { MfaRecoveryCodesDisplay } from './mfa-recovery-codes-display';

export interface MfaEnrollmentCardProps {
  otpauthUri: string;
  secret: string;
  recoveryCodes: string[];
  onConfirm: (input: MfaConfirmRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

export function MfaEnrollmentCard({
  otpauthUri,
  secret,
  recoveryCodes,
  onConfirm,
  serverError,
  isSubmitting,
}: MfaEnrollmentCardProps) {
  const form = useForm<MfaConfirmRequest>({
    resolver: zodResolver(mfaConfirmRequestSchema),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });
  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onConfirm(values);
    } catch {
      // Server error rendered via prop.
    }
  });

  return (
    <View className="w-full max-w-2xl flex-col gap-6">
      <View>
        <Text className="text-xl font-semibold text-fg">Enable two-factor authentication</Text>
        <Text className="mt-1 text-sm text-fg-muted">
          Scan the QR with an authenticator app or enter the secret manually, then enter the 6-digit
          code below to confirm.
        </Text>
      </View>

      <View className="flex-col items-center gap-4 rounded-md border border-border bg-surface p-4">
        <View
          accessibilityLabel="MFA enrollment QR code"
          testID="mfa-enrollment-qr"
          className="rounded-md border border-border bg-bg p-3"
        >
          <QRCode value={otpauthUri} size={176} />
        </View>
        <View className="w-full flex-col gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Or enter manually
          </Text>
          <Text
            selectable
            testID="mfa-enrollment-secret"
            className="rounded-md bg-bg p-3 font-mono text-sm text-fg"
          >
            {secret}
          </Text>
        </View>
      </View>

      <MfaRecoveryCodesDisplay recoveryCodes={recoveryCodes} />

      <View className="flex-col gap-4">
        {serverError ? <AuthError error={serverError} /> : null}
        <View className="flex-col gap-1">
          <Text className="text-sm font-medium text-fg">6-digit code from your app</Text>
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="6-digit code"
                testID="mfa-confirm-code"
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
          testID="mfa-confirm-submit"
          className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 ${
            submitting ? 'opacity-60' : ''
          }`}
        >
          {submitting ? <ActivityIndicator color="#000" /> : null}
          <Text className="text-sm font-medium text-bg">
            {submitting ? 'Confirming…' : 'Confirm and enable'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
