import type { MfaChallengeResponse, VerifyMfaRequest } from '@aisecretary/shared/schemas/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LoginForm } from '../../components/auth/login-form';
import { MfaChallengeForm } from '../../components/auth/mfa-challenge-form';
import { useAuth } from '../../hooks/use-auth';
import { useT } from '../../lib/i18n/use-t';

export default function LoginScreen() {
  const { login, verifyMfa } = useAuth();
  const { t } = useT();
  const [serverError, setServerError] = useState<unknown>(null);
  const [challenge, setChallenge] = useState<MfaChallengeResponse | null>(null);

  const heading = challenge ? t('auth.login.heading.mfa') : t('auth.login.heading');
  const subheading = challenge
    ? challenge.enrollmentRequired
      ? t('auth.login.subheading.mfa.enrollmentRequired')
      : t('auth.login.subheading.mfa')
    : t('auth.login.subheading');

  return (
    <ScrollView contentContainerClassName="min-h-full bg-bg" keyboardShouldPersistTaps="handled">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-md flex-col gap-6">
          <View className="flex-col gap-2">
            <Text className="text-2xl font-semibold text-fg">{heading}</Text>
            <Text className="text-sm text-fg-muted">{subheading}</Text>
          </View>
          {challenge ? (
            <MfaChallengeForm
              challengeToken={challenge.challengeToken}
              hideRecoveryToggle={challenge.enrollmentRequired}
              serverError={serverError}
              onSubmit={async (values: VerifyMfaRequest) => {
                setServerError(null);
                try {
                  if (challenge.enrollmentRequired) {
                    router.replace('/auth/settings/security');
                    return;
                  }
                  const response = await verifyMfa(values);
                  if (response.kind === 'session') {
                    router.replace('/');
                  }
                } catch (err) {
                  setServerError(err);
                  throw err;
                }
              }}
            />
          ) : (
            <LoginForm
              onSubmit={async (values) => {
                setServerError(null);
                try {
                  const response = await login(values);
                  if (response.kind === 'mfa-required') {
                    setChallenge(response);
                    return;
                  }
                  router.replace('/');
                } catch (err) {
                  setServerError(err);
                  throw err;
                }
              }}
              serverError={serverError}
              onSwitchToSignup={() => router.replace('/auth/signup')}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
