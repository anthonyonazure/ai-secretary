/**
 * Style Dictionary 4.x build orchestrator for @aisecretary/design-tokens.
 *
 * This file is intentionally JavaScript (ESM). Custom transforms live in
 * TypeScript under src/transforms/* and are compiled to dist/transforms/*
 * by the `prebuild` script in package.json before this script runs.
 *
 * Per ADR-0002:
 *   - tokens/*.json provide base tokens.
 *   - tokens/modes/*.json supply mode overlays (theme × density × motion).
 *   - 27 mode combinations are NOT pre-baked — each axis is emitted as a
 *     separate CSS scope (`:root`, `.theme-dark`, `.density-relaxed`, …).
 *   - color-mix() values get a pre-computed `<token>-fallback` companion
 *     plus a `.no-color-mix` override block.
 *   - tokens.native.ts only sees fallbacks (RN can't do color-mix()).
 *   - tokens.contrast-report.json drives the AA gate.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import StyleDictionary from 'style-dictionary';

import {
  colorMixFallbackTransform,
  isColorMixToken,
} from './dist/transforms/color-mix-fallback.js';
import { reactNativeTypedFormat } from './dist/transforms/rn-typed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const TOKENS_DIR = resolve(ROOT, 'tokens');
const MODES_DIR = resolve(TOKENS_DIR, 'modes');
const BUILD_DIR = resolve(ROOT, 'build');

// ---------------------------------------------------------------------------
// Custom transform / format registration.
// ---------------------------------------------------------------------------
StyleDictionary.registerTransform({
  ...colorMixFallbackTransform,
});
StyleDictionary.registerFormat({
  ...reactNativeTypedFormat,
});

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------
async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listModes() {
  const files = await readdir(MODES_DIR);
  const modes = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const path = resolve(MODES_DIR, file);
    const data = await readJson(path);
    if (data?._mode) {
      modes.push({ ...data._mode, path, data });
    }
  }
  return modes;
}

function tokenName(path) {
  return `--${path.filter((seg) => seg !== '_mode').join('-')}`;
}

async function loadBaseTokens() {
  const baseFiles = (await readdir(TOKENS_DIR)).filter((f) => f.endsWith('.json'));
  const merged = {};
  for (const file of baseFiles) {
    const data = await readJson(resolve(TOKENS_DIR, file));
    Object.assign(merged, data);
  }
  return merged;
}

// Walk a token tree and yield every leaf along with its path.
function* walkTokens(node, path = []) {
  if (node === null || typeof node !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    yield { path, token: node };
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    yield* walkTokens(child, [...path, key]);
  }
}

// Resolve `{color.accent.value}`-style refs against the merged tree.
function resolveRefs(tree) {
  const refRe = /\{([^}]+)\}/g;
  const get = (refPath) => {
    const segs = refPath.split('.').filter((s) => s !== 'value');
    let cursor = tree;
    for (const seg of segs) {
      if (cursor === null || typeof cursor !== 'object') return undefined;
      cursor = cursor[seg];
    }
    return cursor;
  };

  for (const { token } of walkTokens(tree)) {
    if (typeof token.value === 'string' && token.value.includes('{')) {
      token.value = token.value.replace(refRe, (_match, refPath) => {
        const resolved = get(refPath);
        if (resolved && typeof resolved === 'object' && 'value' in resolved) {
          return String(resolved.value);
        }
        return typeof resolved === 'string' ? resolved : _match;
      });
    }
  }
  return tree;
}

// ---------------------------------------------------------------------------
// Emit: tokens.css
// ---------------------------------------------------------------------------
function tokenToCssLines(path, token, opts) {
  const name = tokenName(path);
  const lines = [];
  if (isColorMixToken(token)) {
    if (opts.platform === 'web') {
      lines.push(`  ${name}-fallback: ${token.fallback};`);
      lines.push(`  ${name}: ${token.value};`);
    } else {
      lines.push(`  ${name}: ${token.fallback};`);
    }
  } else {
    lines.push(`  ${name}: ${token.value};`);
  }
  return lines;
}

function emitScope(selector, tree, comment) {
  const body = [];
  if (comment) body.push(`  /* ${comment} */`);
  for (const { path, token } of walkTokens(tree)) {
    if (path[0] === '_mode') continue;
    body.push(...tokenToCssLines(path, token, { platform: 'web' }));
  }
  return `${selector} {\n${body.join('\n')}\n}\n`;
}

function emitNoColorMixOverride(baseTree, modes) {
  const overrideLines = [];

  // Base tree fallbacks.
  for (const { path, token } of walkTokens(baseTree)) {
    if (isColorMixToken(token)) {
      overrideLines.push(`  ${tokenName(path)}: var(${tokenName(path)}-fallback);`);
    }
  }

  let css = `.no-color-mix {\n${overrideLines.join('\n')}\n}\n`;

  // Mode-specific fallbacks emitted as scoped overrides.
  for (const mode of modes) {
    if (mode.selector === ':root') continue;
    const lines = [];
    for (const { path, token } of walkTokens(mode.data)) {
      if (path[0] === '_mode') continue;
      if (isColorMixToken(token)) {
        lines.push(`  ${tokenName(path)}: var(${tokenName(path)}-fallback);`);
      }
    }
    if (lines.length > 0) {
      css += `\n.no-color-mix${mode.selector} {\n${lines.join('\n')}\n}\n`;
    }
  }

  return css;
}

async function buildCss(baseTree, modes) {
  const segments = [];
  segments.push('/* AUTO-GENERATED by @aisecretary/design-tokens — do not edit. */');
  segments.push('/* Source: packages/design-tokens/tokens/*.json (ADR-0002). */');
  segments.push('');

  segments.push(
    emitScope(':root', baseTree, 'Base tokens — light theme, default density, default motion.'),
  );

  for (const mode of modes) {
    if (mode.selector === ':root') continue;
    segments.push(emitScope(mode.selector, mode.data, `${mode.axis}: ${mode.name}`));
  }

  segments.push('/* color-mix() static fallback (per ADR-0002 §"Static fallback"). */');
  segments.push(emitNoColorMixOverride(baseTree, modes));

  // Auto-apply motion.reduced under the OS preference.
  const motionReduced = modes.find((m) => m.axis === 'motion' && m.name === 'reduced');
  if (motionReduced) {
    const motionReducedBlock = emitScope(
      ':root',
      motionReduced.data,
      'prefers-reduced-motion auto-applied',
    ).replace(':root {', ':root {');
    segments.push('@media (prefers-reduced-motion: reduce) {');
    segments.push(motionReducedBlock);
    segments.push('}');
  }

  await writeFile(resolve(BUILD_DIR, 'tokens.css'), `${segments.join('\n')}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Emit: tokens.tailwind.js
