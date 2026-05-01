import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AnalysisState, CitationRef } from '@aisecretary/shared';

import { AnalysisCard } from './analysis-card';

// AnalysisCard renders `CitationChip` V2; clicking a chip opens an
// embedded `TranscriptSeekPlayer` that depends on React Query. The
// preview-level decorator stack does not yet provide a QueryClient,
// so each module-level decorator does its own.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof AnalysisCard> = {
  title: 'Feature/Analysis/AnalysisCard',
  component: AnalysisCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Single shell that renders all 8 vertical analysis modules. Module-specific content lives in `ModuleOutput` (discriminated union from `@aisecretary/shared`); the shell, density, confidence chip, and action row are uniform across modules. Locked before module #1 ships per UX U2 / Story 3.4.',
      },
    },
  },
  argTypes: {
    module: {
      control: { type: 'select' },
      options: ['general', 'sales', 'hr', 'education', 'medical', 'support', 'pm', 'psychology'],
    },
    variant: { control: { type: 'radio' }, options: ['inline', 'standalone', 'email'] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AnalysisCard>;

const exampleCitation = (turnId: string, startMs: number, speaker?: string): CitationRef => ({
  meetingId: '00000000-0000-0000-0000-00000000aaaa',
  turnId,
  spanStartMs: startMs,
  spanEndMs: startMs + 4_000,
  speaker,
});

const generalReady = (): AnalysisState => ({
  kind: 'ready',
  output: {
    module: 'general',
    title: 'Quick read',
    summary:
      'A 22-minute conversation focused on Q3 onboarding cadence and a follow-up about the Slack export issue.',
    bullets: [
      {
        claim: 'Three decisions were made; two need follow-up by Friday.',
        citations: [exampleCitation('t-12', 184_000, 'Dana')],
      },
      {
        claim: 'Recurring topic: customers are asking about EU data residency.',
        citations: [exampleCitation('t-37', 612_000, 'Sam'), exampleCitation('t-39', 645_000)],
      },
    ],
  },
});

const overrideReady = (): AnalysisState => ({
  kind: 'override',
  fromModule: 'sales',
  output: {
    module: 'general',
    title: 'Quick read',
    summary:
      'Vertical was switched from Sales after the user noticed this was an internal sync, not a customer call.',
    bullets: [{ claim: 'Three decisions were made; two need follow-up by Friday.', citations: [] }],
  },
});

export const General: Story = {
  args: { module: 'general', state: generalReady() },
};

export const Sales: Story = {
  args: {
    module: 'sales',
    state: {
      kind: 'ready',
      output: {
        module: 'sales',
        title: 'Acme Corp — discovery call',
        summary:
          'Champion confirmed; budget signal landed; next step is a security review with IT.',
        bullets: [
          {
            claim: 'Champion confirmed she has budget authority through Q4.',
            citations: [exampleCitation('t-08', 92_000, 'Priya')],
          },
        ],
        talkRatio: { self: 0.42, counterpart: 0.58 },
        objections: [
          {
            claim: 'Procurement requires a SOC2 Type II report before signing.',
            citations: [exampleCitation('t-21', 411_000, 'Jordan')],
          },
        ],
        nextSteps: [
          {
            claim: 'Send security pack + schedule infosec review for next Tuesday.',
            citations: [],
          },
        ],
        dealRisk: 'medium',
      },
    },
  },
};

export const Medical: Story = {
  args: {
    module: 'medical',
    state: {
      kind: 'ready',
      output: {
        module: 'medical',
        title: 'Initial intake — 28F',
        summary:
          'Patient presents with two-week history of fatigue and intermittent palpitations; PHQ-9 administered.',
        bullets: [],
        soap: {
          subjective:
            'Patient reports two weeks of fatigue, occasional palpitations, no chest pain. Sleep 5–6h, increased caffeine intake.',
          objective: 'BP 124/78 · HR 88 · BMI 23.4 · PHQ-9 score 12.',
          assessment: 'Likely caffeine-related palpitations; mild-to-moderate depressive symptoms.',
          plan: 'Reduce caffeine, sleep-hygiene plan, referral to therapy. Follow-up in 4 weeks.',
        },
        riskFlags: [
          {
            claim: 'PHQ-9 of 12 — flag for follow-up suicidality assessment.',
            citations: [exampleCitation('t-44', 1_120_000)],
          },
        ],
      },
    },
  },
};

export const PM: Story = {
  args: {
    module: 'pm',
    state: {
      kind: 'ready',
      output: {
        module: 'pm',
        title: 'Roadmap sync — week 18',
        summary:
          'Three decisions, six action items, two new risks logged. Capture-loop ships ahead of schedule.',
        bullets: [],
        decisions: [
          {
            claim: 'Phase 0 component sequence locked: pill → card → chip.',
            citations: [exampleCitation('t-04', 41_000)],
          },
        ],
        actionItems: [
          {
            claim: 'Wire Storybook contrast addon by Tuesday — Dana.',
            citations: [exampleCitation('t-15', 224_000, 'Dana')],
          },
        ],
        risks: [
          {
            claim: 'Token build artifact size may inflate on low-end Android.',
            citations: [],
          },
        ],
      },
    },
  },
};

export const HR: Story = {
  args: {
    module: 'hr',
    state: {
      kind: 'ready',
      output: {
        module: 'hr',
        title: 'Senior IC review — Eng',
        summary:
          'Strong delivery against scope; collaboration solid; growth area in cross-team architecture review.',
        bullets: [],
        competencies: [
          { claim: 'Delivery: meets scope on every milestone (4/5).', citations: [] },
          { claim: 'Mentorship: actively coaches two juniors (5/5).', citations: [] },
        ],
      },
    },
  },
};

export const Education: Story = {
  args: {
    module: 'education',
    state: {
      kind: 'ready',
      output: {
        module: 'education',
        title: 'Calculus II · Section 4 · Lecture 12',
        summary: 'Coverage on Taylor series complete; engagement steady; one objective lagged.',
        bullets: [],
        engagement: [{ claim: '14 of 21 students asked at least one question.', citations: [] }],
        objectiveCoverage: [
          {
            claim: '"Apply convergence tests" only briefly addressed — schedule review session.',
            citations: [],
          },
        ],
      },
    },
  },
};

export const Support: Story = {
  args: {
    module: 'support',
    state: {
      kind: 'ready',
      output: {
        module: 'support',
        title: 'Ticket #88412 — Sync failure',
        summary:
          'Customer reproduced the issue on a fresh tenant; logs point to the new pg-boss queue config.',
        bullets: [],
        resolutionStatus: 'escalated',
        escalationFlags: [
          { claim: 'Customer mentioned cancellation timeline; route to CSM.', citations: [] },
        ],
      },
    },
  },
};

export const Psychology: Story = {
  args: {
    module: 'psychology',
    state: {
      kind: 'ready',
      output: {
        module: 'psychology',
        title: 'Session 14',
        summary:
          'Continued exploration of attachment patterns surfaced last session; client engaged and reflective.',
        bullets: [],
        sessionThemes: [
          {
            claim:
              'Anxiety surfaced around upcoming family visit — client linked it to childhood pattern.',
            citations: [exampleCitation('t-09', 142_000)],
          },
        ],
        therapeuticAlliance: 'developing',
      },
    },
  },
};

export const Streaming: Story = {
  args: {
    module: 'general',
    state: { kind: 'streaming', stageLabel: 'Summarizing receipt…' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Skeleton + stage label while the worker streams; ARIA `aria-busy="true"`.',
      },
    },
  },
};

export const LowConfidence: Story = {
  args: {
    module: 'sales',
    state: {
      kind: 'low-confidence',
      output: {
        module: 'sales',
        title: 'Acme Corp — discovery call',
        summary: 'Audio quality was poor — analysis confidence is low.',
        bullets: [],
        objections: [],
        nextSteps: [],
      },
    },
  },
};

export const Override: Story = {
  args: { module: 'general', state: overrideReady() },
  parameters: {
    docs: {
      description: {
        story:
          'User clicked "Switch vertical" — render swaps to the new module + an audit-logged notice. Previous output is preserved server-side.',
      },
    },
  },
};

export const Failed: Story = {
  args: {
    module: 'general',
    state: {
      kind: 'failed',
      reason: "We couldn't analyze this meeting. The transcription succeeded; analysis didn't.",
      retryable: true,
    },
  },
};

export const Standalone: Story = {
  args: {
    module: 'general',
    variant: 'standalone',
    state: generalReady(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Standalone variant — used on the share-token page; centered with stronger shadow.',
      },
    },
  },
};

export const Email: Story = {
  args: {
    module: 'general',
    variant: 'email',
    state: generalReady(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Email variant — limited rendering for digest contexts. No action row, no shadow, monochrome citations.',
      },
    },
  },
};

export const RelaxedDensity: Story = {
  args: { module: 'general', state: generalReady() },
  decorators: [
    (Story) => (
      <div className="density-relaxed">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Medical / psychology default to relaxed density — body copy breathes more, line-height eases. The host applies `.density-relaxed`; the card consumes whatever density the parent has set.',
      },
    },
  },
};

export const DarkTheme: Story = {
  args: { module: 'general', state: generalReady() },
  decorators: [
    (Story) => (
      <div className="theme-dark bg-bg p-6">
        <Story />
      </div>
    ),
  ],
};
