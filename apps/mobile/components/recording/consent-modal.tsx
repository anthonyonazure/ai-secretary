/**
 * Story 4.3 — Pre-mic consent modal (consent shape A) for mobile.
 *
 * Replaces `consent-modal-stub.tsx`. RN Modal with iOS pageSheet
 * presentation + slide-from-bottom. Renders the same disclosure copy
 * as the web modal (sourced from `@aisecretary/consent`) and the EU
 * explicit-consent branch.
 */

import {
  type ConsentLegalBasis,
  type DisclosureCopy,
  getDisclosureCopy,
} from '@aisecretary/consent';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

export interface ConsentModalProps {
  open: boolean;
  legalBasis: ConsentLegalBasis;
  /** Org-configurable extra paragraph. */
  customDisclosure?: string;
  orgName?: string;
  locale?: string;
  onAcknowledge: () => void;
  onDecline: () => void;
}

export function ConsentModal({
  open,
  legalBasis,
  customDisclosure,
  orgName,
  locale,
  onAcknowledge,
  onDecline,
}: ConsentModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [euAffirmed, setEuAffirmed] = useState(false);

  const copy: DisclosureCopy = useMemo(
    () =>
      getDisclosureCopy({
        shape: 'A',
        legalBasis,
        ...(orgName !== undefined ? { orgName } : {}),
        ...(locale !== undefined ? { locale } : {}),
      }),
    [legalBasis, orgName, locale],
  );

  const requiresEuAffirmation = legalBasis === 'explicit-consent';
  const canSubmit = acknowledged && (!requiresEuAffirmation || euAffirmed);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onDecline}
    >
      <View
        accessibilityViewIsModal
        accessibilityRole="alert"
        accessibilityLabel={copy.title}
        className="flex-1 items-center justify-end bg-black/60"
      >
        <View className="w-full max-w-xl rounded-t-md border border-border bg-surface p-6">
          <Text className="text-lg font-semibold text-fg">{copy.title}</Text>

          <ScrollView className="mt-3 max-h-80">
            <View className="gap-3">
              {copy.bodyParagraphs.map((paragraph, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: copy paragraphs are stable per render
                <Text key={idx} className="text-sm text-fg leading-relaxed">
                  {paragraph}
                </Text>
              ))}
              {customDisclosure ? (
                <Text className="text-sm text-fg-muted leading-relaxed">{customDisclosure}</Text>
              ) : null}
              <Text className="text-sm text-fg-muted leading-relaxed">{copy.rightsLine}</Text>
              {copy.euExplicitNote ? (
                <View
                  testID="consent-modal-eu-note"
                  className="rounded-md border border-border bg-accent-soft/40 p-3"
                >
                  <Text className="text-sm text-fg leading-relaxed">{copy.euExplicitNote}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View className="mt-4 gap-3">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              testID="consent-modal-ack-checkbox"
              onPress={() => setAcknowledged((v) => !v)}
              className="flex-row items-start gap-3 min-h-11"
            >
              <View
                className={`mt-1 h-5 w-5 rounded-md border border-border ${
                  acknowledged ? 'bg-accent' : 'bg-bg'
                }`}
              />
              <Text className="flex-1 text-sm text-fg">
                I have read this disclosure and acknowledge the recording.
              </Text>
            </Pressable>
            {requiresEuAffirmation && copy.euExplicitCheckboxLabel ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: euAffirmed }}
                testID="consent-modal-eu-checkbox"
                onPress={() => setEuAffirmed((v) => !v)}
                className="flex-row items-start gap-3 min-h-11"
              >
                <View
                  className={`mt-1 h-5 w-5 rounded-md border border-border ${
                    euAffirmed ? 'bg-accent' : 'bg-bg'
                  }`}
                />
                <Text className="flex-1 text-sm text-fg">{copy.euExplicitCheckboxLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          <View className="mt-6 flex-row justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              testID="consent-modal-decline"
              onPress={onDecline}
              className="h-11 min-w-11 items-center justify-center rounded-md border border-border bg-bg px-4"
            >
              <Text className="text-sm text-fg">{copy.declineCta}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              testID="consent-modal-acknowledge"
              disabled={!canSubmit}
              onPress={onAcknowledge}
              className={`h-11 min-w-11 items-center justify-center rounded-md px-4 ${
                canSubmit ? 'bg-accent' : 'bg-accent/50'
              }`}
            >
              <Text className="text-sm font-medium text-bg">{copy.acknowledgeCta}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