// ---------------------------------------------------------------------------
function tailwindThemeFromTree(tree) {
  const theme = {
    colors: {},
    spacing: {},
    borderRadius: {},
    fontFamily: {},
    fontSize: {},
    lineHeight: {},
    boxShadow: {},
    zIndex: {},
    transitionDuration: {},
    transitionTimingFunction: {},
  };

  for (const { path, token } of walkTokens(tree)) {
    if (path[0] === '_mode') continue;
    const head = path[0];
    const tail = path.slice(1).join('-');
    const value = isColorMixToken(token)
      ? `var(${tokenName(path)}, ${token.fallback})`
      : token.value;

    switch (head) {
      case 'color':
        theme.colors[tail] = `var(${tokenName(path)})`;
        break;
      case 'space':
        theme.spacing[tail] = value;
        break;
      case 'radius':
        theme.borderRadius[tail] = value;
        break;
      case 'font':
        theme.fontFamily[tail] = String(value)
          .split(',')
          .map((s) => s.trim());
        break;
      case 'text':
        theme.fontSize[tail] = value;
        break;
      case 'leading':
        theme.lineHeight[tail] = value;
        break;
      case 'shadow':
        theme.boxShadow[tail] = value;
        break;
      case 'z':
        theme.zIndex[tail] = String(value);
        break;
      case 'motion':
        theme.transitionDuration[tail] = value;
        break;
      case 'easing':
        theme.transitionTimingFunction[tail] = value;
        break;
      default:
        break;
    }
  }

  return theme;
}

async function buildTailwind(baseTree) {
  const theme = tailwindThemeFromTree(baseTree);
  const out = [
    '/* AUTO-GENERATED by @aisecretary/design-tokens — do not edit. */',
    '/* Tailwind theme extension consumed via apps/web/tailwind.config.ts. */',
    '',
    `module.exports = ${JSON.stringify(theme, null, 2)};`,
    '',
  ].join('\n');
  await writeFile(resolve(BUILD_DIR, 'tokens.tailwind.js'), out, 'utf8');
}

// ---------------------------------------------------------------------------
// Emit: tokens.native.ts (typed RN export)
// ---------------------------------------------------------------------------
function nativeTreeFromTree(tree) {
  const out = {};
  for (const { path, token } of walkTokens(tree)) {
    if (path[0] === '_mode') continue;
    let cursor = out;
    for (let i = 0; i < path.length - 1; i += 1) {
      const seg = path[i];
      if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
        cursor[seg] = {};
      }
      cursor = cursor[seg];
    }
    const last = path[path.length - 1];
    cursor[last] = isColorMixToken(token) ? token.fallback : token.value;
  }
  return out;
}

function stringifyForTs(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
}

