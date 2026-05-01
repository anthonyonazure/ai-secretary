/**
 * Audit-log export route — Story 14.5 (FR54).
 *
 * Mount path: `/api/v1/audit-export` (set by `buildServer()` via `prefix`).
 *
 *   GET / → tenant's audit log as JSON (default) or CSV (?format=csv)
 *
 * Auth + RLS:
 *   - org_admin or super_admin only (per-tenant compliance evidence;
 *     org_member / org_viewer should not have read access)
 *   - tenant scoping is enforced via RLS in the repository
 *
 * The route is GET + read-only, so it sets `skipAudit: true` (the
 * audit-coverage CI walker only enforces audit on state-changing
 * methods, but the marker keeps intent explicit).
 */

import {
  type AuditExportResponse,
  type AuditExportRow,
  auditExportQuerySchema,
  auditExportResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';
import { requireRole } from '../lib/role-check.js';
import type { AuditExportRepository, AuditExportRowInternal } from './audit-export-repository.js';

export interface AuditExportRoutesOptions {
  repository: AuditExportRepository;
}

const requireUser = (request: FastifyRequest): { userId: string; tenantId: string } => {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required.');
  }
  if (!request.tenantId) {
    throw new ForbiddenError('Tenant context missing.');
  }
  return { userId: request.user.userId, tenantId: request.tenantId };
};

const DEFAULT_WINDOW_DAYS = 30;

const toWire = (row: AuditExportRowInternal): AuditExportRow => ({
  id: row.id,
  tenantId: row.tenantId,
  actorUserId: row.actorUserId,
  action: row.action,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  metadata: row.metadata,
  requestId: row.requestId,
  region: row.region,
  ipAddress: row.ipAddress,
  userAgent: row.userAgent,
  createdAt: row.createdAt.toISOString(),
});

const csvEscape = (value: string): string => {
  if (value.length === 0) return '';
  if (/["\n,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const renderCsv = (rows: AuditExportRow[]): string => {
  const headers = [
    'id',
    'tenantId',
    'actorUserId',
    'action',
    'resourceType',
    'resourceId',
    'metadata',
    'requestId',
    'region',
    'ipAddress',
    'userAgent',
    'createdAt',
  ];
  const lines: string[] = [headers.join(',')];
  for (const row of rows) {
    const cells = [
      row.id,
      row.tenantId,
      row.actorUserId ?? '',
      row.action,
      row.resourceType,
      row.resourceId ?? '',
      JSON.stringify(row.metadata),
      row.requestId ?? '',
      row.region,
      row.ipAddress ?? '',
      row.userAgent ?? '',
      row.createdAt,
    ].map((c) => csvEscape(String(c)));
    lines.push(cells.join(','));
  }
  return `${lines.join('\n')}\n`;
};

export const auditExportRoutes = (options: AuditExportRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { skipAudit: true },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { tenantId } = requireUser(request);
        const parsed = auditExportQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid audit-export query.',
          );
        }
        const { format, since, until, action, resourceType, limit } = parsed.data;

        const now = new Date();
        const defaultSince = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const sinceDate = since ? new Date(since) : defaultSince;
        const untilDate = until ? new Date(until) : now;
        if (sinceDate.getTime() >= untilDate.getTime()) {
          throw new ValidationError('`since` must be earlier than `until`.');
        }

        const actions = action
          ? action
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : undefined;

        const result = await options.repository.list({
          tenantId,
          since: sinceDate,
          until: untilDate,
          ...(actions && actions.length > 0 ? { actions } : {}),
          ...(resourceType ? { resourceType } : {}),
          limit,
        });
        const items = result.items.map(toWire);

        if (format === 'csv') {
          const csv = renderCsv(items);
          return reply
            .status(200)
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header(
              'Content-Disposition',
              `attachment; filename="audit-log-${sinceDate.toISOString().slice(0, 10)}-to-${untilDate.toISOString().slice(0, 10)}.csv"`,
            )
            .send(csv);
        }

        const body: AuditExportResponse = {
          items,
          totalCount: result.totalCount,
          range: {
            since: sinceDate.toISOString(),
            until: untilDate.toISOString(),
          },
        };
        return reply.status(200).send(auditExportResponseSchema.parse(body));
      },
    );
  };
};
