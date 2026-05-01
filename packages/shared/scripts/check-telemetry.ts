/**
 * Story 1.8 — telemetry CI gate.
 *
 * Walks the workspace and flags two failures:
 *   1. `track('name', ...)` calls referencing a name NOT in
 *      `TELEMETRY_REGISTRY`.
 *   2. Direct `posthog.capture(...)` calls anywhere outside the bootstrap
 *      shim (matched by file path) — those bypass the registry contract.
 *
 * Exits 0 when clean; 1 with a list of offending sites otherwise. Wire
 * into `.github/workflows/ci.yml` `typecheck` job after the existing
 * provider-isolation steps.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { TELEMETRY_SIGNAL_NAMES } from '../src/telemetry/registry.js';

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

/**
 * Allowlist of files where `posthog.capture(...)` may legitimately appear
 * — the bootstrap shim that wires PostHog into `setTelemetryTransport`,
 * test files mocking the transport, etc.
 */
const POSTHOG_CAPTURE_ALLOWLIST: ReadonlyArray<string> = [
  // Bootstrap files that translate `track()` events into the actual SDK
  // call. Add the literal relative path here once the web/mobile bootstrap
  // ships its PostHog adapter.
  // 'apps/web/src/telemetry/posthog-transport.ts',
  // 'apps/mobile/lib/telemetry/posthog-transport.ts',
];

const SCAN_DIRS: ReadonlyArray<string> = [
  'apps/api/src',
  'apps/workers/src',
  'apps/web/src',
  'apps/mobile/app',
  'apps/mobile/components',
  'apps/mobile/hooks',
  'apps/mobile/lib',
  'packages/shared/src',
  'packages/notifications/src',
  'packages/llm-gateway/src',
  'packages/transcription/src',
  'packages/storage/src',
  'packages/auth/src',
  'packages/consent/src',
  'packages/modules/src',
];

const SOURCE_EXTS: ReadonlyArray<string> = ['.ts', '.tsx'];

interface Offence {
  file: string;
  line: number;
  kind: 'unregistered-track' | 'direct-capture';
  detail: string;
}

const TRACK_CALL = /\btrack(?:As)?\(\s*['"]([^'"]+)['"]/g;
const POSTHOG_CAPTURE = /\bposthog\.capture\s*\(/g;

async function walk(dir: string, out: string[]): Promise<void> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    if (info.isDirectory()) {
      // Skip generated/node_modules trees + co-located test files would be
      // picked up but are valid call sites for `track()` (the test for
      // `track()` itself is fine).
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
      await walk(path, out);
    } else if (SOURCE_EXTS.some((ext) => path.endsWith(ext))) {
      out.push(path);
    }
  }
}

async function scanFile(file: string, registered: Set<string>): Promise<Offence[]> {
  const source = await readFile(file, 'utf8');
  const lines = source.split('\n');
  const offences: Offence[] = [];

  // Self-exclude: this script + the registry/track modules + their tests.
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  if (
    rel.endsWith('packages/shared/scripts/check-telemetry.ts') ||
    rel.endsWith('packages/shared/src/telemetry/registry.ts') ||
    rel.endsWith('packages/shared/src/telemetry/track.ts') ||
    rel.endsWith('packages/shared/src/telemetry/track.test.ts')
  ) {
    return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    // Skip comments / strings that just mention the call shape (rough
    // heuristic — line-leading // or /* gets dropped).
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    TRACK_CALL.lastIndex = 0;
    let match: RegExpExecArray | null = TRACK_CALL.exec(line);
    while (match !== null) {
      const name = match[1];
      if (name && !registered.has(name)) {
        offences.push({
          file: rel,
          line: i + 1,
          kind: 'unregistered-track',
          detail: `track('${name}', ...) — name not in TELEMETRY_REGISTRY`,
        });
      }
      match = TRACK_CALL.exec(line);
    }

    POSTHOG_CAPTURE.lastIndex = 0;
    if (POSTHOG_CAPTURE.test(line) && !POSTHOG_CAPTURE_ALLOWLIST.includes(rel)) {
      offences.push({
        file: rel,
        line: i + 1,
        kind: 'direct-capture',
        detail:
          'posthog.capture() bypasses the registry. Use track(name, props) from @aisecretary/shared/telemetry/track instead.',
      });
    }
  }

  return offences;
}

async function main(): Promise<number> {
  const registered = new Set(TELEMETRY_SIGNAL_NAMES);
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    await walk(resolve(REPO_ROOT, dir), files);
  }

  const offences: Offence[] = [];
  for (const file of files) {
    const result = await scanFile(file, registered);
    offences.push(...result);
  }

  if (offences.length === 0) {
    process.stdout.write(
      `[check-telemetry] OK — ${files.length} files scanned, ${registered.size} registered signals.\n`,
    );
    return 0;
  }

  process.stderr.write(`[check-telemetry] FAIL — ${offences.length} offence(s):\n`);
  for (const o of offences) {
    process.stderr.write(`  ${o.file}:${o.line} (${o.kind}) — ${o.detail}\n`);
  }
  process.stderr.write(
    '\nFix: add the missing entry to packages/shared/src/telemetry/registry.ts, OR replace posthog.capture() with track(name, props) from @aisecretary/shared/telemetry/track.\n',
  );
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`[check-telemetry] ${(err as Error).message}\n`);
    process.exit(1);
  });
