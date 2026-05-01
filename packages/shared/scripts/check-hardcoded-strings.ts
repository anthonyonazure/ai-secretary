#!/usr/bin/env tsx
/**
 * Story 1.9 — i18n hardcoded-string CI gate.
 *
 * Walks the curated set of UI surfaces that Story 1.9 translated and
 * flags any JSX text node still holding a literal string. The MVP
 * scope only covers the 6 web + 4 mobile files explicitly translated
 * in this story; mass-translation across the rest of the codebase is
 * a follow-up story (1.9-followup).
 *
 * Heuristic — match `>some text<` between two JSX tag boundaries on
 * the same line. False-positive prone, so we ALSO ignore:
 *   - lines containing `t(` (already translated)
 *   - lines containing `{` (interpolation / expression)
 *   - punctuation-only / whitespace-only / single-character spans
 *   - HTML/JSX entity-only spans
 *
 * Designed to be tightenable as we expand coverage. If it gets noisy
 * we ship without it (per Story 1.9 spec) and document followup.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

const CURATED_FILES: ReadonlyArray<string> = [
  // web
  'apps/web/src/components/feature/auth/signup-form.tsx',
  'apps/web/src/components/feature/auth/login-form.tsx',
  'apps/web/src/routes/signup.tsx',
  'apps/web/src/routes/login.tsx',
  'apps/web/src/routes/_authenticated/inbox.tsx',
  'apps/web/src/components/feature/onboarding/empty-state-recipient.tsx',
  // mobile
  'apps/mobile/components/auth/login-form.tsx',
  'apps/mobile/components/auth/signup-form.tsx',
  'apps/mobile/app/auth/login.tsx',
  'apps/mobile/app/auth/signup.tsx',
];

interface Finding {
  file: string;
  line: number;
  text: string;
  raw: string;
}

const JSX_TEXT_PATTERN = />([^<>{}]+)</g;
// Matches strings that are JUST punctuation / whitespace / entities, e.g.
// `&nbsp;`, `·`, `,`, `(`, `)`, etc. — those don't need translation.
const PUNCT_OR_ENTITY = /^[\s.,;:·•|/\\(){}\[\]&#0-9]*$|^&[a-z]+;$/i;

function scan(file: string): Finding[] {
  const abs = resolve(repoRoot, file);
  const source = readFileSync(abs, 'utf8');
  const findings: Finding[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.includes('// i18n-allow')) continue;
    if (line.includes('t(')) continue;
    JSX_TEXT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop.
    while ((match = JSX_TEXT_PATTERN.exec(line)) !== null) {
      const text = (match[1] ?? '').trim();
      if (!text) continue;
      if (PUNCT_OR_ENTITY.test(text)) continue;
      // Skip JSX-expression characters — `}` or `{` left over after
      // partial interpolation match.
      if (text.includes('{') || text.includes('}')) continue;
      // Skip values that look like component prop names (no spaces +
      // camelCase) — heuristic to dodge things like className tokens.
      if (!text.includes(' ') && /^[a-zA-Z][a-zA-Z0-9]*$/.test(text) && text.length < 4) continue;
      findings.push({ file, line: i + 1, text, raw: line.trim() });
    }
  }
  return findings;
}

const all: Finding[] = [];
for (const file of CURATED_FILES) {
  try {
    all.push(...scan(file));
  } catch (err) {
    process.stderr.write(`check:i18n — could not read ${file}: ${(err as Error).message}\n`);
    process.exitCode = 1;
  }
}

if (all.length > 0) {
  process.stderr.write(
    `check:i18n — ${all.length} hardcoded JSX string(s) found in curated UI set:\n`,
  );
  for (const finding of all) {
    process.stderr.write(`  ${finding.file}:${finding.line}  "${finding.text}"\n`);
  }
  process.stderr.write(
    '\nWrap each in t("…") (add the key to apps/{web,mobile}/{src/i18n,lib/i18n}/locales/{en,fr}.json), or annotate the line with `// i18n-allow` if non-translatable.\n',
  );
  process.exit(1);
}

process.stdout.write('check:i18n — curated UI set is clean.\n');
