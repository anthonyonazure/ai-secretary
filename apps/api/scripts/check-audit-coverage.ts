#!/usr/bin/env tsx
/**
 * Audit-coverage CI gate.
 *
 * Story 1.4 AC: "apps/api/scripts/check-audit-coverage.ts CI gate fails
 * when a tagged endpoint lacks audit-log coverage".
 *
 * Walks every TS source file under `apps/api/src/routes/` with the
 * TypeScript compiler API and looks for Fastify route registrations
 * (`fastify.<method>(...)`, `fastify.route({ method: ... })`). For every
 * non-GET route, asserts that one of:
 *
 *   - `config.auditTags` is set on the route options
 *   - the handler body invokes `request.audit(...)` somewhere
 *
 * Exits 1 with a list of offenders if anything is uncovered. Exits 0
 * otherwise. Wired into CI by `pnpm --filter @aisecretary/api
 * check:audit-coverage`.
 *
 * Running standalone:
 *   pnpm --filter @aisecretary/api check:audit-coverage
 *   tsx apps/api/scripts/check-audit-coverage.ts [routesDir]
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SELF_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = resolve(SELF_DIR, '..');
const DEFAULT_ROUTES_DIR = resolve(APP_ROOT, 'src', 'routes');

const FASTIFY_HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'all',
]);

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface RouteFinding {
  file: string;
  line: number;
  method: string;
  url: string;
  hasAuditTags: boolean;
  hasManualAudit: boolean;
  /**
   * Route opted out of the gate via `config.skipAudit: true`. Honored
   * for routes that are state-changing in HTTP terms (POST/PUT/PATCH/
   * DELETE) but don't change tenant-scoped state (e.g. /auth/login).
   * The runtime audit-logger plugin doesn't read this — only the
   * walker.
   */
  skipAudit: boolean;
}

const walk = async (dir: string, out: string[] = []): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
};

/** Extract a string literal from a node, including template literals with no expressions. */
const readStringLiteral = (node: ts.Node | undefined): string | null => {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
};

/** Look up a property in an object literal by name, returning the value node. */
const findProperty = (obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  for (const p of obj.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      ((ts.isIdentifier(p.name) && p.name.text === name) ||
        (ts.isStringLiteralLike(p.name) && p.name.text === name))
    ) {
      return p.initializer;
    }
  }
  return undefined;
};

