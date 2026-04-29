# Project Instructions — AI Secretary System

## Product Overview

AI Secretary is a Meeting Intelligence & Decision Platform. It captures meetings (in-person via mobile/web, online via Zoom/Teams bots), transcribes them, runs vertical-specific AI analysis (sales, HR, education, medical, support, PM, psychology, general), and exposes everything through a searchable, RAG-chattable knowledge base. Multi-tenant SaaS with customer-owned-cloud and on-prem deployment topologies.

**Architecture source of truth:** [`docs/architecture.md`](docs/architecture.md). When in doubt, that's the contract.

## Tech Stack

### Backend (`apps/api`, `apps/workers`, `apps/bot`)
- **Runtime:** Node.js 22 LTS, TypeScript 5.6+ strict, ESM
- **API framework:** Fastify 5
- **DB:** PostgreSQL 16 + Drizzle ORM + pgvector (HNSW)
- **Queue:** pg-boss (Postgres-native) — no separate broker
- **Auth:** Argon2id (`@node-rs/argon2`) + JWT + Redis-backed refresh tokens
- **Validation:** zod everywhere — schemas live in `packages/shared/src/schemas`

### Frontend (`apps/web`, `apps/mobile`)
- **Web:** React 19 + Vite 6 + shadcn/ui + Tailwind + vite-plugin-pwa
- **Mobile:** Expo SDK 52+ (React Native) + Expo Router
- **State:** React Query (server) + Zustand (client)
- **Routing (web):** TanStack Router (type-safe, file-based)
- **Forms:** react-hook-form + zod resolver
- **i18n:** i18next + react-i18next

### Infrastructure
- **Hosting:** Railway (control plane + US data plane); Railway eu-west for EU data plane
- **Container:** Docker (Railway, customer-cloud, on-prem all reuse same images)
- **Storage:** S3 default; abstraction supports Azure Blob + GCS + MinIO (on-prem)
- **CI/CD:** GitHub Actions
- **Observability:** pino → Grafana Cloud (Loki + Tempo + Mimir); Sentry for errors; PostHog for analytics + flags

### AI Layer
- **LLM gateway** (`packages/llm-gateway`): Anthropic default + OpenAI ZDR + Azure OpenAI + Ollama (local). Per-tenant compliance-posture routing.
- **Transcription** (`packages/transcription`): OpenAI Whisper API + self-hosted faster-whisper. Per-tenant engine routing.
- **Embeddings:** `text-embedding-3-small` (US tenants via Azure for HIPAA); Voyage / bge-m3 self-hosted (EU + medical tenants).

## Architectural Hard Rules

### Multi-tenancy & region
- Every tenant-scoped table has `tenant_id UUID NOT NULL` with RLS enforcing `tenant_id = current_setting('app.current_tenant_id')::uuid`.
- Tenant is region-pinned. Subdomain `{tenant}.us.aisecretary.app` or `.eu.aisecretary.app` routes to that region's full stack.
- Tenant + region context propagation: `apps/api/src/plugins/tenant-context.ts` (HTTP) and `apps/workers/src/lib/job-context.ts` (queue). Every job payload carries `tenantId` and `region`.
- **Never** read `tenantId` from request body or query params. Always from auth context.

### Provider abstraction discipline
- LLM SDKs imported only inside `packages/llm-gateway`
- S3/Blob/GCS SDKs imported only inside `packages/storage`
- Whisper / faster-whisper clients only inside `packages/transcription`
- DB queries only inside `packages/db` and through its exported helpers
- Violations are CI failures (Biome rule + grep check)

### Module = config, not code
- Vertical analysis modules (sales, HR, medical, etc.) live in `packages/modules/src/<vertical>.ts` as **configs** (prompt + output schema + scoring rules), not custom code paths.
- Adding a new vertical = author one config file. No platform deploy.

### Compliance posture routing
- Medical / behavioral-health tenants → Anthropic via AWS Bedrock (BAA) for chat; Azure OpenAI HIPAA-eligible as fallback; embeddings via Azure OpenAI (BAA) or self-hosted.
- EU tenants → Anthropic via AWS-EU; Voyage AI or self-hosted bge-m3 for embeddings; storage stays in eu-west-1.
- Configured per-tenant in `tenant_entitlements`; gateway honors at every call.

### Audit log
- Every state-changing operation passes through the `audit-logger` plugin → immutable `audit_logs` table.
- Never `auditLogs.insert(...)` from a route handler — use the plugin.
- New audit actions: add to the union type in `apps/api/src/lib/audit-types.ts` (TS build fails otherwise).

### Consent & disclosure
- Pre-recording UI modal with org-configurable disclosure + acknowledgment checkbox.
- Bot meetings: TTS disclosure on join + chat post + per-participant timestamp record.
- Recording without `consents` row = `consent-check` plugin returns 403.

