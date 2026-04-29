# AI Secretary — Project Context (BMAD)

This file is auto-loaded by BMAD agents. It complements `CLAUDE.md` (which Claude Code reads directly) by capturing project-specific patterns that BMAD agents need to honor across workflows.

## Identity

- **Project name:** AI Secretary System
- **Repo:** `~/ai-secretary/`
- **Owner:** Anthony (Arizona, USA)
- **Started:** 2026-04-29
- **Architecture authored by:** Winston (BMAD architect agent) — see `docs/architecture.md`

## Communication preferences

- **Skill level:** intermediate-to-advanced TypeScript engineer
- **Speed preference:** AI-pace; do not invoke "phased delivery" framing — this codebase is built with AI assistance and ships features in parallel
- **Decision style:** prefers strong recommendations + rationale, then accept/override; dislikes question-by-question elicitation

## Critical AI-agent rules (must follow)

### Context propagation
- **Never** read `tenantId` from request body or query params
- Always set `app.current_tenant_id` and `app.current_region` on the DB session before tenant-scoped queries
- Worker job payloads carry `{tenantId, userId, region, data, metadata}` — set context from payload before any DB call

### Provider abstraction (zero tolerance for violations)
- LLM SDKs (`@anthropic-ai/sdk`, `openai`, etc.) imported only inside `packages/llm-gateway`
- S3/Azure/GCS SDKs imported only inside `packages/storage`
- Whisper/transcription clients only inside `packages/transcription`
- Direct DB clients only inside `packages/db`

### Module = config rule
- Vertical analysis modules (`packages/modules/src/*.ts`) are **data configs** with prompt + output schema + scoring rules
- Adding a 9th vertical = one config file PR; never touch the runner code in `apps/workers/src/handlers/run-module.ts`

### Compliance routing
- Medical/BH tenants: chat via Anthropic-on-Bedrock; embeddings via Azure OpenAI (BAA) or self-hosted
- EU tenants: Anthropic via AWS-EU; Voyage AI or bge-m3 self-hosted for embeddings
- Encoded in `packages/llm-gateway/src/gateway.ts` routing matrix

## Language & framework specifics

### TypeScript
- 5.6+ strict, ESM (`"type": "module"`), Node 22 LTS
- `import type` for type-only imports (Biome enforces)
- No `any`; use `unknown` + narrow

### Fastify (api / bot)
- Plugin order matters: `tenant-context` first, then `auth`, then route plugins
- Use `setErrorHandler` for global RFC 7807 conversion
- Use `@fastify/zod` (or equivalent) for schema-validated routes that auto-generate OpenAPI

### Drizzle (db)
- Schema files in `packages/db/src/schema/`, one file per table
- Migrations forward-only in `packages/db/migrations/`
- Every tenant-scoped table needs a paired RLS policy in `packages/db/rls/`

### React (web)
- React Query owns server state (no `useEffect` for data)
- Zustand for client state, feature-scoped stores
- TanStack Router for routing
- shadcn/ui primitives + Tailwind classes (no inline styles, no styled-components)

### Expo (mobile)
- Expo Router file-based; layout-route hierarchy matches web feature layout where reasonable
- Recording via `expo-audio` (not `expo-av`)
- Background sync via `expo-task-manager` + `expo-background-fetch`

## Testing & quality

- **Unit tests:** Vitest, co-located (`*.test.ts`)
- **E2E:** Playwright at repo root `e2e/`
- **Pre-commit:** `pnpm typecheck && pnpm lint`
- **CI:** typecheck + lint + test on PR; build + deploy on `main` merge
- **Custom CI guard:** `apps/api/src/scripts/check-audit-coverage.ts` — fails if state-changing endpoints lack audit-logger calls

## Anti-patterns (refuse to write code matching these)

- Direct SDK imports outside abstraction packages
- `tenantId` from request body
- Hardcoded provider URLs
- `any` type
- snake_case keys leaking into API responses
- `console.log` in production paths
- `useEffect` for data fetching
- Inline styles
- Plain `Error` thrown from route handlers
- Missing audit-log calls for state-changing operations

## Decision deviation protocol

If implementation requires deviating from `docs/architecture.md`:

1. Create `docs/decisions/000N-<short-name>.md` from the template at `0001-template.md`
2. Document: context, decision, consequences, alternatives considered
3. Reference the ADR ID in the PR description and inline at the deviation point
4. Update architecture.md only after the ADR is merged

## Frequently-needed file locations

| Need | Location |
|---|---|
| Add new schema | `packages/db/src/schema/<table>.ts` + migration + RLS policy |
| Add new API route | `apps/api/src/routes/<resource>.ts` + zod schema in `packages/shared` |
| Add new worker job | `apps/workers/src/handlers/<job>.ts` + register in `pipeline.ts` |
| Add new vertical module | `packages/modules/src/<name>.ts` (config only) |
| Add new audit action | `apps/api/src/lib/audit-types.ts` union + use plugin |
| Add new provider | `packages/{llm-gateway,transcription,storage}/src/providers/<name>.ts` + register in gateway |
| Add new web route | `apps/web/src/routes/<path>.tsx` (TanStack Router file-based) |
| Add new mobile screen | `apps/mobile/src/app/<path>.tsx` (Expo Router file-based) |

## When in doubt

`docs/architecture.md` is the source of truth. If something is unspecified, ask before improvising.
