import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SignupForm } from '../../components/auth/signup-form';
import { useAuth } from '../../hooks/use-auth';
import { useT } from '../../lib/i18n/use-t';

export default function SignupScreen() {
  const { signup } = useAuth();
  const { t } = useT();
  const [serverError, setServerError] = useState<unknown>(null);

  return (
    <ScrollView contentContainerClassName="min-h-full bg-bg" keyboardShouldPersistTaps="handled">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-md flex-col gap-6">
          <View className="flex-col gap-2">
            <Text className="text-2xl font-semibold text-fg">{t('auth.signup.heading')}</Text>
            <Text className="text-sm text-fg-muted">{t('auth.signup.subheading')}</Text>
          </View>
          <SignupForm
            onSubmit={async (values) => {
              setServerError(null);
              try {
                await signup(values);
                router.replace('/');
              } catch (err) {
                setServerError(err);
                throw err;
              }
            }}
            serverError={serverError}
            onSwitchToLogin={() => router.replace('/auth/login')}
          />
        </View>
      </View>
    </ScrollView>
  );
}
