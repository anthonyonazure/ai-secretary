import {
  type BotSessionResponse,
  deriveBotSessionDisplay,
  formatBotSessionTitle,
} from '@aisecretary/shared';
import { Text, View } from 'react-native';

const TONE_CLASSES: Record<ReturnType<typeof deriveBotSessionDisplay>['tone'], string> = {
  idle: 'bg-surface border border-border',
  progress: 'bg-accent-soft border border-accent',
  live: 'bg-accent border border-accent',
  success: 'bg-surface border border-border',
  error: 'bg-bg border border-fg',
};

const TEXT_TONE: Record<ReturnType<typeof deriveBotSessionDisplay>['tone'], string> = {
  idle: 'text-fg-muted',
  progress: 'text-fg',
  live: 'text-bg',
  success: 'text-fg-muted',
  error: 'text-fg',
};

export interface BotStatusBadgeProps {
  session: BotSessionResponse;
}

export function BotStatusBadge({ session }: BotStatusBadgeProps) {
  const display = deriveBotSessionDisplay(session.status);
  const title = formatBotSessionTitle(session.source, session.status);
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={title}
      testID="bot-status-badge"
      className={`flex-row items-center self-start rounded-full px-3 py-1 ${TONE_CLASSES[display.tone]}`}
    >
      <Text className={`text-xs font-medium ${TEXT_TONE[display.tone]}`}>{title}</Text>
      {session.status === 'failed' && session.failureReason ? (
        <Text className={`ml-2 text-xs ${TEXT_TONE[display.tone]}`}>— {session.failureReason}</Text>
      ) : null}
    </View>
  );
}