/** Returns true if any descendant invokes `request.audit(...)`. */
const hasManualAuditCall = (node: ts.Node): boolean => {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.name) &&
      n.expression.name.text === 'audit'
    ) {
      const obj = n.expression.expression;
      if (
        (ts.isIdentifier(obj) && (obj.text === 'request' || obj.text === 'req')) ||
        (ts.isPropertyAccessExpression(obj) && obj.name.text === 'request')
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
};

/** Walk the route-options object literal to discover `auditTags`. */
const optionsHasAuditTags = (options: ts.Expression | undefined): boolean => {
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const config = findProperty(options, 'config');
  if (!config) return false;
  if (!ts.isObjectLiteralExpression(config)) return false;
  const tags = findProperty(config, 'auditTags');
  if (!tags) return false;
  return ts.isArrayLiteralExpression(tags) && tags.elements.length > 0;
};

/** Walk the route-options object literal to discover `config.skipAudit: true`. */
const optionsHasSkipAudit = (options: ts.Expression | undefined): boolean => {
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const config = findProperty(options, 'config');
  if (!config) return false;
  if (!ts.isObjectLiteralExpression(config)) return false;
  const skip = findProperty(config, 'skipAudit');
  if (!skip) return false;
  return skip.kind === ts.SyntaxKind.TrueKeyword;
};

const analyzeFile = (file: string, source: ts.SourceFile): RouteFinding[] => {
  const findings: RouteFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text.toLowerCase();
      const calleeName = ts.isIdentifier(node.expression.expression)
        ? node.expression.expression.text
        : undefined;
      // Match `fastify.METHOD(...)` and aliases (`app`, `instance`, `f`, `server`).
      const isFastifyAlias =
        calleeName !== undefined &&
        ['fastify', 'app', 'instance', 'f', 'server'].includes(calleeName);

      if (isFastifyAlias && methodName === 'route' && node.arguments.length >= 1) {
        const optsArg = node.arguments[0];
        if (optsArg && ts.isObjectLiteralExpression(optsArg)) {
          const methodNode = findProperty(optsArg, 'method');
          const urlNode = findProperty(optsArg, 'url');
          const handlerNode = findProperty(optsArg, 'handler');
          const method = readStringLiteral(methodNode)?.toUpperCase() ?? 'UNKNOWN';
          const url = readStringLiteral(urlNode) ?? '<dynamic>';
          const hasAuditTags = optionsHasAuditTags(optsArg);
          const skipAudit = optionsHasSkipAudit(optsArg);
          const hasManualAudit = handlerNode ? hasManualAuditCall(handlerNode) : false;
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          findings.push({ file, line, method, url, hasAuditTags, hasManualAudit, skipAudit });
        }
      } else if (isFastifyAlias && FASTIFY_HTTP_METHODS.has(methodName)) {
        // Form: fastify.METHOD(url, [options], handler)
        const args = node.arguments;
        const urlArg = args[0];
        const url = readStringLiteral(urlArg) ?? '<dynamic>';
        let optsArg: ts.Expression | undefined;
        let handlerNode: ts.Expression | undefined;
        if (args.length === 2) {
          handlerNode = args[1];
        } else if (args.length >= 3) {
          optsArg = args[1];
          handlerNode = args[2];
        }
        const hasAuditTags = optionsHasAuditTags(optsArg);
        const skipAudit = optionsHasSkipAudit(optsArg);
        const hasManualAudit = handlerNode ? hasManualAuditCall(handlerNode) : false;
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        findings.push({
          file,
          line,
          method: methodName.toUpperCase(),
          url,
          hasAuditTags,
          hasManualAudit,
          skipAudit,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return findings;
};

const main = async (): Promise<void> => {
  const argDir = process.argv[2];
  const routesDir = argDir ? resolve(process.cwd(), argDir) : DEFAULT_ROUTES_DIR;

  const exists = await stat(routesDir).catch(() => null);
  if (!exists?.isDirectory()) {
    process.stdout.write(
      `[check-audit-coverage] no routes directory at ${routesDir} — nothing to check\n`,
    );
    process.exit(0);
  }

  const files = await walk(routesDir);
  if (files.length === 0) {
    process.stdout.write(`[check-audit-coverage] no route files under ${routesDir}\n`);
    process.exit(0);
  }

  const allFindings: RouteFinding[] = [];
  for (const file of files) {
    const sourceText = await readFileSafe(file);
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.ES2022, true);
    allFindings.push(...analyzeFile(file, source));
  }

  // A route is uncovered when it's state-changing (POST/PUT/PATCH/DELETE)
  // and has neither tag nor manual audit. UNKNOWN-method routes are also
  // flagged so we don't quietly miss coverage on a dynamic method value.
  // Routes that explicitly opt out via `config.skipAudit: true` are not
  // counted — see the FastifyContextConfig augmentation in
  // `apps/api/src/types/fastify.d.ts` for when this is appropriate.
  const offenders = allFindings.filter((r) => {
    if (r.method === 'GET' || r.method === 'HEAD' || r.method === 'OPTIONS') return false;
    if (r.skipAudit) return false;
    if (r.method === 'UNKNOWN') return true;
    if (!STATE_CHANGING_METHODS.has(r.method) && r.method !== 'ALL') return false;
    return !r.hasAuditTags && !r.hasManualAudit;
  });

  if (offenders.length === 0) {
    process.stdout.write(
      `[check-audit-coverage] OK — ${allFindings.length} route(s) scanned, all state-changing routes audit-covered\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `[check-audit-coverage] FAIL — ${offenders.length} state-changing route(s) without audit coverage:\n`,
  );
  for (const o of offenders) {
    const rel = relative(process.cwd(), o.file);
    process.stderr.write(
      `  ${rel}:${o.line}  ${o.method} ${o.url}  (no auditTags, no request.audit())\n`,
    );
  }
  process.stderr.write(
    `\nFix by adding either 'config: { auditTags: [...] }' on the route or 'await request.audit({...})' inside the handler.\n`,
  );
  process.exit(1);
};

const readFileSafe = async (file: string): Promise<string> => {
  const { readFile } = await import('node:fs/promises');
  return await readFile(file, 'utf8');
};

main().catch((err: unknown) => {
  process.stderr.write(`[check-audit-coverage] crashed: ${String(err)}\n`);
  process.exit(2);
});
