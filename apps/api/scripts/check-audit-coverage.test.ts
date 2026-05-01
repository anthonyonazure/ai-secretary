import { exec } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const SCRIPT_PATH = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  'check-audit-coverage.ts',
);
const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

const PASSING_FIXTURE = `
import type { FastifyPluginAsync } from 'fastify';

export const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/items', async () => ({ items: [] }));
  fastify.post('/items', { config: { auditTags: ['meeting.created'] } }, async () => ({ ok: true }));
  fastify.patch('/items/:id', async (request) => {
    await request.audit({ action: 'meeting.updated', resourceType: 'meeting' });
    return { ok: true };
  });
};
`.trim();

const FAILING_FIXTURE = `
import type { FastifyPluginAsync } from 'fastify';

export const routes: FastifyPluginAsync = async (fastify) => {
  // Non-GET, no auditTags, no manual request.audit() — must trip the gate.
  fastify.delete('/items/:id', async () => ({ ok: true }));
};
`.trim();

const SKIP_AUDIT_FIXTURE = `
import type { FastifyPluginAsync } from 'fastify';

export const routes: FastifyPluginAsync = async (fastify) => {
  // POST that opts out via skipAudit — must NOT trip the gate.
  fastify.post('/auth/login', { config: { skipAudit: true } }, async () => ({ ok: true }));
};
`.trim();

const runScript = async (
  routesDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  try {
    const { stdout, stderr } = await execAsync(
      `pnpm tsx ${JSON.stringify(SCRIPT_PATH)} ${JSON.stringify(routesDir)}`,
      { cwd: REPO_ROOT, env: { ...process.env, NODE_ENV: 'test' } },
    );
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.code ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
};

describe('check-audit-coverage script', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'audit-coverage-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // Each test spawns `tsx` to run the script; under workspace-concurrent
  // `pnpm test` load a cold tsx invocation can exceed vitest's 5s default,
  // so every script-spawning case carries a 30s timeout (matching the
  // live-routes test below).
  it('exits 0 when every state-changing route is covered', async () => {
    const routes = join(tmpDir, 'routes');
    await mkdir(routes, { recursive: true });
    await writeFile(join(routes, 'good.ts'), PASSING_FIXTURE, 'utf8');
    const result = await runScript(routes);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK');
  }, 30_000);

  it('exits 1 when a state-changing route is missing audit coverage', async () => {
    const routes = join(tmpDir, 'routes');
    await mkdir(routes, { recursive: true });
    await writeFile(join(routes, 'bad.ts'), FAILING_FIXTURE, 'utf8');
    const result = await runScript(routes);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('FAIL');
    expect(result.stderr).toContain('DELETE /items/:id');
  }, 30_000);

  it('honors config.skipAudit: true on a non-GET route', async () => {
    const routes = join(tmpDir, 'routes');
    await mkdir(routes, { recursive: true });
    await writeFile(join(routes, 'auth.ts'), SKIP_AUDIT_FIXTURE, 'utf8');
    const result = await runScript(routes);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK');
  }, 30_000);

  it('exits 0 against the live apps/api/src/routes (current routes are all covered)', async () => {
    // Real routes dir — confirms the script passes on the fixture routes
    // we ship in the repo. If a future story adds an uncovered route, this
    // test surfaces the regression locally before CI catches it.
    const routesDir = resolve(REPO_ROOT, 'apps', 'api', 'src', 'routes');
    const result = await runScript(routesDir);
    expect(result.exitCode).toBe(0);
  }, 30_000);
});
