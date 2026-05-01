import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFirstLaunchStore } from '../../../hooks/first-launch-store';
import { FirstReceiptPolish } from './first-receipt-polish';

interface HarnessArgs {
  meetingId: string;
  reducedMotion?: boolean;
  /** Number of receipts already viewed before this story mounts. */
  receiptsViewed?: 0 | 1 | 2 | 3 | 4;
}

function Harness({ meetingId, reducedMotion, receiptsViewed = 0 }: HarnessArgs) {
  // Seed the store so we can simulate "this is the user's Nth receipt".
  // The persist middleware bleeds across stories — reset on mount.
  useEffect(() => {
    useFirstLaunchStore.getState().reset();
    for (let i = 0; i < receiptsViewed; i += 1) {
      useFirstLaunchStore.getState().markReceiptViewed(`__seed_${i}`);
    }
    return () => useFirstLaunchStore.getState().reset();
  }, [receiptsViewed]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ padding: '2rem', maxWidth: 640 }}>
        <FirstReceiptPolish
          meetingId={meetingId}
          {...(reducedMotion !== undefined ? { reducedMotion } : {})}
        >
          <article
            style={{
              border: '1px solid var(--border, #d4d4d4)',
              borderRadius: 12,
              padding: '1.5rem',
              background: 'var(--bg-elevated, #fff)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Quick read</h2>
            <p>
              Stand-in AnalysisCard content — production wiring lives in
              `apps/web/src/components/feature/analysis/analysis-card.tsx`.
            </p>
          </article>
        </FirstReceiptPolish>
      </div>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Feature/Onboarding/FirstReceiptPolish',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Story 1.7 — wraps the first three meeting receipts with celebration animation + thumbs prompt. The 4th receipt onward dials back to a calm default. Reduced-motion fallback drops the scale-in fade and renders a subtle highlight ring.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const FirstReceipt: Story = {
  args: { meetingId: 'm1', receiptsViewed: 0 },
};

export const SecondReceipt: Story = {
  args: { meetingId: 'm2', receiptsViewed: 1 },
};

export const ThirdReceipt: Story = {
  args: { meetingId: 'm3', receiptsViewed: 2 },
};

export const FourthReceiptCalm: Story = {
  args: { meetingId: 'm4', receiptsViewed: 3 },
  parameters: {
    docs: {
      description: {
        story:
          'After the third receipt the polish dials back — no celebration, no thumbs prompt. The component still mounts so the meeting-detail surface stays stable.',
      },
    },
  },
};

export const ReducedMotion: Story = {
  args: { meetingId: 'm1', receiptsViewed: 0, reducedMotion: true },
};
