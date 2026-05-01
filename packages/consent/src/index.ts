/**
 * @aisecretary/consent — region detection + consent orchestration +
 * server-side consent gate.
 *
 * See README.md for the future Fastify-plugin wiring path
 * (Story 1.4 follow-up).
 */

export const PACKAGE_NAME = '@aisecretary/consent';

export type {
  ConsentLegalBasis,
  ConsentParticipantInput,
  ConsentPolicy,
  ConsentRecord,
  ConsentShape,
  ConsentSurface,
  DisclosureCopy,
  MeetingSource,
  ParticipantRegion,
} from './types.js';

export {
  consentLegalBasisSchema,
  consentParticipantInputSchema,
  consentPolicySchema,
  consentRecordSchema,
  consentShapeSchema,
  meetingSourceSchema,
  participantRegionSchema,
} from './schemas.js';

export { detectParticipantRegion } from './region-detect.js';
export { resolveConsentLegalBasis } from './policy-resolver.js';
export { ConsentOrchestrator, surfacesFor } from './orchestrator.js';
export { consentCheck, type ConsentCheckResult } from './server-check.js';
export { getDisclosureCopy } from './disclosure-templates.js';
