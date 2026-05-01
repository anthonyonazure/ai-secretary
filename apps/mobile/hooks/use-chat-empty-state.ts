/**
 * `useChatEmptyState` — pure helper for the mobile RAG chat screen
 * empty-state copy.
 *
 * Mirrors the four web empty-state shapes from Story 6.1:
 *   1. `confident` — full answer + citations land
 *   2. `low-confidence` — answer + "rank-chip" hints to consult
 *   3. `no-answer` — honest "I don't know" beats hallucination
 *   4. `off-topic` — query lies outside the corpus
 *
 * The screen renders the right copy + iconography per state.
 */

import type { ChatEmptyState } from '@aisecretary/shared';

export interface ChatEmptyStateCopy {
  /** Headline text. */
  headline: string;
  /** One-sentence body explaining the state. */
  body: string;
  /** Suggested next-step CTA copy. Empty string = no CTA. */
  cta: string;
  /** Visual emphasis level for the state badge. */
  emphasis: 'success' | 'warning' | 'muted';
}

export const chatEmptyStateCopy = (
  state: ChatEmptyState | 'pending',
  locale = 'en-US',
): ChatEmptyStateCopy => {
  const isFr = locale.toLowerCase().startsWith('fr');
  if (state === 'pending') {
    return {
      headline: isFr ? 'En cours…' : 'Working on it…',
      body: isFr ? 'Recherche dans votre corpus.' : 'Searching your corpus.',
      cta: '',
      emphasis: 'muted',
    };
  }
  if (state === 'confident') {
    return {
      headline: isFr ? 'Réponse trouvée' : 'Answer ready',
      body: isFr
        ? 'Toutes les citations renvoient à des transcriptions dans votre corpus.'
        : 'Every citation points back to a transcript span in your corpus.',
      cta: '',
      emphasis: 'success',
    };
  }
  if (state === 'low-confidence') {
    return {
      headline: isFr ? 'Réponse partielle' : 'Partial answer',
      body: isFr
        ? "Voici les meilleures correspondances trouvées — vérifiez les citations avant d'agir."
        : 'Here are the best matches we found — double-check the citations before acting on them.',
      cta: isFr ? 'Voir les sources' : 'See sources',
      emphasis: 'warning',
    };
  }
  if (state === 'no-answer') {
    return {
      headline: isFr ? 'Je ne sais pas' : "I don't know",
      body: isFr
        ? 'Aucune transcription dans votre corpus ne couvre cette question.'
        : 'Nothing in your corpus covers that. Better to say so than to guess.',
      cta: isFr ? 'Enregistrer une réunion' : 'Record a meeting',
      emphasis: 'muted',
    };
  }
  // 'off-topic'
  return {
    headline: isFr ? 'Hors sujet' : 'Off topic',
    body: isFr
      ? "Cette question n'a aucun rapport avec votre corpus AI Secretary."
      : 'That question is outside what AI Secretary covers — try rephrasing or recording related meetings first.',
    cta: '',
    emphasis: 'muted',
  };
};