async function buildNative(baseTree, modes) {
  const base = nativeTreeFromTree(baseTree);
  const modeEntries = {};
  for (const mode of modes) {
    if (mode.selector === ':root') continue;
    const overlay = nativeTreeFromTree(mode.data);
    const axisKey = `${mode.axis}_${mode.name}`;
    modeEntries[axisKey] = overlay;
  }

  const out = [
    '/* AUTO-GENERATED by @aisecretary/design-tokens — do not edit. */',
    '/* Source: packages/design-tokens/tokens/*.json (ADR-0002). */',
    '/* RN consumes only fallback values — color-mix() is unsupported. */',
    '',
    `export const tokens = ${stringifyForTs(base)} as const;`,
    '',
    `export const modes = ${stringifyForTs(modeEntries)} as const;`,
    '',
    'export type Tokens = typeof tokens;',
    'export type Modes = typeof modes;',
    '',
  ].join('\n');
  await writeFile(resolve(BUILD_DIR, 'tokens.native.ts'), out, 'utf8');
}

// ---------------------------------------------------------------------------
// Emit: tokens.contrast-report.json
// ---------------------------------------------------------------------------
function parseHex(hex) {
  const cleaned = hex.trim().replace(/^#/, '');
  if (![3, 6, 8].includes(cleaned.length)) return null;
  const expand = cleaned.length === 3 ? cleaned.replace(/(.)/g, '$1$1') : cleaned.slice(0, 6);
  const r = Number.parseInt(expand.slice(0, 2), 16);
  const g = Number.parseInt(expand.slice(2, 4), 16);
  const b = Number.parseInt(expand.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function relLum({ r, g, b }) {
  const linearize = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function ratio(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return 1;
  const lFg = relLum(fg);
  const lBg = relLum(bg);
  const a = Math.max(lFg, lBg);
  const b = Math.min(lFg, lBg);
  return (a + 0.05) / (b + 0.05);
}

function colorAt(tree, path) {
  let cursor = tree;
  for (const seg of path) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = cursor[seg];
  }
  if (cursor && typeof cursor === 'object' && 'value' in cursor) {
    return isColorMixToken(cursor) ? cursor.fallback : cursor.value;
  }
  return undefined;
}

function pairsForScope(tree, scopeName) {
  const definitions = [
    { fg: ['color', 'fg'], bg: ['color', 'bg'], kind: 'body' },
    { fg: ['color', 'fg-muted'], bg: ['color', 'bg'], kind: 'body' },
    { fg: ['color', 'fg'], bg: ['color', 'surface'], kind: 'body' },
    { fg: ['color', 'accent-fg'], bg: ['color', 'accent'], kind: 'body' },
    { fg: ['color', 'accent'], bg: ['color', 'bg'], kind: 'body' },
    { fg: ['color', 'success'], bg: ['color', 'bg'], kind: 'body' },
    { fg: ['color', 'warning'], bg: ['color', 'bg'], kind: 'body' },
    { fg: ['color', 'danger'], bg: ['color', 'bg'], kind: 'body' },
    // `--color-border` is a decorative hairline (WCAG 1.4.11 Note 1 exempts
    // decorative elements). Interactive component boundaries (input/checkbox/
    // button outlines) will land as `--color-border-strong` and re-enter this
    // list with kind: 'non-text' when Phase 1 surfaces them.
  ];

  const out = [];
  for (const def of definitions) {
    const fgValue = colorAt(tree, def.fg);
    const bgValue = colorAt(tree, def.bg);
    if (typeof fgValue !== 'string' || typeof bgValue !== 'string') continue;
    out.push({
      fg: tokenName(def.fg),
      bg: tokenName(def.bg),
      fgValue,
      bgValue,
      ratio: Number(ratio(fgValue, bgValue).toFixed(2)),
      kind: def.kind,
      scope: scopeName,
    });
  }
  return out;
}

function mergeTrees(base, overlay) {
  const out = JSON.parse(JSON.stringify(base));
  const apply = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (key === '_mode') continue;
      if (value && typeof value === 'object' && !('value' in value)) {
        if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
        apply(target[key], value);
      } else {
        target[key] = value;
      }
    }
  };
  apply(out, overlay);
  return out;
}

async function buildContrastReport(baseTree, modes) {
  const pairs = [...pairsForScope(baseTree, ':root')];
  for (const mode of modes) {
    if (mode.axis !== 'theme') continue; // Contrast only varies meaningfully per theme.
    if (mode.selector === ':root') continue;
    const merged = mergeTrees(baseTree, mode.data);
    pairs.push(...pairsForScope(merged, mode.selector));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pairs,
  };
  await writeFile(
    resolve(BUILD_DIR, 'tokens.contrast-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// Drive the build.
// ---------------------------------------------------------------------------
async function main() {
  await mkdir(BUILD_DIR, { recursive: true });

  const baseRaw = await loadBaseTokens();
  const baseTree = resolveRefs(baseRaw);
  const modes = await listModes();

  await Promise.all([
    buildCss(baseTree, modes),
    buildTailwind(baseTree),
    buildNative(baseTree, modes),
    buildContrastReport(baseTree, modes),
  ]);

  process.stdout.write('[design-tokens] build complete → packages/design-tokens/build/\n');
}

main().catch((err) => {
  process.stderr.write(`[design-tokens] build failed: ${err.stack ?? err.message}\n`);
  process.exit(1);
});
