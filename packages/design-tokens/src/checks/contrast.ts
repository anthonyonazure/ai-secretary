/**
 * WCAG AA contrast gate.
 *
 * Reads `build/tokens.contrast-report.json` (emitted by the SD build) and
 * fails (exit 1) if any defined fg/bg pair regresses below:
 *   - 4.5:1 for body text (`kind: "body"`)
 *   - 3:1   for large text or non-text UI (`kind: "large" | "non-text"`)
 *
 * Uses `process.stdout.write` / `process.stderr.write` instead of console
 * to comply with Biome `noConsoleLog`.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

export interface ContrastPair {
  /** Token name for the foreground side, e.g. `--color-fg`. */
  fg: string;
  /** Token name for the background side, e.g. `--color-bg`. */
  bg: string;
  /** Resolved hex values used to compute the ratio. */
  fgValue: string;
  bgValue: string;
  /** Computed contrast ratio (1.0 – 21.0). */
  ratio: number;
  /** Pair classification — drives the threshold. */
  kind: 'body' | 'large' | 'non-text';
  /** Theme/mode scope this pair was evaluated under. */
  scope: string;
}

export interface ContrastReport {
  generatedAt: string;
  pairs: ContrastPair[];
}

export interface ContrastFailure {
  pair: ContrastPair;
  threshold: number;
}

const THRESHOLDS = {
  body: 4.5,
  large: 3.0,
  'non-text': 3.0,
} as const;

/** Parse a 3, 6, or 8-character hex color into 0–1 RGB. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (![3, 6, 8].includes(cleaned.length)) return null;
  const expand = cleaned.length === 3 ? cleaned.replace(/(.)/g, '$1$1') : cleaned.slice(0, 6);
  const r = Number.parseInt(expand.slice(0, 2), 16);
  const g = Number.parseInt(expand.slice(2, 4), 16);
  const b = Number.parseInt(expand.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

/** sRGB → linear-light. */
function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.x. */
export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio per WCAG 2.x. Returns 1.0 if either color fails to parse. */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return 1.0;
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Filter the report and return any pairs that fall below their threshold. */
export function findFailures(report: ContrastReport): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const pair of report.pairs) {
    const threshold = THRESHOLDS[pair.kind];
    if (pair.ratio + 1e-6 < threshold) {
      failures.push({ pair, threshold });
    }
  }
  return failures;
}

function writeOut(line: string): void {
  process.stdout.write(`${line}\n`);
}

function writeErr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export async function runContrastCheck(reportPath: string): Promise<number> {
  let raw: string;
  try {
    raw = await readFile(reportPath, 'utf8');
  } catch (err) {
    writeErr(`[contrast-check] cannot read report at ${reportPath}: ${(err as Error).message}`);
    writeErr('[contrast-check] run `pnpm --filter @aisecretary/design-tokens build` first.');
    return 1;
  }

  let report: ContrastReport;
  try {
    report = JSON.parse(raw) as ContrastReport;
  } catch (err) {
    writeErr(`[contrast-check] report is not valid JSON: ${(err as Error).message}`);
    return 1;
  }

  const failures = findFailures(report);
  if (failures.length === 0) {
    writeOut(`[contrast-check] PASS — ${report.pairs.length} pair(s) checked, all meet WCAG AA.`);
    return 0;
  }

  writeErr(`[contrast-check] FAIL — ${failures.length} pair(s) below threshold:`);
  for (const { pair, threshold } of failures) {
    writeErr(
      `  [${pair.scope}] ${pair.fg} on ${pair.bg} (${pair.fgValue} / ${pair.bgValue}) ` +
        `→ ${pair.ratio.toFixed(2)}:1 (need ≥ ${threshold.toFixed(1)}:1, kind=${pair.kind})`,
    );
  }
  return 1;
}

// CLI entry — only runs when invoked directly via tsx.
const invokedDirectly = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  return argv1.includes('contrast.ts') || argv1.endsWith('contrast.js');
})();

if (invokedDirectly) {
  const reportPath = resolve(process.cwd(), 'build/tokens.contrast-report.json');
  void runContrastCheck(reportPath).then((code) => {
    process.exit(code);
  });
}
