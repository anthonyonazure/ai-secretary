import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_LAUNCH_STORAGE_KEY_FOR_TEST,
  useFirstLaunchStore,
} from '../../../hooks/first-launch-store';
import { ThumbsPrompt } from './thumbs-prompt';

afterEach(() => {
  useFirstLaunchStore.getState().reset();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FIRST_LAUNCH_STORAGE_KEY_FOR_TEST);
  }
});

const mount = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('ThumbsPrompt', () => {
  it('renders thumbs up + thumbs down buttons', () => {
    mount(<ThumbsPrompt meetingId="m1" fetchImpl={vi.fn()} />);
    expect(screen.getByTestId('thumbs-prompt-up')).toBeInTheDocument();
    expect(screen.getByTestId('thumbs-prompt-down')).toBeInTheDocument();
  });

  it('records the thumbs response in the store + POSTs to /feedback/thumbs', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'feedback-1',
            meetingId: 'm1',
            response: 'up',
            context: 'first-three',
            createdAt: new Date().toISOString(),
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    mount(<ThumbsPrompt meetingId="m1" fetchImpl={fetchImpl as unknown as typeof fetch} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('thumbs-prompt-up'));

    await waitFor(() => {
      expect(screen.getByTestId('thumbs-prompt-submitted')).toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls[0] as [unknown, RequestInit] | undefined;
    expect(firstCall).toBeDefined();
    const init = firstCall ? firstCall[1] : undefined;
    expect(init).toBeDefined();
    expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({
      meetingId: 'm1',
      response: 'up',
      context: 'first-three',
    });
    expect(useFirstLaunchStore.getState().thumbsResponses.m1).toBe('up');
  });

  it('treats a 409 response as success (already recorded)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ title: 'Conflict' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    mount(<ThumbsPrompt meetingId="m1" fetchImpl={fetchImpl as unknown as typeof fetch} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('thumbs-prompt-down'));

    await waitFor(() => {
      expect(screen.getByTestId('thumbs-prompt-submitted')).toBeInTheDocument();
    });
  });

  it('shows error state on network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    mount(<ThumbsPrompt meetingId="m1" fetchImpl={fetchImpl as unknown as typeof fetch} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('thumbs-prompt-up'));

    await waitFor(() => {
      expect(screen.getByText(/Couldn’t save your feedback/i)).toBeInTheDocument();
    });
  });

  it('shows the submitted state immediately when the user already responded', () => {
    useFirstLaunchStore.getState().recordThumbs('m1', 'up');
    mount(<ThumbsPrompt meetingId="m1" fetchImpl={vi.fn()} />);
    expect(screen.getByTestId('thumbs-prompt-submitted')).toBeInTheDocument();
    expect(screen.queryByTestId('thumbs-prompt-up')).not.toBeInTheDocument();
  });
});
