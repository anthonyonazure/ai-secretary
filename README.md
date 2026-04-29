# AI Secretary System

> Meeting Intelligence & Decision Platform — capture, transcribe, analyze, and search any meeting (in-person, Zoom, Teams) with vertical-specific AI analysis (sales, HR, education, medical, support, PM, psychology, general).

## Status

🏗️ **Architecture authored 2026-04-29** — workspace skeleton scaffolded, not yet implementing features. See [`docs/architecture.md`](docs/architecture.md) for the complete architecture.

## Documentation

- **[Architecture](docs/architecture.md)** — Source of truth for all technical decisions
- **[Product spec](docs/mini-prd.md)** — Locked-in scope and personas
- **[Original brief](docs/input-spec.md)** — Initial developer documentation
- **[ADRs](docs/decisions/)** — Architectural deviation records (use `0001-template.md` for new entries)
- **[Compliance](docs/compliance/)** — GDPR, HIPAA, audit-evidence templates
- **[Runbooks](docs/runbook/)** — Ops procedures
- **[CLAUDE.md](CLAUDE.md)** — Conventions for AI agent contributors
- **[project-context.md](project-context.md)** — BMAD-format project context

## Tech stack (summary)

- **Backend:** Node.js 22 + Fastify 5 + TypeScript + Drizzle + PostgreSQL 16 + pgvector + pg-boss + Redis
- **Web:** React 19 + Vite + shadcn/ui + TanStack Router + React Query + Zustand
- **Mobile:** Expo SDK 52+ (React Native) + Expo Router
- **AI:** Multi-provider LLM gateway (Anthropic + OpenAI ZDR + Azure OpenAI + Ollama); Whisper API + faster-whisper transcription
- **Infrastructure:** Railway (US + EU regions); Docker artifacts portable to customer-cloud / on-prem

## Repository layout

```
ai-secretary/
├── apps/
│   ├── api/           # Fastify control + data plane
│   ├── workers/       # pg-boss workers (transcription, summarization, analysis, ...)
│   ├── bot/           # Zoom + Teams meeting-bot worker
│   ├── web/           # React 19 + Vite + shadcn (PWA)
│   ├── mobile/        # Expo (React Native)
│   └── admin/         # Internal admin console
├── packages/
│   ├── shared/        # zod schemas, types
│   ├── llm-gateway/   # Multi-provider LLM abstraction
│   ├── transcription/ # Engine abstraction (Whisper API + faster-whisper)
│   ├── storage/       # S3 / Azure / GCS / MinIO abstraction
│   ├── db/            # Drizzle schema + migrations + RLS  ← scaffolded
│   ├── auth/          # Argon2 + JWT + Redis refresh
│   └── modules/       # 8 vertical analysis configs
├── infra/             # Railway, Docker, Helm, Terraform
├── docs/              # Architecture, PRD, ADRs, runbooks, compliance
├── e2e/               # Playwright cross-app
└── .github/workflows/ # CI/CD
```

## Getting started

> ⚠️ This is a freshly scaffolded repo. Most apps and packages are folder placeholders until their first implementation story. Currently scaffolded: **workspace tooling** + **`packages/db`** (schema for tenants/users/meetings + RLS + tenant-context helper).

### Prerequisites

- Node 22 LTS (`nvm install 22`)
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker (for local Postgres + Redis + MinIO + Ollama)

### First-time setup

```bash
pnpm install
cp .env.example .env  # fill in secrets
pnpm typecheck        # should pass on bare scaffold
```

### Implementation order (per architecture)

1. ✅ Workspace skeleton (root tooling)
2. ✅ `packages/db` skeleton — schema for `tenants`, `users`, `meetings` + RLS + tenant context
3. ⬜ `packages/db` — remaining schemas (recordings, transcripts, summaries, analyses, shares, audit_logs, consents, tenant_entitlements, retention_policies)
4. ⬜ `packages/auth` — Argon2 + JWT + Redis refresh
5. ⬜ `packages/storage` — S3 abstraction
6. ⬜ `packages/llm-gateway` — Anthropic provider first
7. ⬜ `apps/api` — Fastify boot + plugin stack + healthcheck
8. ⬜ `apps/workers` — pg-boss boot + transcription handler
9. ⬜ First end-to-end journey: J2 (upload existing audio → transcript → summary)

Then expand outward.

## License

UNLICENSED (private, all rights reserved). License decision pending.
