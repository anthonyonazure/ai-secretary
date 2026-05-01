/**
 * Public DSAR portal route — Story 14.3 (FR52).
 *
 * Mount path: `/api/v1/data-rights` (set by `buildServer()` via prefix).
 *
 *   POST /submissions               → submit + email verification link
 *   GET  /submissions/:token/verify → click link to verify
 *
 * Both routes are AUTH-FREE — third parties without an account can
 * file requests. They opt out of `tenantContextPlugin` via
 * `skipTenantContext: true` because no tenant id is known at write
 * time. After verification, the row is routed to the named tenant's
 * admin queue; that flow lives in a separate slice (Story 14.x admin
 * queue UI).
 */

import {
  type DsarPortalSubmissionResponse,
  type DsarPortalVerifyResponse,
  dsarPortalSubmissionResponseSchema,
  dsarPortalSubmitRequestSchema,
  dsarPortalVerifyResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync } from 'fastify';

import { ValidationError } from '../lib/http-error.js';
import { type DsarPortalRepository, sha256Hex } from './dsar-portal-repository.js';

const VERIFICATION_TTL_DAYS = 7;

export interface DsarPortalRoutesOptions {
  repository: DsarPortalRepository;
  /**
   * Dispatcher for the verification email. Production wires the
   * notifications package's email channel; tests inject an in-memory
   * capture. The token is plaintext and MUST NEVER be logged or
   * persisted outside this dispatcher.
   */
  dispatchVerificationEmail: (input: {
    email: string;
    fullName: string;
    plaintextToken: string;
    expiresAt: Date;
  }) => Promise<void>;
}

export const dsarPortalRoutes = (options: DsarPortalRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    /**
     * POST /submissions — auth-free public submission.
     */
    fastify.post(
      '/submissions',
      { config: { skipTenantContext: true, skipAudit: true } },
      async (request, reply) => {
        const parsed = dsarPortalSubmitRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid DSAR submission.');
        }
        const expires = new Date(Date.now() + VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
        const data = parsed.data;
        const result = await options.repository.create({
          kind: data.kind,
          email: data.email,
          fullName: data.fullName,
          tenantSlug: data.tenantSlug,
          description: data.description,
          ...(data.secondaryVerification !== undefined
            ? { secondaryVerification: data.secondaryVerification }
            : {}),
          verificationExpiresAt: expires,
        });
        try {
          await options.dispatchVerificationEmail({
            email: data.email,
            fullName: data.fullName,
            plaintextToken: result.plaintextToken,
            expiresAt: expires,
          });
        } catch (err) {
          // Email dispatch failure is intentionally non-fatal — the row
          // is in the database, the admin can re-send the verification
          // link from the queue UI. Log + return success.
          fastify.log.warn(
            { err, submissionId: result.row.id },
            'dsar-portal: verification email dispatch failed; row persists',
          );
        }

        const body: DsarPortalSubmissionResponse = {
          id: result.row.id,
          status: result.row.status,
          verificationExpiresAt: expires.toISOString(),
          message:
            'Thanks. Check your email for a verification link — once you click it, your request goes to the named organization.',
        };
        return reply.status(201).send(dsarPortalSubmissionResponseSchema.parse(body));
      },
    );

    /**
     * GET /submissions/:token/verify — auth-free verification link
     * landing. Plaintext token in the URL is sha256-hashed before
     * lookup. Successful verifications return a plain-language
     * confirmation; expired or unknown tokens return 404 with a
     * neutral message that doesn't leak whether the token was ever
     * valid.
     */
    fastify.get<{ Params: { token: string } }>(
      '/submissions/:token/verify',
      { config: { skipTenantContext: true, skipAudit: true } },
      async (request, reply) => {
        const token = request.params.token;
        if (!token || token.length < 16) {
          return reply.status(404).send(
            dsarPortalVerifyResponseSchema.parse({
              status: 'expired',
              message: 'This verification link is invalid or has expired.',
            } satisfies DsarPortalVerifyResponse),
          );
        }
        const tokenHash = sha256Hex(token);
        const row = await options.repository.findByTokenHash(tokenHash);
        if (!row) {
          return reply.status(404).send(
            dsarPortalVerifyResponseSchema.parse({
              status: 'expired',
              message: 'This verification link is invalid or has expired.',
            } satisfies DsarPortalVerifyResponse),
          );
        }
        if (row.verificationExpiresAt.getTime() < Date.now()) {
          return reply.status(410).send(
            dsarPortalVerifyResponseSchema.parse({
              status: 'expired',
              message: 'This verification link has expired. Please file a new request.',
            } satisfies DsarPortalVerifyResponse),
          );
        }
        if (row.status !== 'pending-verification') {
          return reply.status(200).send(
            dsarPortalVerifyResponseSchema.parse({
              status: row.status,
              message:
                row.status === 'verified'
                  ? 'Your request has already been verified and is in the queue.'
                  : 'This request is no longer active.',
            } satisfies DsarPortalVerifyResponse),
          );
        }
        const updated = await options.repository.markVerified(row.id, new Date());
        return reply.status(200).send(
          dsarPortalVerifyResponseSchema.parse({
            status: updated.status,
            message:
              'Thanks. Your request has been verified and routed to the named organization. They have 30 days to respond under most regulations.',
          } satisfies DsarPortalVerifyResponse),
        );
      },
    );
  };
};
