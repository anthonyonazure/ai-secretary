# @aisecretary/notifications

Unified push + email delivery package. Owns Expo push notifications (mobile heartbeat / capture-at-risk alerts per arch-addendums § Heartbeat detection) and transactional email via Postmark / SES / SMTP. The single sanctioned location for email and push code paths — do not introduce parallel implementations elsewhere.

Introduced post-architecture in `_bmad-output/planning-artifacts/arch-addendums.md` § 5. See `CLAUDE.md` § Where Things Live (rule 6).

## Package surface

```ts
import {
  NotificationGateway,
  ExpoPushProvider,
  PostmarkProvider,
  SesProvider,
  SmtpProvider,
  createNotificationSendHandler,
  QUEUE_NAME,
  notificationRequestSchema,
} from '@aisecretary/notifications';
```

Source files:

- `src/types.ts` — provider-agnostic interfaces (`NotificationRequest`, `NotificationRecipient`, `NotificationPayload`, `ProviderResult`, repositories, resolvers).
- `src/schemas.ts` — zod schemas mirroring the type surface; parse all job payloads here.
- `src/gateway.ts` — `NotificationGateway` coordinator: dedup → opt-out → persistence → dispatch → audit.
- `src/dedup.ts` — payload hashing + 5-minute dedup-window key derivation.
- `src/audit.ts` — `AuditLogger` injection point + `NotificationAuditAction` union.
- `src/handler.ts` — pg-boss `notification.send` handler factory.
- `src/templates/{render,re-engagement,dsar,trial-reminder}.ts` — email template registry.
- `src/providers/{expo-push,postmark,ses,smtp}.ts` — provider adapters.
- `scripts/check-isolation.ts` — CI guard against banned-SDK imports outside the package.

## Provider isolation (CI)

`scripts/check-isolation.ts` greps the workspace for `expo-server-sdk`, `postmark`, `@aws-sdk/client-ses`, and `nodemailer` imports outside `packages/notifications/`. Run via:

```sh
pnpm --filter @aisecretary/notifications check:isolation
```

Wire into CI alongside `typecheck` + `lint`. The repo's `biome.json` does not currently use `noRestrictedImports`, matching the precedent set by `packages/llm-gateway`, `packages/storage`, `packages/transcription` (also grep-only at this point).

## Story 1.4 wiring (deferred)

Two consumer-side hookups are intentionally stubbed because Story 1.4 has not landed yet (`apps/api` is a placeholder):

1. **Tenant context** — the gateway accepts `tenantId: string` directly on `NotificationRequest`. Once `apps/api/src/plugins/tenant-context.ts` and `apps/workers/src/lib/job-context.ts` exist, replace explicit plumbing with the ALS / Postgres-setting reader. TODO markers in `gateway.ts` + `handler.ts`.
2. **Audit logger** — `NotificationGatewayDeps.auditLogger` defaults to a no-op. Story 1.4 will inject a real `AuditLogger` backed by the `audit-logger` plugin and the `audit_logs` table. The `NotificationAuditAction` union in `audit.ts` should be merged into `apps/api/src/lib/audit-types.ts` once that file lands. TODO markers in `audit.ts` + `gateway.ts`.

## Storybook

The Story 1.10 AC includes "Storybook stories for the email-template renderer at three density × three motion modes". `apps/web/.storybook/main.ts` globs only `../src/**/*.stories.@(ts|tsx|mdx)` — story files at `packages/notifications/src/templates/*.stories.tsx` are NOT picked up by the current config.

Per the Story 1.10 hard scope rules, `apps/web` is reserved for the sibling Story 4.2 agent and we do not modify `.storybook/main.ts` here. Stories are deferred to a follow-up task that owns updating the Storybook glob and authoring the density × motion matrix; the renderer is fully unit-tested via `src/templates/render.test.ts` in the meantime.

To wire stories from a future task:

1. Extend `apps/web/.storybook/main.ts` `stories` glob to include `../../../packages/notifications/src/templates/**/*.stories.tsx`.
2. Author `re-engagement.stories.tsx`, `dsar.stories.tsx`, `trial-reminder.stories.tsx` rendering the `RenderedEmail` HTML inside an iframe with `density-{dense,relaxed,accessible}` × `motion-{default,gentle,reduced}` variants, hosted via `@storybook/addon-themes`.

## Migration + RLS

Schema lives in `packages/db`:

- `packages/db/src/schema/notifications.ts` — `notifications` + `user_preferences` Drizzle tables.
- `packages/db/migrations/202604291700_create_notifications.sql` — CREATE TABLE + indexes.
- `packages/db/rls/0002_rls_notifications.sql` — `tenant_id = current_tenant_id()` policies.
