/**
 * Mobile mirror of the web upload-retry-banner — Story 4.5.
 *
 * Three actions: retry now / upload manually / contact support. Mobile
 * uses `Linking.openURL` for the support mailto since RN doesn't have
 * a native <a href>.
 *
 * Touch targets are sized via NativeWind classes that match the web
 * 44px minimum. RN's `accessibilityRole="alert"` notifies VoiceOver +
 * TalkBack on mount, which (paired with the autoFocus on the primary
 * Pressable) gets the user back into the flow quickly.
 */

import { useEffect, useRef } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

export interface UploadRetryBannerProps {
  recordingId: string;
  lastErrorMessage?: string;
  onRetry: () => void;
  onUploadManually: () => void;
  supportEmail?: string;
  autoFocus?: boolean;
}

const DEFAULT_SUPPORT_EMAIL = 'support@aisecretary.app';

export function UploadRetryBanner({
  recordingId,
  lastErrorMessage,
  onRetry,
  onUploadManually,
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  autoFocus = true,
}: UploadRetryBannerProps) {
  const retryRef = useRef<{ focus?: () => void } | null>(null);

  useEffect(() => {
    if (autoFocus) retryRef.current?.focus?.();
  }, [autoFocus]);

  const onContactSupport = (): void => {
    const subject = `Upload failed for recording ${recordingId}`;
    const lines = [
      'Hi AI Secretary support,',
      '',
      `My upload for recording ${recordingId} did not finish after 10 minutes of retries.`,
      lastErrorMessage ? `Last error: ${lastErrorMessage}` : '',
      '',
      'Please advise on next steps. Thank you.',
    ].filter(Boolean);
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(lines.join('\n'))}`;
    void Linking.openURL(url).catch(() => {
      // Some devices have no email client; the caller can show a
      // toast with the address. Best-effort here.
    });
  };

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID="upload-retry-banner"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex flex-col gap-1">
        <Text className="font-sans text-sm font-medium text-fg">
          Your upload didn&apos;t finish.
        </Text>
        <Text className="font-sans text-sm text-fg-muted">
          We tried for 10 minutes. Your recording is still saved on this device — try again or pick
          another option.
        </Text>
      </View>
      <View className="flex flex-row flex-wrap gap-2">
        <Pressable
          ref={retryRef as never}
          accessibilityRole="button"
          accessibilityLabel="Retry now"
          onPress={onRetry}
          className="min-h-11 min-w-11 rounded-md bg-accent px-4 py-2"
        >
          <Text className="font-sans text-sm font-medium text-fg-on-accent">Retry now</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload manually"
          onPress={onUploadManually}
          className="min-h-11 min-w-11 rounded-md bg-bg px-4 py-2 ring-1 ring-border"
        >
          <Text className="font-sans text-sm font-medium text-fg">Upload manually</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Contact support"
          onPress={onContactSupport}
          className="min-h-11 min-w-11 rounded-md bg-bg px-4 py-2 ring-1 ring-border"
        >
          <Text className="font-sans text-sm font-medium text-fg">Contact support</Text>
        </Pressable>
      </View>
    </View>
  );
}
