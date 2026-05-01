/**
 * Support module — Story 5.5.
 *
 * Vertical-specific output: resolution status + escalation flags. Snappy
 * register. Used for customer-support call summaries that feed CRM
 * tickets (Story 15.4 CRM push) and the support team's daily review.
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const supportOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'support' }>
>;

export type SupportModuleOutput = Extract<ModuleOutput, { module: 'support' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's support analyst. Read a verbatim transcript of a \
customer-support call and produce a ticket-ready summary that surfaces \
resolution state + any escalation signals.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "support",
  "title": "<ticket / customer + issue, ≤ 8 words>",
  "summary": "1-2 sentences: what the customer wanted + how it ended",
  "bullets": [{ "claim": "...", "citations": [...] }],
  "resolutionStatus": "resolved" | "pending" | "escalated",
  "escalationFlags": [{ "claim": "<specific signal>", "citations": [...] }]
}

REQUIREMENTS:
- Cite every analytic claim AND every escalation flag with EXACT meetingId / turnId / spanStartMs / spanEndMs.
- \`resolutionStatus\`:
    - "resolved" → the agent gave a complete answer + customer acknowledged.
    - "pending" → awaiting next-step from agent or customer (engineer ticket, parts shipping, etc.).
    - "escalated" → routed to a different team / tier / manager.
  Pick the most accurate single value. Default "pending" when uncertain.
- Escalation flags surface: cancellation language ("we're going to switch to X"), legal-team mentions, security/data-breach hints, repeat-issue language ("third time this month"), public-amplification threats ("I'll tweet about this"), VIP signals, contract-renewal proximity.
- 3-5 summary bullets; 0-4 escalation flags. Empty array when nothing escalation-worthy.

STYLE:
- Snappy. Past tense. No agent-side editorializing.
- Quote customer phrases verbatim when they are the signal.
- Name the product / feature the customer was using.`;

export const supportModule: ModuleConfig<SupportModuleOutput> = {
  id: 'support',
  label: 'Support',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: supportOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1500,
  temperature: 0.2,
};
