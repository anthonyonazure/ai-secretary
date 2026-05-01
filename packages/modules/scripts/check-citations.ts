/**
 * Story 3.6 — citation-required CI gate.
 *
 * Walks every fixture in `packages/modules/fixtures/index.ts` (golden
 * "good" outputs the LLM gateway should match) and fails the build if
 * any analytic claim is missing a citation.
 *
 * Wire into `.github/workflows/ci.yml` `typecheck` job after the existing
 * provider-isolation + audit-coverage + telemetry checks. Also runs
 * nightly against synthetic eval samples (the fixture set extended via
 * `EXTRA_FIXTURES_PATH` env var — the eval pipeline writes generated
 * outputs to a JSON array file before invoking this script).
 */

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { ALL_FIXTURES } from '../fixtures/index.js';
import { auditAllCitations } from '../src/citation-audit.js';

interface FixtureEnvelope {
  source: string;
  outputs: Parameters<typeof auditAllCitations>[0];
}

async function loadExtraFixtures(): Promise<FixtureEnvelope[]> {
  const path = process.env.EXTRA_FIXTURES_PATH;
  if (!path) return [];
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Parameters<typeof auditAllCitations>[0];
    if (!Array.isArray(parsed)) {
      throw new Error('EXTRA_FIXTURES_PATH must point to a JSON array of ModuleOutput.');
    }
    return [{ source: path, outputs: parsed }];
  } catch (err) {
    process.stderr.write(
      `[check-citations] failed to load extra fixtures from ${path}: ${(err as Error).message}\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<number> {
  const envelopes: FixtureEnvelope[] = [
    { source: 'packages/modules/fixtures/index.ts', outputs: ALL_FIXTURES },
    ...(await loadExtraFixtures()),
  ];

  let totalClaims = 0;
  let totalMissing = 0;
  for (const env of envelopes) {
    const { missing, total } = auditAllCitations(env.outputs);
    totalClaims += total;
    totalMissing += missing.length;
    if (missing.length > 0) {
      process.stderr.write(`[check-citations] ${env.source}: ${missing.length} uncited claim(s)\n`);
      for (const entry of missing) {
        const moduleId = env.outputs[entry.fixture]?.module ?? 'unknown';
        process.stderr.write(
          `  fixture[${entry.fixture}] (${moduleId}) ${entry.path}: "${entry.claim}"\n`,
        );
      }
    }
  }

  if (totalMissing > 0) {
    process.stderr.write(
      `\n[check-citations] FAIL — ${totalMissing} of ${totalClaims} analytic claim(s) missing citations.\nEvery analytic claim in a ModuleOutput MUST carry at least one (meetingId, turnId) citation per the Story 3.5 deep-link contract.\n`,
    );
    return 1;
  }

  process.stdout.write(
    `[check-citations] OK — ${totalClaims} analytic claim(s) across ${envelopes.length} fixture envelope(s); 100% citation coverage.\n`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`[check-citations] ${(err as Error).message}\n`);
    process.exit(1);
  });
