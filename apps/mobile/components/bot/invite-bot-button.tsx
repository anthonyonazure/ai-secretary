import type { BotSourceWire } from '@aisecretary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useAuthStore } from '../../hooks/use-auth';
import { createBotSession } from '../../lib/bot-sessions/api-client';

export interface InviteBotButtonProps {
  meetingId: string;
}

export function InviteBotButton({ meetingId }: InviteBotButtonProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<BotSourceWire>('zoom_bot');
  const [externalMeetingId, setExternalMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return await createBotSession(accessToken, {
        source,
        externalMeetingId: externalMeetingId.trim(),
        ...(passcode.trim() ? { externalMeetingPasscode: passcode.trim() } : {}),
        meetingId,
      });
    },
    onSuccess: () => {
      setExternalMeetingId('');
      setPasscode('');
      setOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ['bot-sessions-for-meeting', meetingId],
      });
    },
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to invite bot.');
    },
  });

  const handleSubmit = () => {
    setErrorMessage(null);
    if (externalMeetingId.trim().length === 0) {
      setErrorMessage('Enter the meeting ID or join URL.');
      return;
    }
    mutation.mutate();
  };

  if (!open) {
    return (
      <Pressable
        testID="invite-bot-cta"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="self-start rounded-md border border-border bg-surface px-3 py-1.5"
      >
        <Text className="text-sm font-medium text-fg">Invite bot</Text>
      </Pressable>
    );
  }

  return (
    <View
      testID="invite-bot-form"
      className="self-stretch rounded-md border border-border bg-surface p-3"
    >
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="w-20 text-xs text-fg-muted">Provider</Text>
        <View className="flex-row gap-2">
          {(['zoom_bot', 'teams_bot'] as const).map((s) => {
            const active = s === source;
            return (
              <Pressable
                key={s}
                onPress={() => setSource(s)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`invite-bot-source-${s}`}
                className={`rounded-md border px-2 py-1 ${
                  active ? 'border-accent bg-accent-soft' : 'border-border bg-bg'
                }`}
              >
                <Text className={`text-xs ${active ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
                  {s === 'zoom_bot' ? 'Zoom' : 'Teams'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="w-20 text-xs text-fg-muted">Meeting ID</Text>
        <TextInput
          testID="invite-bot-meeting-id"
          value={externalMeetingId}
          onChangeText={setExternalMeetingId}
          placeholder="123 456 7890 or join URL"
          className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
        />
      </View>
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="w-20 text-xs text-fg-muted">Passcode</Text>
        <TextInput
          testID="invite-bot-passcode"
          value={passcode}
          onChangeText={setPasscode}
          placeholder="Optional"
          secureTextEntry
          className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
        />
      </View>
      {errorMessage ? (
        <Text testID="invite-bot-error" accessibilityRole="alert" className="mb-2 text-sm text-fg">
          {errorMessage}
        </Text>
      ) : null}
      <View className="mt-1 flex-row gap-2">
        <Pressable
          testID="invite-bot-submit"
          onPress={handleSubmit}
          disabled={mutation.isPending}
          accessibilityRole="button"
          className="rounded-md bg-accent px-3 py-1.5"
        >
          <Text className="text-sm font-medium text-bg">
            {mutation.isPending ? 'Inviting…' : 'Invite bot'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setOpen(false);
            setErrorMessage(null);
          }}
          accessibilityRole="button"
          className="rounded-md border border-border bg-bg px-3 py-1.5"
        >
          <Text className="text-sm font-medium text-fg">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
