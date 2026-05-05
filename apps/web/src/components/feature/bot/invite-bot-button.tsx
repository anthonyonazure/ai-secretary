/**
 * `<InviteBotButton />` — surfaces the "invite a Zoom/Teams bot" CTA on
 * the meeting-detail page when no active bot session exists.
 *
 * UX:
 *   1. Click → expand into a small inline form (source picker +
 *      external meeting id + optional passcode).
 *   2. Submit → POST /api/v1/bot-sessions, invalidate the
 *      `bot-sessions-for-meeting` query so the badge appears.
 *   3. Server validation errors surface inline; rate-limit/RFC7807
 *      payloads decode via the existing fetch error.
 *
 * The component never reads the passcode after submission — the field
 * is write-only on the API too.
 */

import type { BotSourceWire } from '@aisecretary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuthStore } from '../../../hooks/use-auth';
import { createBotSession } from '../../../lib/bot-sessions/api-client';

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (externalMeetingId.trim().length === 0) {
      setErrorMessage('Enter the meeting ID or join URL.');
      return;
    }
    mutation.mutate();
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid="invite-bot-cta"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg hover:bg-accent-soft"
      >
        Invite bot
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="invite-bot-form"
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm"
    >
      <label className="flex items-center gap-2 text-fg">
        <span className="w-20 text-fg-muted">Provider</span>
        <select
          data-testid="invite-bot-source"
          value={source}
          onChange={(e) => setSource(e.target.value as BotSourceWire)}
          className="rounded-md border border-border bg-bg px-2 py-1"
        >
          <option value="zoom_bot">Zoom</option>
          <option value="teams_bot">Microsoft Teams</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-fg">
        <span className="w-20 text-fg-muted">Meeting ID</span>
        <input
          type="text"
          required
          data-testid="invite-bot-meeting-id"
          value={externalMeetingId}
          onChange={(e) => setExternalMeetingId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-2 py-1"
          placeholder="123 456 7890 or join URL"
        />
      </label>
      <label className="flex items-center gap-2 text-fg">
        <span className="w-20 text-fg-muted">Passcode</span>
        <input
          type="password"
          autoComplete="off"
          data-testid="invite-bot-passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-2 py-1"
          placeholder="Optional"
        />
      </label>
      {errorMessage ? (
        <p role="alert" data-testid="invite-bot-error" className="text-fg">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          data-testid="invite-bot-submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-50"
        >
          {mutation.isPending ? 'Inviting…' : 'Invite bot'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErrorMessage(null);
          }}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm font-medium text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
