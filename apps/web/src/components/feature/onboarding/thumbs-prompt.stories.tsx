import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFirstLaunchStore } from '../../../hooks/first-launch-store';
import { ThumbsPrompt } from './thumbs-prompt';

interface HarnessArgs {
  meetingId: string;
  alreadyResponded?: boolean;
  fetchDelayMs?: number;
  /** When set, the fetch impl rejects to surface the error state. */
  failNetwork?: boolean;
}

function Harness({ meetingId, alreadyResponded, fetchDelayMs, failNetwork }: HarnessArgs) {
  useEffect(() => {
    useFirstLaunchStore.getState().reset();
    if (alreadyResponded) {
      useFirstLaunchStore.getState().recordThumbs(meetingId, 'up');
    }
    return () => useFirstLaunchStore.getState().reset();
  }, [meetingId, alreadyResponded]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const fetchImpl: typeof fetch = async () => {
    if (failNetwork) throw new Error('network down (story sim)');
    if (fetchDelayMs) {
      await new Promise((r) => setTimeout(r, fetchDelayMs));
    }
    return new Response(
      JSON.stringify({
        id: 'feedback-1',
        meetingId,
        response: 'up',
        context: 'first-three',
        createdAt: new Date().toISOString(),
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ padding: '2rem', maxWidth: 480 }}>
        <ThumbsPrompt meetingId={meetingId} fetchImpl={fetchImpl} />
      </div>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Feature/Onboarding/ThumbsPrompt',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Story 1.7 — "Was this useful?" prompt for the first three receipts. Records the response in the local first-launch store and POSTs to /api/v1/feedback/thumbs.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {
  args: { meetingId: 'story-meeting' },
};

export const Submitting: Story = {
  args: { meetingId: 'story-submit', fetchDelayMs: 1500 },
  parameters: {
    docs: {
      description: {
        story: 'Click a button and observe the disabled state during the in-flight POST.',
      },
    },
  },
};

export const Submitted: Story = {
  args: { meetingId: 'story-submitted', alreadyResponded: true },
};

export const NetworkError: Story = {
  args: { meetingId: 'story-error', failNetwork: true },
  parameters: {
    docs: {
      description: {
        story:
          'Network failure surfaces an inline error message; the user can re-click without the prompt collapsing.',
      },
    },
  },
};
