/**
 * Erasure-cascade type re-exports for the worker side.
 *
 * The canonical registry lives in `apps/api/src/lib/erasure-cascade.ts`
 * (consumed by the API DSAR routes). Both surfaces share this type
 * shape; we duplicate the type definitions here rather than reaching
 * across the apps/api → apps/workers boundary so the worker package
 * stays self-contained.
 *
 * If the cascade-types ever drift, the test
 * `apps/workers/src/lib/erasure-runner.test.ts` exercises the runner
 * with a fixture of the live registry — the type incompatibility shows
 * up as a tsc error there.
 */

export type ErasureStrategy = 'cascade-source' | 'cascade' | 'soft-delete' | 'shred' | 'redact';

export interface ErasureCascadeEntry {
  table: string;
  strategy: ErasureStrategy;
  notes: string;
}
