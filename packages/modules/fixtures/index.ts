/**
 * Story 3.6 — citation-required eval fixtures.
 *
 * One canonical "good" `ModuleOutput` per vertical. The CI gate
 * (`scripts/check-citations.ts`) runs the citation auditor against this
 * list + fails on any analytic claim missing a citation.
 *
 * Adding a vertical = adding one fixture entry + matching the schema's
 * required slots. The audit map in `src/citation-audit.ts` is the
 * authoritative source for which slots need citations.
 *
 * Goldens stay realistic — the fixtures double as Storybook copy + as
 * documentation of the contract the LLM gateway must produce.
 */

import type { ModuleOutput } from '@aisecretary/shared';

const M = '00000000-0000-4000-8000-000000000001';
const cite = (turnId: string, startMs: number, speaker?: string) => ({
  meetingId: M,
  turnId,
  spanStartMs: startMs,
  spanEndMs: startMs + 5000,
  ...(speaker ? { speaker } : {}),
});

export const generalFixture: ModuleOutput = {
  module: 'general',
  title: 'Q3 planning sync',
  summary: 'Team aligned on Q3 OKRs and committed to a Friday review.',
  bullets: [
    {
      claim: 'Three decisions made; two need owner sign-off by Friday.',
      citations: [cite('t-12', 184_000, 'Dana')],
    },
    {
      claim: 'Customers asking about EU data residency — top recurring topic.',
      citations: [cite('t-37', 612_000, 'Sam'), cite('t-39', 645_000)],
    },
    {
      claim: 'Pricing page redesign blocked on legal review.',
      citations: [cite('t-44', 720_000)],
    },
  ],
};

export const salesFixture: ModuleOutput = {
  module: 'sales',
  title: 'Acme discovery call',
  summary: 'Champion confirmed budget; SOC 2 packet is the gate to sign.',
  bullets: [
    {
      claim: 'Champion has budget authority through Q4.',
      citations: [cite('t-08', 92_000, 'Priya')],
    },
  ],
  talkRatio: { self: 0.42, counterpart: 0.58 },
  objections: [
    {
      claim: 'Procurement requires SOC 2 Type II report before signing.',
      citations: [cite('t-21', 411_000, 'Jordan')],
    },
  ],
  nextSteps: [
    {
      claim: 'Send security pack + book infosec review for Tuesday.',
      citations: [cite('t-38', 689_000)],
    },
  ],
  dealRisk: 'medium',
};

export const hrFixture: ModuleOutput = {
  module: 'hr',
  title: 'Senior IC mid-cycle review',
  summary: 'Strong delivery; growth area in cross-team architecture review.',
  bullets: [
    {
      claim: 'Delivery: shipped Q3 OKR ahead of schedule.',
      citations: [cite('t-04', 41_000)],
    },
  ],
  competencies: [
    {
      claim: 'Mentorship: actively coaches two juniors on system design.',
      citations: [cite('t-15', 224_000, 'Manager')],
    },
    {
      claim: 'Cross-team collaboration: gap — repeated friction with platform team.',
      citations: [cite('t-21', 312_000)],
    },
  ],
};

export const educationFixture: ModuleOutput = {
  module: 'education',
  title: 'Calculus II · Lecture 12',
  summary: 'Taylor series fully covered; convergence-tests objective lagged.',
  bullets: [
    {
      claim: '14 of 21 students asked at least one question.',
      citations: [cite('t-04', 41_000)],
    },
  ],
  engagement: [
    {
      claim: 'High cross-talk during the breakout — engagement strong.',
      citations: [cite('t-22', 358_000)],
    },
  ],
  objectiveCoverage: [
    {
      claim: '"Apply convergence tests": partial — only one example covered.',
      citations: [cite('t-39', 712_000, 'Instructor')],
    },
  ],
};

export const medicalFixture: ModuleOutput = {
  module: 'medical',
  title: 'Initial intake — fatigue + palpitations',
  summary:
    'Two-week history; PHQ-9 score 12. Likely caffeine-related; flag follow-up suicidality assessment.',
  bullets: [
    {
      claim: 'PHQ-9 score 12 — moderate depressive symptoms.',
      citations: [cite('t-44', 1_120_000)],
    },
  ],
  soap: {
    subjective:
      'Patient reports two weeks of fatigue + occasional palpitations; no chest pain. Sleep 5–6h, increased caffeine intake.',
    objective: 'BP 124/78 · HR 88 · BMI 23.4 · PHQ-9 score 12.',
    assessment: 'Likely caffeine-related palpitations; mild-to-moderate depressive symptoms.',
    plan: 'Reduce caffeine; sleep-hygiene plan; therapy referral; follow-up in 4 weeks.',
  },
  riskFlags: [
    {
      claim: 'PHQ-9 of 12 — flag for follow-up suicidality assessment.',
      citations: [cite('t-44', 1_120_000)],
    },
  ],
};

export const supportFixture: ModuleOutput = {
  module: 'support',
  title: 'Ticket #88412 — sync failure',
  summary: 'Reproduced on a fresh tenant; pg-boss queue config implicated; escalated.',
  bullets: [
    {
      claim: 'Customer reproduced the issue on a fresh tenant within 5 minutes.',
      citations: [cite('t-12', 184_000)],
    },
  ],
  resolutionStatus: 'escalated',
  escalationFlags: [
    {
      claim: 'Customer mentioned cancellation timeline — route to CSM.',
      citations: [cite('t-37', 612_000, 'Customer')],
    },
  ],
};

export const pmFixture: ModuleOutput = {
  module: 'pm',
  title: 'Capture-loop roadmap sync',
  summary: 'Phase 0 component sequence locked; capture-loop ships ahead of schedule.',
  bullets: [
    {
      claim: 'Phase 0 ships next Tuesday with all four foundation pieces.',
      citations: [cite('t-04', 41_000)],
    },
  ],
  decisions: [
    {
      claim: 'Component sequence locked: pill → card → chip.',
      citations: [cite('t-04', 41_000)],
    },
  ],
  actionItems: [
    {
      claim: 'Wire Storybook contrast addon by Tuesday — Dana.',
      citations: [cite('t-15', 224_000, 'Dana')],
    },
  ],
  risks: [
    {
      claim: 'Token build artifact size may inflate on low-end Android.',
      citations: [cite('t-22', 358_000)],
    },
  ],
};

export const psychologyFixture: ModuleOutput = {
  module: 'psychology',
  title: 'Session 14',
  summary:
    'Continued attachment-pattern exploration; client engaged + reflective. Alliance developing.',
  bullets: [
    {
      claim: 'Client linked anxiety about family visit to childhood pattern.',
      citations: [cite('t-09', 142_000)],
    },
  ],
  sessionThemes: [
    {
      claim: 'Anxiety surfaced around upcoming family visit.',
      citations: [cite('t-09', 142_000)],
    },
  ],
  therapeuticAlliance: 'developing',
};

export const ALL_FIXTURES: ReadonlyArray<ModuleOutput> = [
  generalFixture,
  salesFixture,
  hrFixture,
  educationFixture,
  medicalFixture,
  supportFixture,
  pmFixture,
  psychologyFixture,
];
