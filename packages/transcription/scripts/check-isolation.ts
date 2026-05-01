#!/usr/bin/env tsx
/**
 * Provider-isolation check for `packages/transcription`.
 *
 * CLAUDE.md § Provider abstraction discipline:
 *   "Whisper / faster-whisper clients only inside `packages/transcription`"
 *
 * Biome's `noRestrictedImports` is per-file and globs poorly across the
 * monorepo, so we use a grep-style scan here. Exits non-zero if any
 * banned import surfaces outside this package.
 *
 * Run via: `pnpm --filter @aisecretary/transcription check:isolation`
 *
 * Story 2.3 (diarization) extends `BANNED_PACKAGES` with `pyannote-audio`
 * (or whatever node binding ends up shipping) once it lands.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..');
/**
 * Packages allowed to import the banned SDKs.
 *
 * `openai` is shared between transcription (Whisper API) and
 * `packages/llm-gateway` (OpenAI + Azure OpenAI chat). Both packages
 * are listed here; the llm-gateway has its own isolation script for
 * `@anthropic-ai/sdk` + `@aws-sdk/client-bedrock-runtime`.
 *
 * `pyannote-audio` and `faster-whisper-client` are transcription-only
 * — but listing both packages here is harmless because neither shows
 * up in `packages/llm-gateway/**` source.
 */
const ALLOWED_PACKAGES = ['packages/transcription', 'packages/llm-gateway'];

/**
 * Provider SDKs whose imports must stay inside `packages/transcription`.
 *
 * - `openai` — Whisper API client (`whisper-api.ts`).
 * - `faster-whisper-client` — placeholder; we currently call the
 *   self-hosted service via plain `fetch`, so there's no SDK to ban
 *   yet. If a future story switches to a packaged client (e.g. a thin
 *   gRPC client), add it here.
 * - `pyannote-audio` — Story 2.3 diarization. Listed pre-emptively so
 *   any contributor who tries to add diarization outside this package
 *   gets a CI failure with a clear pointer.
 */
const BANNED_PACKAGES = ['openai', 'pyannote-audio', 'faster-whisper-client'];

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
  ALLOWED_PACKAGES.some((pkg) => relPath.startsWith(`${pkg}/`) || relPath === pkg);

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

  const allowedList = ALLOWED_PACKAGES.join(', ');
  if (allViolations.length === 0) {
    process.stdout.write(
      `[transcription:check-isolation] OK — no banned imports outside ${allowedList}\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `[transcription:check-isolation] FAIL — ${allViolations.length} banned import(s) outside ${allowedList}:\n`,
  );
  for (const v of allViolations) {
    const rel = relative(REPO_ROOT, v.file);
    process.stderr.write(`  ${rel}:${v.line}:${v.column}  imports '${v.banned}'\n`);
    process.stderr.write(`    ${v.text}\n`);
  }
  process.stderr.write(
    `\nProvider SDKs may only be imported from ${allowedList}. Move the offending import into the package and expose a typed wrapper through @aisecretary/transcription.\n`,
  );
  process.exit(1);
};

main().catch((err: unknown) => {
  process.stderr.write(`[transcription:check-isolation] crashed: ${String(err)}\n`);
  process.exit(2);
});