## Coding Conventions

### Naming
- DB: `snake_case` plural tables, `snake_case` columns, FK `<singular>_id`, indexes `idx_<table>_<cols>`
- API: plural REST resources, `:id` path params, `camelCase` query params, RFC 7807 errors
- TS: `camelCase` vars/functions, `PascalCase` types/components (no `I` prefix), `SCREAMING_SNAKE_CASE` constants
- Files: `PascalCase.tsx` for React components, `kebab-case.ts` everywhere else, hooks `use-*.ts`, tests co-located `*.test.ts`

### Format
- API success responses: no envelope wrapper. Direct entity for single, `{items, nextCursor, totalCount}` for collections.
- API errors: RFC 7807 Problem Details with `requestId`
- JSON keys: `camelCase` (translation from DB snake_case happens in service layer)
- Dates: ISO 8601 UTC strings only
- IDs: UUID v4 strings
- Pagination: cursor-based base64 only; no offset

### Error handling
- Use `HttpError` class hierarchy (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `RateLimitError`)
- Fastify `setErrorHandler` converts to RFC 7807
- Unknown errors → 500 with safe message; full detail in logs only

### Testing
- Co-located unit tests (`*.test.ts`); E2E in repo-root `e2e/` (Playwright)
- Vitest everywhere — no Jest

### Logging
- pino structured JSON; every log carries `requestId`, `tenantId`, `userId`
- Never log: passwords, JWTs, raw audio, full transcripts (use meeting ID), API keys

### Migrations
- Drizzle Kit, in `packages/db/migrations/`
- Filename: `YYYYMMDDHHMM_<verb>_<noun>.sql`
- Forward-only — no down migrations
- Default transactional; suffix `_no_tx.sql` for `CREATE INDEX CONCURRENTLY` etc.

## Anti-Patterns (don't do these)

- ❌ `tenantId` from `req.body` or query params
- ❌ Direct provider SDK imports outside their abstraction package
- ❌ Hardcoded provider URLs / endpoints anywhere
- ❌ `any` types (use `unknown` + narrow)
- ❌ DB queries returning snake_case keys to frontend (translate in service layer)
- ❌ Throwing strings or plain `Error` from route handlers (use `HttpError`)
- ❌ `console.log` in production code paths (Biome blocks; use logger)
- ❌ `useEffect` for data fetching (use React Query)
- ❌ Inline styles or styled-components (use Tailwind via shadcn)
- ❌ Date arithmetic with native `Date` (use `date-fns` or Temporal)
- ❌ Skipping audit-logger plugin for state-changing ops
- ❌ Editing `architecture.md` without recording an ADR in `docs/decisions/`

## Common Pitfalls

1. **Role confusion** — `tenant_members.role = 'admin'` (org-level) is NOT the same as `users.role = 'super_admin'` (platform-level). API admin checks happen on the latter.
2. **Region context** — workers MUST set `app.current_region` from job payload before querying; cross-region writes silently fail under RLS.
3. **Embedding dimension swap** — different models have different dimensions. Use `embeddings_<dim>` tables, not a single `embeddings` table.
4. **Stripe → entitlements** — `customer.subscription.*` webhooks update `tenant_entitlements` transactionally. Don't compute entitlements from Stripe API at request time.
5. **Bot service credentials** — Zoom Server-to-Server OAuth + Teams app-only Graph creds. Per-region. Don't mix regions.

## Where Things Live

- **Architecture decisions:** [`docs/architecture.md`](docs/architecture.md)
- **Product spec:** [`docs/mini-prd.md`](docs/mini-prd.md)
- **Original brief:** [`docs/input-spec.md`](docs/input-spec.md)
- **ADRs (deviations):** [`docs/decisions/`](docs/decisions/)
- **Compliance docs:** [`docs/compliance/`](docs/compliance/)
- **Runbooks:** [`docs/runbook/`](docs/runbook/)

## Important People

- **Anthony** — Owner / lead architect. Based in Arizona.
- **Winston** — BMAD architect agent who facilitated the architecture decisions (2026-04-29). Architecture document reflects collaborative decisions made during that session.

## When working on this codebase

1. **Read [`docs/architecture.md`](docs/architecture.md) before any non-trivial change.**
2. **Run `pnpm typecheck && pnpm lint` before committing.**
3. **For deviations from architecture:** create an ADR at `docs/decisions/000N-<short-name>.md` first, then make the change.
4. **For new audit actions:** add to the union type in `apps/api/src/lib/audit-types.ts`.
5. **For new migrations:** include the corresponding RLS policy update in the same migration when the table is tenant-scoped.
6. **For new provider integrations:** they go in `packages/{llm-gateway,transcription,storage}` — never in `apps/`.
