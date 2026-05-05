# Security Policy

## Supported versions

This repository is a portfolio project. There is no commercial product
and no SLA. The `main` branch reflects current state.

## Reporting a vulnerability

If you find a security issue in the code, please **do not open a public
GitHub issue**. Instead, use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue with steps to reproduce.

You should receive an acknowledgement within 7 days. Because this is a
portfolio project, I make no commitment to a specific fix timeline —
serious issues will be fixed and disclosed; lower-severity findings
may be documented in an issue and left for a future revision.

## Scope

In scope:

- Code in this repository (apps/ + packages/ + infra/).
- Demonstrably exploitable issues — not theoretical concerns about
  what *could* happen if the project were deployed without proper
  configuration. The compliance docs in [`docs/compliance/`](docs/compliance/)
  describe how the controls are intended to be used; deviation from
  those controls is operator responsibility.

Out of scope:

- The hypothetical hosted version (no production deployment exists for
  this portfolio repo).
- Issues in third-party dependencies — please report to the upstream.
  Dependabot keeps the dependency tree current.

## Defenses already in place

- **Provider-isolation CI gates** — prevent SDK leakage across the
  monorepo. See `pnpm --filter <pkg> check:isolation` per gateway
  package.
- **Multi-tenant isolation via Postgres RLS** — every tenant-scoped
  table has an enforced row-level security policy. See
  [`packages/db/rls/`](packages/db/rls/).
- **Append-only audit log immutable at the SQL level** — REVOKE on
  UPDATE + DELETE for `app_role`. See
  [`packages/db/migrations/202604291800_create_audit_logs.sql`](packages/db/migrations/).
- **AES-256-GCM envelope encryption with rotatable KEK** for at-rest
  secrets. See
  [`packages/db/src/lib/envelope-encryption.ts`](packages/db/src/lib/envelope-encryption.ts).
- **STRIDE threat model** — see
  [`docs/compliance/threat-model.md`](docs/compliance/threat-model.md).

## Supply-chain integrity

- `pnpm-lock.yaml` is committed. CI installs use `--frozen-lockfile`.
- CodeQL static analysis runs on every push + weekly via
  [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml).
- Dependabot alerts + secret scanning are enabled on the GitHub repo
  (Settings → Code security).
