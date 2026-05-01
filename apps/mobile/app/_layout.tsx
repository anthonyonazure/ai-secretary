import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import '../app/global.css';
import { useAuth } from '../hooks/use-auth';
import { initI18n } from '../lib/i18n';
import { registerBackgroundUploadTask } from '../lib/recording/background-task';

// Story 4.2 — register the BACKGROUND_UPLOAD TaskManager task name at app
// boot so the resumable-upload pipeline can hand off when backgrounded.
// Story 4.5 fills in the body with the 10-min retry budget logic.
registerBackgroundUploadTask();

// Story 1.9 — initialize i18next (EN + FR) before the first render so
// any component using `useT()` resolves translations on mount. Locale
// is detected from `expo-localization`; resources are bundled.
initI18n();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

/*
 * Theme / density / motion mode classes per arch-addendums § Token
 * taxonomy. NativeWind treats className as a className-on-host pattern,
 * so the wrapper <View> applies the active mode classes to every
 * descendant. Real persisted preferences land with the settings epic.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <View className="theme-dark density-relaxed motion-default flex-1 bg-bg">
        <StatusBar style="light" />
        <AuthGate />
      </View>
    </QueryClientProvider>
  );
}

/**
 * Story 1.5a — Expo Router auth gate.
 *
 * While the auth state is hydrating from secure-store, we render a
 * spinner. Once hydrated, unauthenticated users not already on /auth/*
 * are bounced to /auth/login; everyone else gets the normal Stack.
 *
 * The recording flow at app/record.tsx is gated by this same check —
 * once Story 1.5a is real-wire, it requires a session.
 */
function AuthGate() {
  const auth = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === 'auth';

  if (!auth.isHydrated) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!auth.isAuthenticated && !inAuthGroup) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
