/**
 * `<BotStatusBadge />` — meeting-detail bot session indicator.
 *
 * Driven by the wire status of the primary `bot_sessions` row for a
 * meeting. Tone classes mirror `RecordingStatusPill`:
 *   live      — animated pulse
 *   progress  — neutral "joining" affordance
 *   success   — calm finished state
 *   error     — error state with surfaced reason
 */

import {
  type BotSessionResponse,
  deriveBotSessionDisplay,
  formatBotSessionTitle,
} from '@aisecretary/shared';

const TONE_CLASSES: Record<ReturnType<typeof deriveBotSessionDisplay>['tone'], string> = {
  idle: 'bg-surface text-fg-muted border border-border',
  progress: 'bg-accent-soft text-fg border border-accent',
  live: 'bg-accent text-bg border border-accent',
  success: 'bg-surface text-fg-muted border border-border',
  error: 'bg-bg text-fg border border-fg',
};

export interface BotStatusBadgeProps {
  session: BotSessionResponse;
}

export function BotStatusBadge({ session }: BotStatusBadgeProps) {
  const display = deriveBotSessionDisplay(session.status);
  const title = formatBotSessionTitle(session.source, session.status);
  const isLive = session.status === 'joined';
  return (
    <output
      aria-live="polite"
      aria-label={title}
      data-testid="bot-status-badge"
      data-status={session.status}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${TONE_CLASSES[display.tone]}`}
    >
      {isLive ? (
        <span
          aria-hidden="true"
          className="inline-block size-2 animate-pulse rounded-full bg-bg motion-reduce:animate-none"
        />
      ) : null}
      <span>{title}</span>
      {session.status === 'failed' && session.failureReason ? (
        <span className="text-fg-muted">— {session.failureReason}</span>
      ) : null}
    </output>
  );
}
