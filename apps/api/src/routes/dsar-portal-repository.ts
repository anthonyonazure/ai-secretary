/**
 * Repository seam for the public DSAR portal (Story 14.3 — FR52).
 *
 * Stores public submissions in a separate `public_dsar_submissions`
 * table (not the tenant-scoped `dsar_requests` table) because:
 *   - rows arrive without auth context — no tenant id at write time
 *   - rows are tenant-routed only after email verification
 *   - the table is intentionally append-only; the receiving tenant's
 *     admin promotes verified rows into their `dsar_requests` queue
 *
 * The Drizzle implementation is stubbed here — the schema migration
 * lands in a sibling slice (the public submission table is independent
 * of the tenant-scoped `dsar_requests`). For the inline scope, only
 * the in-memory variant is wired so the route can be tested + dev-run.
 */

import { createHash, randomBytes } from 'node:crypto';

export type DsarPortalKind = 'access' | 'deletion' | 'correction';

export type DsarPortalStatus = 'pending-verification' | 'verified' | 'expired' | 'rejected';

export interface PublicDsarSubmissionRow {
  id: string;
  kind: DsarPortalKind;
  email: string;
  fullName: string;
  tenantSlug: string;
  description: string;
  secondaryVerification: string | null;
  status: DsarPortalStatus;
  /** SHA-256 hex of the plaintext verification token. */
  verificationTokenHash: string;
  verificationExpiresAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface CreateSubmissionInput {
  kind: DsarPortalKind;
  email: string;
  fullName: string;
  tenantSlug: string;
  description: string;
  secondaryVerification?: string | null;
  /** Set externally; production wires the email-dispatcher's TTL. */
  verificationExpiresAt: Date;
}

export interface CreateSubmissionResult {
  row: PublicDsarSubmissionRow;
  /** Plaintext verification token — emailed to the submitter; never
   *  persisted (only its sha256 hash lives on the row). */
  plaintextToken: string;
}

export interface DsarPortalRepository {
  create(input: CreateSubmissionInput): Promise<CreateSubmissionResult>;
  findByTokenHash(tokenHash: string): Promise<PublicDsarSubmissionRow | null>;
  markVerified(id: string, at: Date): Promise<PublicDsarSubmissionRow>;
}

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const generateToken = (): string => randomBytes(32).toString('base64url');

export class InMemoryDsarPortalRepository implements DsarPortalRepository {
  public readonly rows: PublicDsarSubmissionRow[] = [];

  async create(input: CreateSubmissionInput): Promise<CreateSubmissionResult> {
    const token = generateToken();
    const row: PublicDsarSubmissionRow = {
      id: crypto.randomUUID(),
      kind: input.kind,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      tenantSlug: input.tenantSlug.toLowerCase(),
      description: input.description,
      secondaryVerification: input.secondaryVerification ?? null,
      status: 'pending-verification',
      verificationTokenHash: sha256Hex(token),
      verificationExpiresAt: input.verificationExpiresAt,
      verifiedAt: null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return { row, plaintextToken: token };
  }

  async findByTokenHash(tokenHash: string): Promise<PublicDsarSubmissionRow | null> {
    return this.rows.find((r) => r.verificationTokenHash === tokenHash) ?? null;
  }

  async markVerified(id: string, at: Date): Promise<PublicDsarSubmissionRow> {
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Submission ${id} not found.`);
    const existing = this.rows[idx];
    if (!existing) throw new Error(`Submission ${id} not found.`);
    const updated: PublicDsarSubmissionRow = {
      ...existing,
      status: 'verified',
      verifiedAt: at,
    };
    this.rows[idx] = updated;
    return updated;
  }
}
