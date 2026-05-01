#!/usr/bin/env tsx
/**
 * Provider-isolation check for `packages/llm-gateway`.
 *
 * CLAUDE.md § Provider abstraction discipline:
 *   "LLM SDKs imported only inside `packages/llm-gateway`"
 *
 * Bans:
 *   - `@anthropic-ai/sdk`               — only in packages/llm-gateway/**
 *   - `@aws-sdk/client-bedrock-runtime` — only in packages/llm-gateway/**
 *
 * NOT banned by this script:
 *   - `openai` — that's the transcription script's responsibility
 *     (`packages/transcription/scripts/check-isolation.ts`). The
 *     transcription script's allowlist permits `openai` in BOTH
 *     `packages/transcription/**` AND `packages/llm-gateway/**`.
 *
 * Biome's `noRestrictedImports` is per-file and globs poorly across the
 * monorepo, so we use a grep-style scan here. Exits non-zero if any
 * banned import surfaces outside this package.
 *
 * Run via: `pnpm --filter @aisecretary/llm-gateway check:isolation`
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..');
const ALLOWED_PACKAGE = 'packages/llm-gateway';

/**
 * Provider SDKs whose imports must stay inside `packages/llm-gateway`.
 *
 * - `@anthropic-ai/sdk`               — direct Anthropic API client (anthropic.ts).
 * - `@aws-sdk/client-bedrock-runtime` — Anthropic-on-Bedrock client (bedrock.ts).
 *
 * `openai` is intentionally NOT in this list. It's shared with
 * `packages/transcription`; the transcription isolation script owns
 * the cross-package allowlist for it.
 */
const BANNED_PACKAGES = ['@anthropic-ai/sdk', '@aws-sdk/client-bedrock-runtime'];

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.expo',
  'coverage',
  '.git',
  '_bmad-output',
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

interface Violation {
  file: string;
  line: number;
  column: number;
  banned: string;
  text: string;
}

const isAllowedPath = (relPath: string): boolean =>
  relPath.startsWith(`${ALLOWED_PACKAGE}/`) || relPath === ALLOWED_PACKAGE;

const walk = async (dir: string, out: string[] = []): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'));
      if (SCAN_EXTENSIONS.has(ext)) {
        out.push(full);
      }
    }
  }
  return out;
};

const scanFile = async (file: string): Promise<Violation[]> => {
  const content = await readFile(file, 'utf8');
  const violations: Violation[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    for (const banned of BANNED_PACKAGES) {
      const escaped = banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        `(?:from|require|import)\\s*\\(?\\s*[\`'"](${escaped})(?:/[^\`'"]*)?[\`'"]`,
      );
      const m = line.match(re);
      if (m) {
        violations.push({
          file,
          line: i + 1,
          column: (m.index ?? 0) + 1,
          banned,
          text: line.trim(),
        });
      }
    }
  }
  return violations;
};

const main = async (): Promise<void> => {
  const exists = await stat(REPO_ROOT).catch(() => null);
  if (!exists) {
    process.stderr.write(`Repo root not found: ${REPO_ROOT}\n`);
    process.exit(2);
  }

  const candidates: string[] = [];
  for (const top of ['apps', 'packages']) {
    const topDir = join(REPO_ROOT, top);
    const topStat = await stat(topDir).catch(() => null);
    if (!topStat?.isDirectory()) continue;
    await walk(topDir, candidates);
  }

  const allViolations: Violation[] = [];
  for (const file of candidates) {
    const rel = relative(REPO_ROOT, file);
    if (isAllowedPath(rel)) continue;
    const violations = await scanFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    process.stdout.write(
      `[llm-gateway:check-isolation] OK — no banned imports outside ${ALLOWED_PACKAGE}\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `[llm-gateway:check-isolation] FAIL — ${allViolations.length} banned import(s) outside ${ALLOWED_PACKAGE}:\n`,
  );
  for (const v of allViolations) {
    const rel = relative(REPO_ROOT, v.file);
    process.stderr.write(`  ${rel}:${v.line}:${v.column}  imports '${v.banned}'\n`);
    process.stderr.write(`    ${v.text}\n`);
  }
  process.stderr.write(
    `\nLLM provider SDKs may only be imported from ${ALLOWED_PACKAGE}. Move the offending import into the package and expose a typed wrapper through @aisecretary/llm-gateway.\n`,
  );
  process.exit(1);
};

main().catch((err: unknown) => {
  process.stderr.write(`[llm-gateway:check-isolation] crashed: ${String(err)}\n`);
  process.exit(2);
});
