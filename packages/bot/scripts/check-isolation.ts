#!/usr/bin/env tsx
/**
 * Provider-isolation check for `packages/bot`.
 *
 * CLAUDE.md § Provider abstraction discipline (extension):
 *   "Zoom Meeting SDK + Microsoft Graph Communications SDK imports only
 *    inside `packages/bot`."
 *
 * Mirror of `packages/transcription/scripts/check-isolation.ts`. Exits
 * non-zero if any banned import surfaces outside `packages/bot`.
 *
 * Run via: `pnpm --filter @aisecretary/bot check:isolation`
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..');

/**
 * Packages allowed to import the banned SDKs. Only `packages/bot`
 * itself for now; `apps/bot` consumes the typed wrapper exposed
 * through `@aisecretary/bot`.
 */
const ALLOWED_PACKAGES = ['packages/bot'];

/**
 * Provider SDKs whose imports must stay inside `packages/bot`.
 *
 * - `@zoom/meetingsdk` — official Node bindings to the Zoom Meeting
 *   SDK; required for raw audio capture from a joined meeting.
 * - `@zoom/videosdk` — alt path if Anthony picks the Video SDK over
 *   the Meeting SDK; pre-banned to avoid drift.
 * - `@microsoft/microsoft-graph-client` — Graph client used to manage
 *   the Teams online-meeting + media-bot subscription.
 * - `@azure/communication-*` — Azure Communication Services SDKs
 *   (some setups front the Teams media bot through ACS).
 * - `botbuilder` — Bot Framework; some media-bot reference impls use
 *   it; pre-banned so it stays inside the wrapper if introduced.
 */
const BANNED_PACKAGES = [
  '@zoom/meetingsdk',
  '@zoom/videosdk',
  '@microsoft/microsoft-graph-client',
  '@azure/communication-common',
  '@azure/communication-calling',
  '@azure/communication-call-automation',
  'botbuilder',
];

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
    process.stdout.write(`[bot:check-isolation] OK — no banned imports outside ${allowedList}\n`);
    process.exit(0);
  }

  process.stderr.write(
    `[bot:check-isolation] FAIL — ${allViolations.length} banned import(s) outside ${allowedList}:\n`,
  );
  for (const v of allViolations) {
    const rel = relative(REPO_ROOT, v.file);
    process.stderr.write(`  ${rel}:${v.line}:${v.column}  imports '${v.banned}'\n`);
    process.stderr.write(`    ${v.text}\n`);
  }
  process.stderr.write(
    `\nProvider SDKs may only be imported from ${allowedList}. Move the offending import into the package and expose a typed wrapper through @aisecretary/bot.\n`,
  );
  process.exit(1);
};

main().catch((err: unknown) => {
  process.stderr.write(`[bot:check-isolation] crashed: ${String(err)}\n`);
  process.exit(2);
});
