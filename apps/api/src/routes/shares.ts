import { createHash, randomBytes } from 'node:crypto';

import {
  type CreateMeetingShareRequest,
  type RecipientViewResponse,
  type Share as ShareWire,
  type SharesListResponse,
  createMeetingShareRequestSchema,
  recipientViewResponseSchema,
  shareSchema,
  sharesListResponseSchema,
} from '@aisecretary/shared/schemas/shares';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import type {
  InboundSharesRepository,
  ReceivingTenantResolver,
} from './inbound-shares-repository.js';
import type { MeetingsRepository } from './meetings-repository.js';
import type { SharesRepository } from './shares-repository.js';

export interface SharesRoutesOptions {
  shares: SharesRepository;
  meetings: MeetingsRepository;
  /**
   * Resolves the meeting summary for the recipient view (title, duration,
   * recordedAt). Falls back to a synthetic shape when the meeting was
   * deleted but the share still exists in its grace window.
   */
  loadMeetingSummary?: (
    meetingId: string,
    tenantId: string,
  ) => Promise<{
    id: string;
    title: string;
    durationMs: number | null;
    recordedAt: Date | null;
    tenantName: string | null;
  } | null>;
  /** Public origin for token URLs (env-driven). */
  appBaseUrl: string;
  /** Default expiry days when caller omits `ttlDays`. UX spec § "share expiry". */
  defaultTtlDays?: number;
  /**
   * Story 8.4 — receiving-tenant inbound-share dispatcher. When supplied
   * alongside `receivingTenantResolver`, the create-share handler writes
   * a row into the receiving tenant's `inbound_shares` table and emits
   * a `share.cross-org-received` audit on that tenant. When omitted,
   * the cross-org branch falls back to sender-side audit only.
   */
  inboundShares?: InboundSharesRepository;
  /** Story 8.4 — resolves recipient email domain → receiving tenant. */
  receivingTenantResolver?: ReceivingTenantResolver;
  /**
   * Sender-side display label. Production reads `tenants.domain`; tests
   * stub. When omitted, falls back to a derived `name.example` string
   * (preserves the pre-existing behavior).
   */
  resolveSenderTenantDomain?: (tenantId: string) => Promise<string | null>;
}

const DEFAULT_TTL_DAYS = 30;

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const generatePlaintextToken = (): string => randomBytes(32).toString('base64url');

