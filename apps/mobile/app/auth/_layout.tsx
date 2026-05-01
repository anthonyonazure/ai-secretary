import { Stack } from 'expo-router';

/**
 * Auth route group (Story 1.5a). Hidden header — each screen renders its
 * own headline. Story 1.5b/c/d will add OAuth, MFA, and accept-invite
 * screens to this same group.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
