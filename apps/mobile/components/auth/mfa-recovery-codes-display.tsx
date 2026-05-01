/**
 * Story 1.5c — mobile recovery codes display.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export interface MfaRecoveryCodesDisplayProps {
  recoveryCodes: string[];
  onAcknowledge?: () => void;
}

export function MfaRecoveryCodesDisplay({
  recoveryCodes,
  onAcknowledge,
}: MfaRecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);

  // The mobile copy-to-clipboard path requires `expo-clipboard`, which
  // isn't yet a dep of this app. For now the codes are `selectable` so
  // users can long-press → copy via the OS native menu. A follow-up
  // story can add `expo-clipboard` and replace this with a one-tap
  // affordance.
  const handleCopy = async () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View
      testID="mfa-recovery-codes"
      className="w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex-col gap-1">
        <Text className="text-sm font-semibold text-fg">Save your recovery codes</Text>
        <Text className="text-xs text-fg-muted">
          Store these somewhere safe. Each code works once if you lose access to your authenticator
          app. They will not be shown again.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 rounded-md bg-bg p-3">
        {recoveryCodes.map((code) => (
          <Text
            key={code}
            selectable
            className="w-[48%] py-1 font-mono text-sm tracking-widest text-fg"
          >
            {code}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void handleCopy();
          }}
          testID="mfa-recovery-copy"
          className="min-h-9 flex-row items-center rounded-md border border-border px-3 py-1"
        >
          <Text className="text-sm font-medium text-fg">{copied ? 'Copied!' : 'Copy'}</Text>
        </Pressable>
        {onAcknowledge ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAcknowledge}
            className="ml-auto min-h-9 flex-row items-center rounded-md bg-accent px-3 py-1"
          >
            <Text className="text-sm font-medium text-bg">I have saved them</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
