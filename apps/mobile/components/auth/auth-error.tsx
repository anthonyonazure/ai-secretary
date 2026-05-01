/**
 * Mobile counterpart to the web AuthError banner. Renders RFC 7807
 * problem details (title + detail + requestId) inside a styled View.
 */

import { Text, View } from 'react-native';
import { AuthFetchError } from '../../lib/auth/auth-fetch';

export interface AuthErrorProps {
  error: unknown;
  message?: string;
}

export function AuthError({ error, message }: AuthErrorProps) {
  if (!error && !message) return null;
  const text = message ?? deriveMessage(error);
  const requestId = error instanceof AuthFetchError ? error.problem.requestId : undefined;
  return (
    <View
      accessibilityRole="alert"
      testID="auth-error"
      className="rounded-md border border-border bg-surface p-3"
    >
      <Text className="text-sm font-medium text-fg">{text}</Text>
      {requestId ? (
        <Text className="mt-1 text-xs text-fg-muted">Reference: {requestId}</Text>
      ) : null}
    </View>
  );
}

function deriveMessage(error: unknown): string {
  if (error instanceof AuthFetchError) {
    return error.problem.detail ?? error.problem.title ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
