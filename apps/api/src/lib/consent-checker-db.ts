/**
 * Production consent checker — wraps `packages/consent`'s
 * `consentCheck(tenantId, meetingId, db)` with a live Drizzle pool.
 *
 * Runs the read inside `withTenantContext` so RLS settings are honored.
 * Returns `'ok' | 'missing'` per the `ConsentCheckerFn` contract.
 *
 * Wired in `buildServer()` when a `dbHandle` is available; tests
 * inject their own `consentChecker` (typically just
 * `async () => 'ok'`).
 */

import { consentCheck } from '@aisecretary/consent';
import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import type { ConsentCheckerFn } from '../plugins/consent-check.js';

export interface DbConsentCheckerOptions {
  db: Db;
  region: Region;
}

export const createDbConsentChecker = (options: DbConsentCheckerOptions): ConsentCheckerFn => {
  return async (tenantId, meetingId) => {
    return await withTenantContext(options.db, { tenantId, region: options.region }, async (tx) =>
      consentCheck(tenantId, meetingId, tx),
    );
  };
};
