<p align="center">
  <img src="docs/media/illustrations/hero.svg" alt="AI Secretary — meeting intelligence + decision platform" width="100%">
</p>

# AI Secretary

> Meeting Intelligence & Decision Platform. Captures meetings (in-person via mobile/web, online via Zoom/Teams bots), transcribes them, runs vertical-specific AI analysis (sales, HR, education, medical, support, PM, psychology, general), and exposes everything through a searchable, RAG-chattable knowledge base. Multi-tenant SaaS with HIPAA + GDPR + SOC 2 controls baked into the architecture.

![tests](https://img.shields.io/badge/tests-1700%2B%20passing-brightgreen)
![packages](https://img.shields.io/badge/packages-19-blue)
![compliance](https://img.shields.io/badge/compliance-HIPAA%20%7C%20GDPR%20%7C%20SOC%202-purple)
![license](https://img.shields.io/badge/license-MIT-blue)

## What this is

A portfolio-grade reference implementation of a regulated B2B SaaS
platform. The codebase ships:

- A locked **architecture contract** with 6 ADRs — every architectural
  deviation recorded.
- **1700+ automated tests** across 19 packages — every state-changing
  route, every queue handler, every provider abstraction.
- **Provider-isolation CI gates** that prevent SDK leakage across the
  monorepo (LLM SDKs only inside `packages/llm-gateway`, CRM SDKs only
  inside `packages/crm`, etc.).
- A **multi-tenant data plane** with row-level security on every
  tenant-scoped table, region pinning enforced at the database layer
  via trigger, and append-only audit log immutable at the SQL level.
- A **per-tenant compliance posture matrix** that routes HIPAA tenants
  through AWS Bedrock + Azure OpenAI HIPAA, EU tenants through eu-west
  endpoints + Voyage AI embeddings.
- **Envelope-encrypted at-rest secrets** with rotatable Key Encryption
  Keys (KMS-style; one-line swap from the dev keyring to a real KMS).
- A **F5-CRM gateway** spanning HubSpot, Salesforce, and Pipedrive,
  with idempotent push, OAuth token rotation, and a Manifest V3 Chrome
  extension overlay.
- A **F2-admin tenant lifecycle FSM** with a blocking DPA + region-pin
  gate before any recording-pipeline mutation.
- A **real OAuth 2.0 + JWKS-verifying federated login** (Google +
  Microsoft) using `jose`.

## What this is not

This is a portfolio repository. **Operational concerns** — auditor
engagement, penetration testing, on-call rotation, customer-onboarding
collateral — are deliberately out of scope. The technical controls
that those processes would verify are real and verifiable in code.

## Architecture at a glance

```mermaid
flowchart TB
    classDef client fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#1e1b4b
    classDef edge   fill:#fafafa,stroke:#09090b,stroke-width:1.5px,color:#09090b
    classDef store  fill:#fef3c7,stroke:#a16207,stroke-width:1.5px,color:#451a03
    classDef worker fill:#fff,stroke:#09090b,stroke-width:1.5px,color:#09090b
    classDef gateway fill:#ede9fe,stroke:#6d28d9,stroke-width:1.5px,color:#3b0764

    Web[apps/web<br/>React 19 + Vite]:::client
    Mobile[apps/mobile<br/>Expo 52]:::client
    Ext[apps/extension<br/>Chrome MV3]:::client

    API[apps/api<br/>Fastify 5<br/>Argon2id + JWT + RLS context]:::edge

    PG[(Postgres 16<br/>+ pgvector + RLS)]:::store
    Redis[(Redis 7<br/>refresh tokens<br/>heartbeat keys)]:::store
    PgBoss[/pg-boss queues<br/>same Postgres/]:::store
    S3[(S3 / MinIO<br/>recordings + DSAR)]:::store

    Workers[apps/workers<br/>transcribe + summarize<br/>+ extract-action-items<br/>+ dsar.export + crm.push]:::worker
    Bot[apps/bot<br/>Zoom + Teams<br/>media bot]:::worker

    LLM[packages/llm-gateway<br/>Anthropic + OpenAI<br/>+ Azure + Bedrock + Ollama]:::gateway
    TR[packages/transcription<br/>Whisper API<br/>+ self-hosted faster-whisper]:::gateway
    CRM[packages/crm<br/>HubSpot + Salesforce<br/>+ Pipedrive]:::gateway
    NOTIF[packages/notifications<br/>Postmark + SES + Expo]:::gateway

    Web -.TLS 1.3.-> API
    Mobile -.TLS 1.3.-> API
    Ext -.TLS 1.3.-> API

    API --> PG
    API --> Redis
    API --> PgBoss
    API --> S3

    PgBoss --> Workers
    PgBoss --> Bot

    Workers --> LLM
    Workers --> TR
    Workers --> CRM
    Workers --> NOTIF
    Bot --> S3
```

Every gateway is isolated in its own workspace package; SDK imports
live there and only there, enforced by a CI grep gate. Adding a new
provider is a config + class addition, never a platform deploy.

More diagrams (sequence, FSMs, multi-tenant isolation, compliance
posture routing): [`docs/media/diagrams/architecture.md`](docs/media/diagrams/architecture.md).

## Documentation

| Topic | Where |
|---|---|
| Source of truth for technical decisions | [`docs/architecture.md`](docs/architecture.md) |
| Product scope + 8 verticals | [`docs/mini-prd.md`](docs/mini-prd.md) |
| 6 architecture-deviation ADRs | [`docs/decisions/`](docs/decisions/) |
| Compliance controls (HIPAA, GDPR, SOC 2) | [`docs/compliance/`](docs/compliance/) |
| Threat model (STRIDE) | [`docs/compliance/threat-model.md`](docs/compliance/threat-model.md) |
| DPA template | [`docs/compliance/dpa-template.md`](docs/compliance/dpa-template.md) |
| Customer-dev research synthesis | [`_bmad-output/research/`](_bmad-output/research/) |
| Designer brief (empty states + motion + hero) | [`_bmad-output/design/`](_bmad-output/design/) |
| UX design specification (14-step) | [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) |
| Convention guide for AI contributors | [`CLAUDE.md`](CLAUDE.md) |

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript 5.6 strict, ESM |
| API | Fastify 5 + zod 3 + drizzle-orm |
| DB | PostgreSQL 16 + pgvector (HNSW) + RLS |
| Queue | pg-boss (Postgres-native, same DB as data) |
| Auth | Argon2id passwords + JWT HS256 + MFA TOTP + OAuth 2.0 (Google + Microsoft) |
| Web | React 19 + Vite 6 + shadcn/ui + Tailwind + TanStack Router + React Query + Zustand |
| Mobile | Expo SDK 52 + React Native + Expo Router |
| Extension | Chrome Manifest V3 (vanilla TS — no bundler dependency) |
| LLM | Anthropic + OpenAI + Azure OpenAI + AWS Bedrock + Ollama (per-tenant compliance routing) |
| Transcription | OpenAI Whisper API + self-hosted faster-whisper |
| Storage | S3 + Azure Blob + GCS + MinIO (provider abstraction) |
| Email | Postmark + AWS SES + SMTP (provider abstraction) |
| Push | Expo + FCM |
| CRM | HubSpot + Salesforce + Pipedrive (provider abstraction) |
| Hosting | Railway (US + EU regions) |
| Observability | pino → Grafana Cloud (Loki + Tempo + Mimir) + Sentry + PostHog |
| Tooling | pnpm workspaces, Biome (lint + format), Vitest, Playwright, GitHub Actions |

## Repository layout

```
ai-secretary/
├── apps/
│   ├── api/           # Fastify HTTP server (control + data plane)
│   ├── bot/           # Zoom + Teams meeting-bot worker (pg-boss `bot.join`)
│   ├── workers/       # pg-boss workers (transcribe, summarize, extract-action-items,
│   │                  #                   dsar.export, crm.push, recording-watchdog, ...)
│   ├── web/           # React 19 + Vite SPA
│   ├── mobile/        # Expo / React Native
│   ├── extension/     # Chrome Manifest V3 (HubSpot / Salesforce / Pipedrive overlay)
│   └── admin/         # Internal admin console
├── packages/
│   ├── shared/        # zod wire contracts + helpers
│   ├── auth/          # Argon2id + JWT + Redis refresh-token store
│   ├── bot/           # Bot provider abstraction (Zoom + Teams + Mock)
│   ├── consent/       # Per-participant consent FSM + region detection
│   ├── crm/           # CRM gateway (HubSpot + Salesforce + Pipedrive + Mock)
│   ├── db/            # Drizzle schema + migrations + RLS + envelope encryption
│   ├── design-tokens/ # Style Dictionary tokens → CSS / Tailwind / RN
│   ├── llm-gateway/   # LLM gateway (Anthropic + OpenAI + Azure + Bedrock + Ollama + Mock)
│   ├── modules/       # 8 vertical analysis configs
│   ├── notifications/ # Email + push gateway (Postmark + SES + SMTP + Expo)
│   ├── storage/       # S3 + Azure + GCS + MinIO abstraction
│   └── transcription/ # Whisper API + faster-whisper abstraction
├── infra/
│   ├── docker/        # Per-app Dockerfiles + docker-compose.local.yml + Caddyfile
│   └── railway/       # Service definitions + region setup notes
├── docs/
│   ├── architecture.md  # Source of truth
│   ├── mini-prd.md      # Product spec
│   ├── decisions/       # 6 ADRs
│   ├── compliance/      # HIPAA + GDPR + SOC 2 + threat model + DPA template
│   └── runbook/         # Ops procedures
├── _bmad-output/
│   ├── planning-artifacts/  # UX spec, epics, readiness reports
│   ├── research/            # Customer-dev synthesis (5 personas)
│   └── design/              # Empty-state + motion + hero asset briefs
├── e2e/                     # Playwright cross-app golden paths
└── .github/workflows/       # Typecheck + lint + tests + provider-isolation gates
```

## Local development

### Quick start (no cloud accounts)

```bash
# 1. Boot the local stack (Postgres + Redis + MinIO).
docker compose -f infra/docker/docker-compose.local.yml up -d

# 2. Install workspace deps.
corepack enable && pnpm install

# 3. Build design tokens (apps/web's Tailwind theme depends on the artifact).
pnpm --filter @aisecretary/design-tokens build

# 4. Run the workspace gates.
pnpm typecheck
pnpm lint
pnpm test

# 5. Boot a dev API.
DATABASE_URL=postgres://aisecretary:aisecretary@localhost:5432/aisecretary \
REDIS_URL=redis://localhost:6379 \
S3_ENDPOINT=http://localhost:9000 S3_BUCKET=recordings S3_FORCE_PATH_STYLE=true \
AWS_ACCESS_KEY_ID=aisecretary AWS_SECRET_ACCESS_KEY=aisecretary \
pnpm --filter @aisecretary/api dev
```

### Test suite

```bash
pnpm test                                       # 1700+ tests across all packages
pnpm --filter @aisecretary/api test             # one package
pnpm --filter @aisecretary/api test -- --run crm  # one file
```

### Provider-isolation gates

```bash
pnpm --filter @aisecretary/llm-gateway check:isolation
pnpm --filter @aisecretary/transcription check:isolation
pnpm --filter @aisecretary/notifications check:isolation
pnpm --filter @aisecretary/crm check:isolation
pnpm --filter @aisecretary/bot check:isolation
```

### E2E

```bash
pnpm --filter @aisecretary/e2e test
```

## Deployment

The repository ships Railway-ready Dockerfiles for `api`, `bot`,
`workers`, and `web`. See [`infra/railway/services.json`](infra/railway/services.json)
for the full per-service env-var matrix.

```bash
docker build -f infra/docker/api.Dockerfile     -t aisecretary/api .
docker build -f infra/docker/bot.Dockerfile     -t aisecretary/bot .
docker build -f infra/docker/workers.Dockerfile -t aisecretary/workers .
docker build -f infra/docker/web.Dockerfile     -t aisecretary/web .
```

Per-service env contract: [`infra/railway/README.md`](infra/railway/README.md).

## Key design decisions

Every architectural deviation from the locked architecture document is
recorded as an ADR in [`docs/decisions/`](docs/decisions/):

| ADR | Topic | Status |
|---|---|---|
| 0002 | Style Dictionary as token build pipeline | ACCEPTED |
| 0003 | Server-side CRM gateway; Chrome extension is presentation only | PROPOSED (impl shipped) |
| 0004 | Tenant lifecycle FSM + blocking DPA / region pin | PROPOSED (partial impl) |
| 0005 | Per-participant consent model with diarization-aware exclusion | ACCEPTED |
| 0006 | Cross-tenant audit writes via tenant-scoped `inbound_shares` table | ACCEPTED |

## Compliance posture matrix

| Tenant type | LLM | Transcription | Storage | Push |
|---|---|---|---|---|
| US default | Anthropic direct | OpenAI Whisper | S3 us-east-1 | Expo push |
| HIPAA (US) | Anthropic via AWS Bedrock | self-hosted faster-whisper / Azure Speech | S3 us-east-1 (BAA) | (disabled) |
| EU default | Anthropic via Bedrock EU | self-hosted faster-whisper EU / Azure Speech EU | S3 eu-west-1 | Expo push |
| EU + medical | Bedrock EU | Azure Speech HIPAA + EU | S3 eu-west-1 (BAA + SCC) | (disabled) |

Routing is enforced in code:
[`packages/llm-gateway/src/selector.ts`](packages/llm-gateway/src/selector.ts)
+ [`packages/transcription/src/selector.ts`](packages/transcription/src/selector.ts).

## License

MIT — see [LICENSE](LICENSE).

This repository is a portfolio project by Anthony, hosted as part of
his University of Washington MSIM portfolio. It is not an active
commercial product.