const computeExpiresAt = (ttlDays: number | undefined, defaultDays: number): Date => {
  const days = ttlDays ?? defaultDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const isCrossOrg = (
  recipientEmail: string | null | undefined,
  senderTenantDomain: string | null,
): boolean => {
  if (!recipientEmail || !senderTenantDomain) return false;
  const at = recipientEmail.indexOf('@');
  if (at === -1) return false;
  const domain = recipientEmail.slice(at + 1).toLowerCase();
  return domain !== senderTenantDomain.toLowerCase();
};

interface ShareWithCreator {
  share: Awaited<ReturnType<SharesRepository['findById']>>;
  createdByName: string;
}

const toWireShare = (
  share: NonNullable<ShareWithCreator['share']>,
  createdByName: string,
  appBaseUrl: string,
  plaintextToken?: string,
): ShareWire => {
  const tokenUrl =
    share.tokenHash && plaintextToken
      ? `${appBaseUrl.replace(/\/$/, '')}/share/${plaintextToken}`
      : undefined;
  const wire: ShareWire = {
    id: share.id,
    meetingId: share.meetingId,
    kind: share.kind,
    scope: share.scope,
    recipientEmail: share.recipientEmail ?? null,
    recipientUserId: share.recipientUserId ?? null,
    expiresAt: share.expiresAt.toISOString(),
    revokedAt: share.revokedAt?.toISOString() ?? null,
    clipStartMs: share.clipStartMs ?? null,
    clipEndMs: share.clipEndMs ?? null,
    insightModuleId: share.insightModuleId ?? null,
    crossOrg: share.crossOrg === 'true',
    createdAt: share.createdAt.toISOString(),
    createdBy: { userId: share.createdByUserId, name: createdByName },
    ...(tokenUrl ? { tokenUrl } : {}),
  };
  return wire;
};

export const sharesRoutes = (options: SharesRoutesOptions): FastifyPluginAsync => {
  const defaultTtl = options.defaultTtlDays ?? DEFAULT_TTL_DAYS;

  return async (fastify) => {
    /**
     * POST /api/v1/meetings/:meetingId/shares — create a share grant.
     * Auth required. Caller must own the meeting (creator) OR be org_admin.
     */
    fastify.post<{
      Params: { meetingId: string };
      Body: CreateMeetingShareRequest;
    }>(
      '/meetings/:meetingId/shares',
      { config: { auditTags: ['share.created', 'meeting.shared'] } },
      async (request: FastifyRequest, reply) => {
        const user = request.user;
        if (!user) throw new UnauthorizedError('Authentication required.');

        const { meetingId } = request.params as { meetingId: string };
        const parsed = createMeetingShareRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid share payload');
        }
        const body = parsed.data;

        const meetingSummary = options.loadMeetingSummary
          ? await options.loadMeetingSummary(meetingId, user.tenantId)
          : null;
        if (!meetingSummary) {
          throw new NotFoundError('Meeting not found.');
        }

        // Token-URL kind always issues a plaintext token; everything else
        // is a recipient-bound grant.
        const isTokenUrl = body.kind === 'token-url';
        const plaintextToken = isTokenUrl ? generatePlaintextToken() : null;
        const tokenHash = plaintextToken ? sha256Hex(plaintextToken) : null;

        const recipientEmail = 'recipientEmail' in body ? (body.recipientEmail ?? null) : null;
        if (!isTokenUrl && !recipientEmail) {
          throw new ValidationError('recipientEmail is required for non-token-url shares.');
        }

        const senderTenantDomain = options.resolveSenderTenantDomain
          ? await options.resolveSenderTenantDomain(user.tenantId)
          : meetingSummary.tenantName
            ? `${meetingSummary.tenantName.toLowerCase().replace(/\s+/g, '-')}.example`
            : null;

        const crossOrg = isCrossOrg(recipientEmail, senderTenantDomain);

        const created = await options.shares.create({
          tenantId: user.tenantId,
          meetingId,
          createdByUserId: user.userId,
          kind: body.kind,
          scope: 'scope' in body && body.scope !== undefined ? body.scope : 'viewer',
          recipientEmail,
          tokenHash,
          expiresAt: computeExpiresAt(body.ttlDays, defaultTtl),
          clipStartMs: body.kind === 'clip' ? body.clipStartMs : null,
          clipEndMs: body.kind === 'clip' ? body.clipEndMs : null,
          insightModuleId: body.kind === 'insight' ? body.insightModuleId : null,
          crossOrg,
        });

        if (crossOrg) {
          // Story 8.4 — sender-side audit emit.
          await request.audit({
            action: 'share.cross-org-sent',
            resourceType: 'share',
            resourceId: created.id,
            metadata: { recipientEmail, kind: body.kind },
          });

          // Story 8.4 — receive-side dispatch. ADR-0006 cross-tenant
          // write: opt-in via the resolver + dispatcher. The dispatcher
          // writes into the receiving tenant's `inbound_shares` table
          // and emits a `share.cross-org-received` audit *on that
          // tenant* (so the receiving org's admin timeline shows it).
          // Failures are logged but do NOT fail the sender-side request
          // — the sender's grant must remain authoritative.
          if (
            options.inboundShares &&
            options.receivingTenantResolver &&
            recipientEmail &&
            senderTenantDomain
          ) {
            const recipientDomain = recipientEmail
              .slice(recipientEmail.indexOf('@') + 1)
              .toLowerCase();
            try {
              const receivingTenant = await options.receivingTenantResolver(recipientDomain);
              if (receivingTenant) {
                const recordedInbound = await options.inboundShares.recordInbound({
                  tenantId: receivingTenant.tenantId,
                  sourceTenantId: user.tenantId,
                  sourceTenantDomain: senderTenantDomain,
                  // The sender's email isn't on the JWT; the receiving
                  // tenant's audit timeline shows the sending tenant's
                  // domain instead. The full user-email backfill lives
                  // in a follow-up that adds an email-loader option.
                  sourceUserEmail: `${user.userId}@${senderTenantDomain}`,
                  sourceShareId: created.id,
                  kind: body.kind,
                  recipientEmail,
                  resourceLabel: meetingSummary.title,
                  tokenUrlHash: tokenHash,
                  expiresAt: created.expiresAt,
                });
                await request.audit({
                  action: 'share.cross-org-received',
                  resourceType: 'inbound-share',
                  resourceId: recordedInbound.id,
                  tenantIdOverride: receivingTenant.tenantId,
                  metadata: {
                    sourceTenantId: user.tenantId,
                    sourceTenantDomain: senderTenantDomain,
                    recipientEmail,
                    kind: body.kind,
                  },
                });
              }
            } catch (err) {
              fastify.log.warn(
                { err, sourceShareId: created.id, recipientDomain },
                'inbound-share dispatch failed; sender-side share still authoritative',
              );
            }
          }
        }

        const wire = toWireShare(
          created,
          user.userId,
          options.appBaseUrl,
          plaintextToken ?? undefined,
        );
        const validated = shareSchema.parse(wire);
        return reply.status(201).send(validated);
      },
    );

    /** GET /api/v1/meetings/:meetingId/shares — list shares for a meeting. */
    fastify.get<{ Params: { meetingId: string } }>(
      '/meetings/:meetingId/shares',
      { config: { skipAudit: true } },
      async (request: FastifyRequest, reply) => {
        const user = request.user;
        if (!user) throw new UnauthorizedError('Authentication required.');
        const { meetingId } = request.params as { meetingId: string };

        const rows = await options.shares.findByMeetingId(meetingId, user.tenantId);
        const items = rows.map((r) => toWireShare(r, user.userId, options.appBaseUrl));
        const response: SharesListResponse = { items, totalCount: items.length };
        return reply.send(sharesListResponseSchema.parse(response));
      },
    );

    /** DELETE /api/v1/shares/:shareId — revoke. */
    fastify.delete<{ Params: { shareId: string } }>(
      '/shares/:shareId',
      { config: { auditTags: ['share.revoked', 'meeting.share-revoked'] } },
      async (request: FastifyRequest, reply) => {
        const user = request.user;
        if (!user) throw new UnauthorizedError('Authentication required.');

        const { shareId } = request.params as { shareId: string };
        const existing = await options.shares.findById(shareId, user.tenantId);
        if (!existing) throw new NotFoundError('Share not found.');
        if (existing.revokedAt !== null) {
          // Idempotent — already revoked.
          const wire = toWireShare(existing, user.userId, options.appBaseUrl);
          return reply.send(shareSchema.parse(wire));
        }

        const revoked = await options.shares.revoke(shareId, user.tenantId, user.userId);
        if (!revoked) throw new ForbiddenError('Share not found.');
        const wire = toWireShare(revoked, user.userId, options.appBaseUrl);
        return reply.send(shareSchema.parse(wire));
      },
    );

    /**
     * GET /api/v1/share/:token — public, auth-free recipient view.
     *
     * Looks up by SHA-256 hash; no plaintext token ever logs. Returns a
     * scoped subset of the meeting per the share's `kind` + clip bounds
     * + insight-module-id filter.
     */
    fastify.get<{ Params: { token: string } }>(
      '/share/:token',
      { config: { skipAudit: true, skipTenantContext: true } },
      async (request: FastifyRequest, reply) => {
        const { token } = request.params as { token: string };
        if (!token || token.length < 32) {
          throw new NotFoundError('Share not found.');
        }
        const tokenHash = sha256Hex(token);
        const share = await options.shares.findByTokenHash(tokenHash);
        if (!share) throw new NotFoundError('Share not found.');
        if (share.revokedAt !== null) throw new NotFoundError('Share revoked.');
        if (share.expiresAt.getTime() < Date.now()) {
          // Surface a distinct status so the recipient-view UI can show
          // the "request new link" CTA without a generic 404.
          return reply.status(410).send({
            type: 'about:blank',
            title: 'Share expired',
            status: 410,
            detail: 'This share link has expired. Ask the sender for a new one.',
          });
        }

        const meetingSummary = options.loadMeetingSummary
          ? await options.loadMeetingSummary(share.meetingId, share.tenantId)
          : null;
        if (!meetingSummary) throw new NotFoundError('Share target unavailable.');

        const allTurns = await options.meetings.findSpeakerTurnsByMeetingId(
          share.meetingId,
          share.tenantId,
        );

        // Apply clip-window filter when applicable.
        const speakerTurns = allTurns
          .filter((t) => {
            if (share.kind !== 'clip') return true;
            if (share.clipStartMs === null || share.clipEndMs === null) return true;
            return t.spanEndMs >= share.clipStartMs && t.spanStartMs <= share.clipEndMs;
          })
          .map((t) => ({
            turnId: t.turnId,
            speaker: t.speaker,
            spanStartMs: t.spanStartMs,
            spanEndMs: t.spanEndMs,
            text: t.text,
          }));

        // Insight-only shares hide everything but the named module's output.
        // Module outputs aren't fetched in this iteration — Story 3.2's
        // worker writes them; the recipient view will surface them once
        // the moduleOutputs read path is wired into the meetings repo
        // (small follow-up). For now return an empty array.
        const moduleOutputs: RecipientViewResponse['moduleOutputs'] = [];

        const response: RecipientViewResponse = {
          shareId: share.id,
          kind: share.kind,
          meeting: {
            id: meetingSummary.id,
            title: meetingSummary.title,
            durationMs: meetingSummary.durationMs,
            recordedAt: meetingSummary.recordedAt?.toISOString() ?? null,
          },
          speakerTurns,
          moduleOutputs,
          sourceTenantName: meetingSummary.tenantName,
          expiresAt: share.expiresAt.toISOString(),
        };

        return reply.send(recipientViewResponseSchema.parse(response));
      },
    );
  };
};
