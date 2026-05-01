# HANDOFF — AI Secretary work in progress

**Last updated:** 2026-05-01 (Bot service stub + E2E suite shipped — 1659 tests across 17 packages passing)

## Next-session prompt (copy-paste this to launch)

> Resume the AI Secretary work. Read `HANDOFF.md` (top section) + `~/.claude/projects/-Users-anthony-ai-secretary/memory/MEMORY.md`. State as of 2026-05-01: 1659 tests across 17 packages, all green. **Bot service stub** is feature-complete inline (chunks 1–3.5): `packages/bot` provider abstraction + FSM + Mock/Zoom/Teams skeletons; `bot_sessions` table + RLS + Drizzle schema + repository + watchdog reader; `apps/bot` (renamed `@aisecretary/bot-service`) FSM-driven `bot.join` queue handler; `POST /api/v1/bot-sessions` endpoint; `RecordingsChunkUploadAudioSink` that streams bot-captured PCM into the existing recordings → transcribe → speaker_turns pipeline (same path mobile/web uploads use). **E2E suite** scaffolded: Playwright config + InMemory-stack fixture + signin→inbox→meeting golden-path spec, chromium + webkit, CI job wired. The remaining work is genuinely infrastructure-bound: (a) **real provider creds** — Anthropic, OpenAI, Whisper, Postmark/SES, Stripe, Nylas, Zoom, Teams, Expo Push, Bedrock, Voyage (Tier 1 alone gets a working US production environment). (b) **`apps/bot` production boot** — `apps/bot/src/index.ts` is currently re-exports only; needs the same `createDb` + `createBoss` + Redis + Postgres-audit + storage wiring `apps/workers` already has. ~80 lines once Tier 1 + Tier 3 creds land. (c) **production deploy bootstrap** — `buildProductionServer()` + Railway US/EU. (d) **real Zoom/Teams SDKs** — `@zoom/meetingsdk` + Microsoft Graph Communications inside `packages/bot/src/providers/{zoom,teams}.ts` (the multi-week build; isolation gate + cred-validating constructors already in place). (e) **GET endpoints** — `/api/v1/bot-sessions/:id` + paginated list (repository surface ready, just route + tests). (f) **web/mobile bot UI** — bot-status badge on meeting detail, invite-bot CTA; mobile already has `useBotStatusState`. Web meeting-detail still placeholder; E2E spec flagged it. (g) **designer assets** — 3 empty-state illustrations + 2 motion + 1 hero; UX research card-sort + customer-dev interviews. (h) **ADR promotion** — 0002–0006 PROPOSED in `arch-addendums.md`; the bot session FSM + cross-tenant audit pattern have now had first-implementation validation (ADR-0006 eligible for promotion). If continuing inline work, the highest-leverage moves are the GET endpoints + web meeting-detail page (closes the placeholder E2E flagged), or ADR promotion.

## Bot service stub + E2E suite quick log (2026-05-01)

Net 1569 → 1659 tests (+90) across 17 packages (+1 — `@aisecretary/bot`). Lint + typecheck clean. Provider-isolation + audit-coverage gates green throughout.

**E2E suite scaffolded** (parallel agent, 2026-05-01):
- `e2e/` workspace package (`@aisecretary/e2e`) — Playwright config (chromium + webkit headless, retries=2 in CI, `trace: on-first-retry`), Vitest-style spec layout.
- `e2e/fixtures/in-memory-stack.ts` — `startInMemoryStack()` boots the API via `buildServer()` against InMemory* repositories (auth, meetings, action-items, recordings) on a fixed port (default 4101, override via `E2E_API_PORT`). Real `InMemoryRefreshTokenStore`, fake `StorageProvider`. Seed helper goes through real `/auth/signup` then injects meetings + action items into the InMemory repo.
- `e2e/fixtures/playwright-fixtures.ts` — Vite worker-scoped (cold-starts are slow); API stack restarts per test (cheap; clean repo each test).
- `e2e/specs/inbox-to-action.spec.ts` (~45 lines) — golden-path: signin → inbox → open seeded meeting → My Actions. Uses sidebar-link navigation (not `page.goto`) because `SameSite=Lax` refresh cookies don't survive cross-origin POST after a hard reload.
- `.github/workflows/ci.yml` — new `e2e` job (`needs: typecheck`), installs chromium + webkit, uploads HTML report on failure.
- **Caveat from the agent's report:** the web `/meetings/:id` route is currently the `AnalysisCard` demo placeholder. Real transcript + action-items detail view exists on mobile (`app/meetings/[meetingId].tsx`) but the web equivalent is unbuilt. When that lands, extend the E2E spec to assert against `getByRole('list')` for transcript + action-items panel.

**Bot service stub — chunk 1: `packages/bot` provider abstraction (2026-05-01)** — 46 tests:
- `types.ts` — `BotProvider`, `BotSession`, `BotSource = 'zoom_bot' | 'teams_bot'`, `BotSessionStatus = 'provisioning' | 'joined' | 'ended' | 'failed'`, `BotJoinRequest/Result`, `BotAudioFrame`, `BotAudioListener`. Heartbeat constants matched to `apps/workers/src/handlers/bot-watchdog.ts` (key `bot:<sessionId>`, 30s emit / 90s TTL / 15s scan).
- `fsm.ts` — pure FSM. Valid transitions: `provisioning → joined → ended` (clean) or `provisioning|joined → failed`. `applyEvent()` returns a new session; `BotStateTransitionError` on illegal transitions. **21 tests** covering every legal + illegal transition.
- `errors.ts` — `BotError` base + `BotProviderUnavailableError`, `BotJoinTimeoutError`, `BotJoinRefusedError`, `BotConnectionLostError`, `BotStateTransitionError`.
- `providers/mock.ts` — `MockBotProvider` with scripted audio (defaults to 16kHz silence at 100ms cadence; override via `audioScript`), configurable join failure (`refused`/`timeout`), participant-roster injection, idempotent `leave()`. **13 tests** including listener-error isolation, unsubscribe idempotency, scripted-audio cycling.
- `providers/{zoom,teams}.ts` — cred-gated skeletons. Constructors validate config and throw `BotProviderUnavailableError` if any required field is missing. All `BotProvider` methods throw the same error tagged with the missing SDK binding name. The SDK imports themselves are intentionally absent; they go in this file when creds land.
- `factory.ts` + `selector.ts` — `selectBotProviderKind({ source, mode, forceMock? })` returns `'zoom'|'teams'|'mock'`; `createBotProvider({ kind, zoom?, teams?, mock? })` instantiates. Selector returns `'mock'` in dev/test mode regardless of source. **12 tests.**
- `scripts/check-isolation.ts` — CI grep gate banning `@zoom/meetingsdk`, `@zoom/videosdk`, `@microsoft/microsoft-graph-client`, `@azure/communication-*`, `botbuilder` outside `packages/bot/`. Wired into `.github/workflows/ci.yml`.
- Audit-action constants: `bot.session.provisioned/joined/ended/failed` exposed as `BOT_AUDIT_ACTIONS`.

**Bot service stub — chunk 2: `bot_sessions` migration + repository + watchdog wiring (2026-05-01)** — +15 tests:
- Migration `packages/db/migrations/202605010100_create_bot_sessions.sql` — `bot_sessions` table with `bot_source`, `bot_session_status`, `bot_region` enums; nullable `meeting_id`; never-returned `external_meeting_passcode`; three indexes shaped for the watchdog scan, per-meeting lookup, and owner's "my bot sessions" view.
- RLS `packages/db/rls/0016_rls_bot_sessions.sql` — strict tenant-isolation policy. Workers role with BYPASSRLS handles cross-tenant watchdog scan (same convention as `recording-watchdog-reader.ts`).
- Drizzle schema `packages/db/src/schema/bot-sessions.ts` — exports `botSessions`, `BotSessionRow`, `NewBotSessionRow`. Re-exported via `schema/index.ts`.
- Repository `apps/api/src/routes/bot-sessions-repository.ts` — `BotSessionsRepository` interface, `DrizzleBotSessionsRepository`, `InMemoryBotSessionsRepository`. CRUD: `create` / `findById` / `update` / `list` (cursor-paginated, filterable by `ownerUserId` + `meetingId`). FSM-agnostic — caller validates transitions via `applyEvent()`. Passcode never leaves the persistence layer. **14 tests** locking tenant isolation, deterministic id/clock injection, FSM-driven update semantics, cursor codec round-trip, malformed-cursor tolerance, ordering invariants.
- Watchdog reader `apps/workers/src/handlers/bot-watchdog-reader.ts` — `DrizzleBotWatchdogReader` cross-tenant scan. Mirrors `DrizzleRecordingWatchdogReader` exactly. No join needed since `region` is a column on `bot_sessions`. **1 contract-conformance test.**
- Audit-types extension `apps/api/src/lib/audit-types.ts` — `bot.session.provisioned/joined/ended/failed` added to both the `ApiAuditAction` union and the `AUDIT_ACTIONS` runtime list. Exhaustiveness assertion holds.
- Erasure-cascade entry `apps/api/src/lib/erasure-cascade.ts` — `bot_sessions` registered as `cascade` (FK CASCADE from tenants).

**Bot service stub — chunk 3: `apps/bot` worker producer + `POST /api/v1/bot-sessions` (2026-05-01)** — +17 tests:
- **Naming fix:** renamed `apps/bot` package `@aisecretary/bot` → `@aisecretary/bot-service` to free `@aisecretary/bot` for the runtime library (collision was my error in chunk 1).
- `apps/bot/src/handlers/bot-join.ts` — `createBotJoinHandler({...})` returning `(job, opts?) => Promise<void>`. Drives the full FSM: validates payload (zod), loads row, region sanity check, idempotency guards (terminal/joined → no-op, re-fire safe), provider selection + construction, `provider.join()` with three failure-isolation points (provider-construction / join / in-session) each transitioning to `failed` with the right `failureReason` and `metadata.stage`. Happy path opens audio sink, subscribes to provider audio, starts heartbeat publisher on `heartbeat:bot:<sessionId>`, waits for `sessionDurationMs` (4h default) or external `abortSignal`. Cleanup is best-effort and idempotent. Audit emits at every transition with `actorUserId = ownerUserId`. **12 tests.**
- `apps/bot/src/lib/audio-sink.ts` — `AudioSink` interface + `InMemoryAudioSink` for tests. `AudioSinkOpenInput` carries `sessionId`, `tenantId`, `meetingId`, `ownerUserId`, `region`.
- `apps/bot/src/lib/heartbeat-publisher.ts` — `HeartbeatPublisher` interface + `InMemoryHeartbeatPublisher`. Real Redis-SETEX impl ships when production boot wires up.
- `apps/api/src/routes/bot-sessions.ts` + `apps/api/src/lib/bot-join-enqueue.ts` — `POST /api/v1/bot-sessions` validates with zod, creates the row in `provisioning`, audits `bot.session.provisioned` via the `auditTags` route hook, enqueues the `bot.join` job. Passcode write-only. RFC 7807 `ValidationError` (422) on bad input. **5 tests** covering happy-path 201, write-only passcode, invalid-source 422, empty `externalMeetingId` 422, no-auth 401/403.
- Wire contract `packages/shared/src/schemas/bot-sessions.ts` — `createBotSessionRequestSchema`, `botSessionResponseSchema`, source/status/region enums.
- `apps/api/src/server.ts` wired the new route + `botSessionsRepository` + `botJoinEnqueuer` BuildServerOptions. Drizzle repo defaults when `dbHandle` is present; in-memory enqueuer otherwise.
- `InMemoryBotSessionsRepository.idFactory` defaults to `randomUUID()` so the response schema parse passes through the route layer.

**Bot service stub — chunk 3.5: audio sink integration (2026-05-01)** — +12 tests:
- Storage extension `packages/storage/src/types.ts` — added `uploadPart({ key, uploadId, partNumber, body, contentType? })` to `StorageProvider`. Server-side-direct path for long-running services. `presignPart` stays correct for client-side uploads. `S3StorageProvider` implements via `UploadPartCommand`. Existing `FakeStorageProvider` test fakes (recordings.test.ts + meetings.test.ts) updated with stub implementations.
- `apps/bot/src/lib/wav-encoder.ts` — `wavHeader({ sampleRate, channels, bitsPerSample, dataLength })` produces canonical 44-byte RIFF/WAVE/fmt/data header. `WAV_STREAMING_SIZE_SENTINEL = 0xFFFFFFFE` lets the bot prepend a header at part-1 time before total length is known; transcribe pipeline routes through ffmpeg before reaching engines, normalizing the sentinel away. **5 tests.**
- `apps/bot/src/lib/recordings-chunk-upload-audio-sink.ts` — `RecordingsChunkUploadAudioSink` implements `AudioSink`. `open()` mints `recordingId`, builds tenant-scoped key (`tenants/<tenantId>/recordings/<id>.wav`), creates multipart upload, persists recording row in `'uploading'`, seeds part 1 with the streaming WAV header. `write(frame)` appends PCM, flushes when buffer crosses `partThresholdBytes` (default 5 MiB — production-correct for S3's non-final-part minimum; tests pin tiny). `close()` flushes trailing buffer as final part (S3 allows last < 5 MB), completes multipart, transitions row to `'uploaded'`, enqueues the **same** `transcribe` job mobile/web uploads use. Failure paths abort + markFailed + rethrow. Idempotent close. Local-minimal `RecordingsSinkWriter` + `BotTranscribeEnqueuer` interfaces — concrete classes from apps/api satisfy structurally without an apps/api → apps/bot import. **7 tests.**
- **Producer + capture path is now end-to-end testable with mocks**: `POST /api/v1/bot-sessions` → `bot.join` handler → MockBotProvider joins → `RecordingsChunkUploadAudioSink` uploads chunked WAV → marks recording uploaded → enqueues `transcribe` → MockTranscriptionProvider produces speaker_turns → existing `summarize` + `extract-action-items` chain runs. All without touching real Anthropic, OpenAI, Whisper, Zoom, Teams, or S3.

## Open architectural decisions remembered for next session

- **Bot audio sink** (greenlit by Anthony 2026-05-01): bot-captured PCM frames flow into the existing `recordings` chunk-upload pipeline. Same transcribe path as mobile/web. `RecordingsChunkUploadAudioSink` is the impl.
- **Bot job source** (greenlit by Anthony 2026-05-01): `bot.join` jobs come from explicit user action (web/mobile "invite bot" CTA → `POST /api/v1/bot-sessions`). Calendar-auto-queue is a future enhancement, not in the stub.
- **`apps/bot` → `apps/bot-service` package rename**: `@aisecretary/bot` is the runtime library in `packages/bot`; `@aisecretary/bot-service` is the worker process in `apps/bot`.

## Phase 1 inline-shipping pass quick log (2026-04-30 → 2026-05-01)

Net 999 → 1569 tests (+570) across 16 packages. Lint + typecheck clean throughout. Two-day inline-shipping pass after the Phase 1 cuts 1–12 baseline.

**API repository unit tests (2026-05-01) — 100% in-memory repository coverage.** 107 new tests across shares (18) / inbound-shares (7) / cross-org-policy (11) / audit-export (7) / feedback (6) / erasure-preview (6) / action-items (11) / dsar-portal (11) / search (10) / meetings (12) / tenant-admin (8). The fakes are the source-of-truth for upstream route + integration tests, so locking tenant-isolation + cursor-pagination + lifecycle FSM transitions + sha256 token storage + action-strategy mapping + snippet `<mark>` rendering at the unit level prevents drift across the entire test suite.

**Worker handler test coverage (2026-04-30) — 100%.** Filled the four missing tests: extract-action-items (8), summarize (8), summarize-reader (11), recording-watchdog-reader (5). Every handler now has invalid-payload + meeting/tenant/region preconditions + clean-path assertions.

**Mobile shell (8 new screens) — wired end-to-end against the real API:**
- `app/index.tsx` (inbox) → `GET /api/v1/meetings` with time-filter chips (All / Today / This week / Older), empty-state, record CTA.
- `app/meetings/[meetingId].tsx` → `useSpeakerTurns` (real `/speaker-turns` endpoint) + per-meeting action items via `GET /api/v1/action-items?meetingId=:id`. Tab visibility + badges driven by real counts.
- `app/actions.tsx` → `GET /api/v1/action-items` with server-side `?status=` filter (open=`pending,accepted`, done=`done`, all=none), buckets via `bucketActionItem`.
- `app/search.tsx` → `GET /api/v1/search` with snippet rendering via `plainSnippet`.
- `app/chat.tsx` → SSE-streamed `POST /api/v1/chat` with citation chips, faithfulness empty-state banners, AbortController cancellation on unmount + new-message.
- `app/relationships.tsx` → sample data (no `/api/v1/relationships` endpoint yet — future epic).
- `app/settings.tsx` → real auth user (email, name, role with friendly labels, region, MFA), DSAR portal deep-link, sign-out via `useAuth().logout`.

**Web routes (6 new) — registered in route tree:**
- `_authenticated/search.tsx` — full-text search results page (Story 7.2) with `<mark>` snippets + `(meetingId, turnId)` deep-links.
- `_authenticated/chat.tsx` — RAG chat with SSE streaming via `lib/chat/sse-client.ts`. Retrieval/delta/done/error event handling. Empty-state banners for low-confidence/no-answer/off-topic.
- `share.$tokenHash.tsx` — FR32 public no-auth share recipient view; expired (410) + blocked (403) states.
- `lti/launch.tsx` — FR35 LMS deep-link landing page.
- `data-rights.tsx` — FR52 public DSAR portal with kind/email/name/tenant/description form + verification email confirmation state.

**Mobile pure-derivation hooks (43 new) — every UX state in the spec:**
trial-state, density-preference, bot-status-state, clip-share-state, search-state, vertical-resolver, offline-queue-state, action-bulk-state, thumbs-feedback-state, meeting-detail-tabs, action-item-edit-state, meeting-export-state, receipt-skeleton-stage, quiet-hours, tenant-features, rag-citation-parser, relationship-browser-state, coaching-feedback-state, deep-link-resolver, share-create-form, voice-input-state, f2-admin-onboarding, notification-preferences, motion-mode, recording-warnings, keyboard-shortcuts, rate-limit-banner, onboarding-progress, bot-fallback-decision, undo-countdown, citation-tooltip, stripe-checkout-flow, meeting-action-bar, pricing-comparison, team-coaching-feed, audit-grouping (consumed via shared), import-audio-flow, share-link-copy, tenant-region-pin, cellular-budget, recording-export-modal, erasure-cascade-preview, meeting-thumbs-aggregator, bot-watchdog-card.

**Shared package helpers (7 new) — re-exported from `@aisecretary/shared`:**
- `billing/usage.ts` — quota evaluator (hours-remaining, soft/hard warnings at 80%/100%, seat headroom, in-trial soft-block).
- `clip-bounds.ts` — Story 8.1 clip validation (5s min / 10min max + clamp helper).
- `format.ts` — `formatBytes` / `formatDurationMs` / `formatRelativeTime` / `formatTimestampMs` / `truncate` (with trailing-whitespace trim) / `pluralize`.
- `citation-deeplink.ts` — Story 3.5 canonical `(meetingId, turnId, t)` URL build/parse + `isSameCitation` equality.
- `audit-grouping.ts` — `groupAuditEntries` (5-min window, actor+action key, sample-id cap) + `tallyByResourceType`.
- `module-output-helpers.ts` — `flattenClaims` / `countClaims` / `collectCitationTurnIds` walking all 8 module variants.
- `cron-validator.ts` — 5/6-field cron syntax validator with range checks.

**SSE chat clients (web + mobile, mirrored):**
- `apps/web/src/lib/chat/sse-client.ts` + `apps/mobile/lib/chat/sse-client.ts` — `streamChat` POSTs to `/api/v1/chat`, parses `event: <kind>\ndata: <json>\n\n` frames into typed `ChatEvent`s with partial-frame remainder buffering.

**Web Storybook stories (4 new):**
auth-error, disclosure-copy-form, invite-revoke-button, audit-log-table.

**Worker handler:**
- `zoom-cloud-recording-fetch.ts` test verified (8 tests for Story 9.6 fallback path).

## Pre-compaction Phase 1 cuts 8–12 quick log

- **Cut 8:** Story 1.7 (EmptyStateRecipient + first-3 polish + re-engagement scheduler) + Stories 4.4 + 4.5 (heartbeat + retry-budget escalation).
- **Cut 9:** Story 1.5c (TOTP MFA enrollment + login challenge + recovery codes + org-wide enforcement) + Story 1.5d (tenant invites + accept-invite flow).
- **Cut 10:** Story 1.5e (cookie-based refresh hardening — httpOnly cookie set by `/api/v1/auth/{signup,login,verify-mfa,refresh,accept-invite}`; `credentials: 'include'` on the web client; mobile keeps body-based refresh via `expo-secure-store`).
- **Cut 11:** `packages/llm-gateway` (Anthropic / OpenAI / Azure OpenAI / Bedrock / Ollama / mock; per-tenant compliance routing — HIPAA → Bedrock → Azure; EU → Bedrock; BYOK → Bedrock; default → Anthropic; with primary+fallback list; schema-parse retry; CI provider-isolation gate). + Story 14.1 (DSAR endpoint + worker + zip export via `archiver`; 12-table walk; 7-day presigned-GET URL; email via existing `dsar` template).
- **Cut 12:** Stories 3.1+3.2+3.3 (general module config + summarization + action-items workers consuming the LLM gateway; `module_outputs` + `action_items` tables; new audit actions `meeting.summarized` / `meeting.analyzed` / `meeting.action-items-extracted`) + Story 1.9 (i18next on web + mobile; EN+FR locales; per-vertical anchor word substrate `(locale, vertical) → "receipt" | "reçu" | "session note" | "compte rendu"`; `useT()` hook; curated translation of 10 high-traffic UI files).

**Caveat:** the cut 12 parallel agents both hit the org's monthly usage limit before final verification. Their pre-limit work was complete enough that one inline zod-typing fix + workspace lint:fix closed the gates green. No data was lost; no rollback needed.

## Current state

- ✅ **Architecture** — locked at [docs/architecture.md](docs/architecture.md) (Winston / BMAD architect, 2026-04-29)
- ✅ **PRD** — locked at [docs/mini-prd.md](docs/mini-prd.md)
- ✅ **UX Design Specification** — complete; 14 steps; 3340 lines at [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md)
- ✅ **Epics + stories** — [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) at step 2 of `create-epics-and-stories` — **82 FRs** + 15 epics + 82 stories drafted inline. Reconciled + readiness-fixed (Stories 1.7 / 1.10 / 2.4 / 4.4 / 4.5 / 9.5 / 9.6 / 12.1 / 13.7 / 14.1 / 15.6 all updated post-readiness).
- ✅ **Architecture addendums** — [_bmad-output/planning-artifacts/arch-addendums.md](_bmad-output/planning-artifacts/arch-addendums.md): 8 addendums + ADRs 0002–0006 PROPOSED. §5 extended with full `packages/notifications` contract; ADR-0004 extended with trial-fields migration.
- ✅ **Open-work bundle** — [_bmad-output/planning-artifacts/open-work/](_bmad-output/planning-artifacts/open-work/) (5 files): designer brief, card-sort plan, customer-dev interview plan, reduced-motion audit checklist, telemetry ownership matrix.
- ✅ **Reconciliation note** — [_bmad-output/planning-artifacts/reconciliation-note.md](_bmad-output/planning-artifacts/reconciliation-note.md) — three P0 gaps closed; five P1 naming-drift items deferred to per-sprint story sharpening (N1–N5).
- ✅ **Implementation-readiness report** — [_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-29.md](_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-29.md) — 6-step BMAD `check-implementation-readiness` workflow run; 9 issues found (1 critical + 3 major + 5 minor); critical + 3 major closed in same session via Actions 1+2+3 fix-pass.
- ✅ **Phase 0 implementation** — workspace skeleton + token pipeline + Storybook (web + RN) + `RecordingStatusPill` V2 + `AnalysisCard` contract all shipped 2026-04-29 in a single same-day execution. See "Phase 0 outcome" below.
- ✅ **Phase 1 first cut** — Stories 1.10 (`packages/notifications`) + 4.2 (one-tap recording end-to-end) shipped same day. See "Phase 1 first cut" below.
- ✅ **Phase 1 second cut** — Story 1.4 (`apps/api` Fastify boot + plugins + audit gate) + Story 4.3 (consent modals + `packages/consent` runtime) + `consent-check` Fastify plugin (1.4→4.3 bridge) all shipped same day. See "Phase 1 second cut" below.
- ✅ **Phase 1 third cut** — Story 1.5a (auth keystone): `packages/auth` (Argon2id + JWT + refresh-token rotation) + `apps/api` auth routes + production-DB plugin wiring + frontend signup/login UX (web + mobile). 1.5b/c/d/e deferred. See "Phase 1 third cut" below.
- ✅ **Phase 1 fourth cut** — Story 2.1 (presigned upload + recordings table + workers boot + chunk-poster swap on web/mobile) + Story 3.5 (CitationChip V2 iconic glyph + TranscriptSeekPlayer + 5s pre-roll, absorbs Story 2.4 speaker_turns schema with stable hash IDs) all shipped same day. See "Phase 1 fourth cut" below.
- ✅ **Phase 1 fifth cut** — Story 2.2 (real transcription provider — Whisper API + faster-whisper + mock; per-tenant compliance routing; worker handler closes capture-to-citation loop; CI provider-isolation gate). Diarization deferred to Story 2.3 (multi-speaker turns get `speaker: null` placeholder).
- ✅ **Phase 1 sixth cut** — Story 2.1 follow-up: 3 new GET endpoints (`/recordings/:id/play`, `/meetings/:id/speaker-turns`, `/meetings/:id/playback-url`) + `MeetingsRepository` seam + web/mobile clients consume real backend reads via React Query (`useSpeakerTurns` + new `usePlaybackUrl`). Citation loop closed on the client side.
- ✅ **Phase 1 seventh cut** — Story 1.6: TanStack Router + `AppShell.Inbox` (D1 default) + `AppShell.Cards` (D3 single-user) on web. `App.tsx` state-toggle deleted. Auth gate at `_authenticated.tsx` `beforeLoad`. RecordingStatusPill slot top-right of every shell, subscribed to a Zustand `recording-state-store` that the controller publishes to (no controller restructure). Shell selection via persisted Zustand store + `?mode=cards` URL param (real `tenant.mode` field deferred). Mobile leverages existing Expo Router. See "Phase 1 sixth + seventh cuts" below.
- ⏳ **Phase 1 next** — Stories 4.4/4.5 (heartbeat + retry-budget escalation; consume `packages/notifications`); Story 1.7 (F2 first-launch + tab-closer re-engagement; mounts at `_authenticated/inbox.tsx`); 1.5b/c/d/e auth follow-ups; Story 2.3 (diarization). Production deploy is one `buildProductionServer()` call away.

## Phase 0 outcome (2026-04-29)

Three parallel scaffolds + sequential component builds. All workspace gates green: `pnpm typecheck` (18 packages), `pnpm lint` (114 files), `pnpm test`, `pnpm --filter @aisecretary/design-tokens build` + `contrast-check` (16 pairs WCAG AA).

**Track 1 — `packages/design-tokens` (Story 1.2 partial; ADR-0002):**
- Style Dictionary 4.x with custom transforms (`color-mix-fallback`, `rn-typed`).
- Three artifacts: `tokens.css` (web), `tokens.tailwind.js` (web Tailwind theme), `tokens.native.ts` (RN typed object). All gitignored; CI regenerates fresh.
- WCAG AA contrast gate (`contrast-check`) tests 16 fg/bg pairs across all theme scopes; fails CI on regression. `--color-border` exempted as decorative hairline (WCAG 1.4.11 Note 1) — `--color-border-strong` will land alongside the first interactive component boundary in Phase 1.
- `.github/workflows/ci.yml` `tokens` job + downstream `typecheck` job (`needs: tokens`).

**Track 2 — `apps/web` + `apps/mobile` + Storybook:**
- `apps/web`: React 19 + Vite 6 + Tailwind 3.4 + Storybook 8.3 (React-Vite). `tailwind.config.ts` consumes `@aisecretary/design-tokens/build/tokens.tailwind.js`. Single-line `color-mix()` feature test toggles `.no-color-mix` on `<html>`.
- `apps/mobile`: Expo SDK 52 + Expo Router 4 + NativeWind 4 + RN 0.76 + Storybook RN 8.6. `tailwind.config.ts` consumes the same token theme; on-device storybook bootstrap deferred (CLI regenerates `.storybook/storybook.requires.ts`).
- Both apps include one example button story to verify token-class wiring.

**Track 3 — remaining workspace skeleton (Story 1.1):**
- 4 apps scaffolded: `apps/{api,bot,workers,admin}` (placeholder `index.ts` exports).
- 9 packages scaffolded: `packages/{shared,auth,llm-gateway,transcription,storage,modules,notifications,crm,consent}` (placeholder `index.ts` exports).
- Infra placeholder READMEs at `infra/{railway,docker,terraform}/`.
- Package-scope normalized to `@aisecretary/<name>` (was `@ai-secretary/db` — renamed).

**Story 4.1 — `RecordingStatusPill` V2 inline-waveform (FR11, U1):**
- Web: [apps/web/src/components/feature/recording/recording-status-pill.tsx](apps/web/src/components/feature/recording/recording-status-pill.tsx) — 5-bar CSS-keyframe waveform with phase-staggered animation; `<output role="status" aria-live="polite">`; `aria-label` updates on a 30s ARIA-tick split from the 1s visual tick (avoids screen-reader spam); reduced-motion fallback freezes bars in staggered silhouette via both `@media (prefers-reduced-motion)` and `.motion-reduced` host class.
- Mobile: [apps/mobile/components/recording/recording-status-pill.tsx](apps/mobile/components/recording/recording-status-pill.tsx) — RN `Animated.timing` 5-bar loop driven via native driver; `AccessibilityInfo.isReduceMotionEnabled` subscription mirrors web behavior.
- Variants: `compact` / `standard` / `with-device`. Touch-target floor `min-h-11` (44px AAA) at every density.
- Storybook (web): 9 stories — Recording / Paused / Idle / Compact / WithDeviceChip / LongRecording / WithStopAction / ReducedMotion / DarkTheme / AccessibleDensity.
- Shared `useRecordingTimer` hook + `formatTimer` / `describeAriaSeconds` helpers in both apps (kept colocated; no shared package abstraction yet).
- V1 (pulse-dot) and V3 (gradient-ring) explicitly NOT implemented — V2 is canonical.

**Story 3.4 — `AnalysisCard` shared component contract (FR27, U2):**
- Schema: [packages/shared/src/schemas/module-output.ts](packages/shared/src/schemas/module-output.ts) — zod discriminated union with one variant per module (general / sales / hr / education / medical / support / pm / psychology); each variant carries shared `title` + `summary` + `bullets` baseline plus module-specific slots (sales: `talkRatio`, `objections`, `nextSteps`, `dealRisk`; medical: `soap`, `riskFlags`; pm: `decisions`, `actionItems`, `risks`; etc.). Citation deep-link contract `(meetingId, turnId)` per Story 2.4 + Story 3.5.
- Component: [apps/web/src/components/feature/analysis/analysis-card.tsx](apps/web/src/components/feature/analysis/analysis-card.tsx) — single shell that dispatches on `output.module` to render module-specific slots; uniform header, confidence chip, action row, override notice, streaming skeleton, failed slot. Per UX spec: module identity is icon + label, NEVER hue.
- Module metadata: [apps/web/src/components/feature/analysis/module-meta.tsx](apps/web/src/components/feature/analysis/module-meta.tsx) — lucide-react icons + per-vertical density default + copy register.
- `CitationChip` placeholder: [apps/web/src/components/feature/analysis/citation-chip.tsx](apps/web/src/components/feature/analysis/citation-chip.tsx) — exposes the deep-link contract via `data-citation-meeting-id` + `data-citation-turn-id` so Story 3.6's citation-required CI gate can detect presence. Full V2 iconic-glyph treatment lands in Story 3.5.
- Storybook (web): 16 stories — all 8 modules × ready state + Streaming / LowConfidence / Override / Failed / Standalone / Email / RelaxedDensity / DarkTheme.

## Decisions worth remembering from Phase 0

1. **`--color-border` is decorative-only**, exempt from WCAG 1.4.11 (3:1 non-text floor). Interactive component boundaries land as `--color-border-strong` when the first such surface ships in Phase 1. Token comment + style-dictionary contrast-pair list both updated.
2. **Package scope is `@aisecretary/`** (no hyphen). Re-named `packages/db` from `@ai-secretary/db` to match Track 1 / Track 2 / Track 3 / arch-addendums references.
3. **`apps/web` host `tsconfig.json`** absorbed `vite.config.ts` + `tailwind.config.ts` directly (dropped the `tsconfig.node.json` project-reference) — the project-reference + `noEmit: true` combination is invalid; the merged config carries `["vite/client", "node"]` types.
4. **Storybook RN bootstrap is deferred** to a Phase 1 follow-up that runs `npx sb-rn-get-stories`. The current `.storybook/main.ts` + `preview.tsx` typecheck cleanly against `@storybook/react-native@8.6` + `@storybook/react@8.3` types; on-device runner needs the CLI-generated entry.
5. **`useRecordingTimer` lives in `packages/shared/src/hooks/`** — extracted from the originally-duplicated web + mobile copies. Both apps import from `@aisecretary/shared/hooks/use-recording-timer`. `packages/shared` now declares `react` as a peer dep.
6. **`vitest run --passWithNoTests`** is the workspace test default. Placeholder packages exit 0 cleanly; `packages/design-tokens` runs its 4 contrast-check unit tests.

## Visual mockups (open these in browser to remind yourself of the locked aesthetic)

- [_bmad-output/typeface-comparison.html](_bmad-output/typeface-comparison.html) — Geist (locked)
- [_bmad-output/visual-foundation.html](_bmad-output/visual-foundation.html) — token / palette / type-scale visualizer
- [_bmad-output/design-directions.html](_bmad-output/design-directions.html) — 4 layout directions + 6 component variation takes

## Phase 1 first cut (2026-04-29)

Two parallel agents, disjoint paths. Both green: `pnpm typecheck` (18 packages), `pnpm lint` (163 files), `pnpm test` (61 tests across 7 files: 12 design-tokens contrast + 27 notifications + 16 web + 6 mobile), `check:isolation` enforces provider abstraction.

**Story 1.10 — `packages/notifications` foundation:**
- Provider-agnostic gateway: [packages/notifications/src/gateway.ts](packages/notifications/src/gateway.ts) accepts `tenantId` + `auditLogger` injection (Story 1.4 wires the audit-logger plugin instance).
- 4 providers: Expo Push, Postmark, SES, SMTP — all behind the typed `ProviderResult` boundary.
- 3 templates: re-engagement (Story 1.7), DSAR (Story 14.1), trial-reminder (Story 13.7) — registry at [packages/notifications/src/templates/render.ts](packages/notifications/src/templates/render.ts), 9 render tests.
- Dedup: 5-min window, dedup-key computation in [packages/notifications/src/dedup.ts](packages/notifications/src/dedup.ts), 11 tests.
- pg-boss `notification.send` handler factory: [packages/notifications/src/handler.ts](packages/notifications/src/handler.ts).
- Schema: [packages/db/src/schema/notifications.ts](packages/db/src/schema/notifications.ts) — `notifications` + `user_preferences` tables. Migration: [packages/db/migrations/202604291700_create_notifications.sql](packages/db/migrations/202604291700_create_notifications.sql). RLS: [packages/db/rls/0002_rls_notifications.sql](packages/db/rls/0002_rls_notifications.sql).
- CI provider isolation: [packages/notifications/scripts/check-isolation.ts](packages/notifications/scripts/check-isolation.ts) wired into `.github/workflows/ci.yml` `typecheck` job. Bans `expo-server-sdk` / `postmark` / `@aws-sdk/client-ses` / `nodemailer` outside this package.
- Audit action union deferred: defined in [packages/notifications/src/audit.ts](packages/notifications/src/audit.ts) with `// TODO(Story 1.4): merge into apps/api/src/lib/audit-types.ts`.
- Storybook for email templates deferred — `apps/web/.storybook/main.ts` doesn't glob `packages/**`; consumer wiring documented in package README.

**Story 4.2 — one-tap recording end-to-end:**
- Web: MediaRecorder hook + IndexedDB upload queue + service worker (prod-only registration). Demo route mounted via state-toggle in [apps/web/src/App.tsx](apps/web/src/App.tsx) (TanStack Router deferred to Story 1.6).
- Mobile: `expo-audio` recorder + `expo-file-system` JSON queue + `BACKGROUND_UPLOAD` TaskManager registration in [apps/mobile/app/_layout.tsx](apps/mobile/app/_layout.tsx) at boot.
- Mobile entitlements: iOS `UIBackgroundModes: ["audio", "fetch", "processing"]` + `NSMicrophoneUsageDescription`. Android `RECORD_AUDIO` + `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` + `foregroundServiceTypes: ["microphone"]`. `compileSdkVersion`/`targetSdkVersion: 34`, `minSdkVersion: 24`.
- Shared state-machine shape (mirrored, not extracted): `idle | requesting-consent | recording | paused | stopping | uploading | error` — same names on both platforms. 9 web + 6 mobile state-machine tests.
- Chunk uploader DI'd through `createFetchChunkPoster` so Story 2.1 swaps in a presigned-URL PUT poster without touching the state machine. 7 web chunk-uploader tests.
- Consent modal stubbed in both platforms — Story 4.3 replaces with consent shape A.

## Phase 1 second cut (2026-04-29)

Two parallel agents (1.4 + 4.3) + sequential consent-check plugin bridge. Workspace gates: `pnpm typecheck` (18 packages), `pnpm lint` (209 files), `pnpm test` (136 tests across 12 test files: 12 contrast + 29 consent + 27 notifications + 33 api + 23 web + 12 mobile).

**Story 1.4 — `apps/api` Fastify foundation:**
- Boot at [apps/api/src/server.ts](apps/api/src/server.ts) — `buildServer()` factory test-friendly, `src/index.ts` is the prod entry with SIGTERM/SIGINT handlers.
- Plugin stack (registration order — extend, don't replace):
  1. `error-handler` (RFC 7807 conversion of `HttpError` hierarchy + zod validation errors)
  2. `request-id` (every request gets a `requestId`; echoed to response header + every log)
  3. `cors` + `helmet`
  4. `health` routes (registered before tenant-context; `config.skipTenantContext: true`)
  5. `tenant-context` (resolves `request.tenantId` from `request.user?.tenantId` future Story 1.5 path OR `x-tenant-id` header in non-prod; fail-closed 401 in prod)
  6. `audit-logger` (manual `request.audit(...)` + tag-driven auto-emit via `config.auditTags: ApiAuditAction[]`; in-memory sink default; conforms to `@aisecretary/notifications` `AuditLogger` interface via `createNotificationsAuditLogger`)
  7. `consent-check` (per-route opt-in via `config.requireConsent: true | { meetingIdParam }`; fail-closed default; injectable `consentChecker` for production DB wiring)
  8. application routes
- Audit action union: [apps/api/src/lib/audit-types.ts](apps/api/src/lib/audit-types.ts) — `ApiAuditAction` includes notifications union + tenant/user/meeting/recording lifecycle. Runtime `AUDIT_ACTIONS` array kept in sync via TS exhaustiveness assertion.
- Erasure-cascade registry: [apps/api/src/lib/erasure-cascade.ts](apps/api/src/lib/erasure-cascade.ts) — 7 entries: `tenants` (cascade-source), `users` (cascade), `meetings` (shred), `notifications` (redact), `user_preferences` (cascade), `audit_logs` (redact), `consents` (redact). Story 14.x DSAR worker walks this.
- CI audit-coverage gate: [apps/api/scripts/check-audit-coverage.ts](apps/api/scripts/check-audit-coverage.ts) — TS-AST walks `routes/**`, fails on non-GET routes missing both `auditTags` and `request.audit(...)`. Wired into `.github/workflows/ci.yml`.
- `apps/workers/src/lib/job-context.ts` — `withJobContext({ tenantId, region }, fn)` workers-side equivalent of the API plugin.
- Schema: `audit_logs` table with `REVOKE UPDATE, DELETE` to enforce append-only at SQL level. RLS strict in-tenant per ADR-0006.

**Story 4.3 — consent modals + `packages/consent` runtime:**
- `packages/consent/src/`:
  - `region-detect.ts` — priority `ipCountry` → email TLD → IANA tz; EU-27 ccTLDs + `.eu` + Iceland/Liechtenstein/Norway via ISO list. UK intentionally `'unknown'` (Anthony to confirm GDPR-derived UK mapping). 
  - `policy-resolver.ts` — most-protective wins per ADR-0005: org `alwaysExplicit` → any participant `eu` → tenant default `eu` → otherwise `legitimate-interest`.
  - `orchestrator.ts` — Shape A always, then `eu-explicit` if explicit basis + participants present, then Shape C if `orgInPersonRequired` + mobile/web mic source.
  - `server-check.ts` — `consentCheck(tenantId, meetingId, db)` → `'ok' | 'missing'`. Wrapped by `apps/api/src/plugins/consent-check.ts`.
  - `disclosure-templates.ts` — locale-keyed default copy; tenant override knob.
- Web: [apps/web/src/components/feature/recording/consent-modal.tsx](apps/web/src/components/feature/recording/consent-modal.tsx) (Radix Dialog) + `consent-qr-card.tsx` (one-time URL + QR). Replaces the Story 4.2 stub.
- Mobile: [apps/mobile/components/recording/consent-modal.tsx](apps/mobile/components/recording/consent-modal.tsx) (RN Modal pageSheet) + `consent-qr-screen.tsx` (Expo Router). Replaces stub.
- Schema: `consents` table with `(meetingId, recipientId, shape: 'A'|'C'|'eu-explicit', legalBasis, acknowledgedAt, acknowledgedVia, metadata)`. Migration `202604291801_create_consents.sql`. RLS in-tenant.
- Local persistence stubbed via `useConsentStore` zustand-style hooks in both apps; `// TODO(Story 1.4 follow-up): POST to /api/v1/consents` markers for real API write.

**Consent-check Fastify plugin (1.4↔4.3 bridge):**
- [apps/api/src/plugins/consent-check.ts](apps/api/src/plugins/consent-check.ts) — wraps `packages/consent`'s `consentCheck` function.
- Routes opt in via `config.requireConsent: true` (param name defaults to `meetingId`) or `config.requireConsent: { meetingIdParam: 'id' }` for custom param names.
- `ConsentCheckerFn` injection via `BuildServerOptions.consentChecker`. Default fail-closed (returns `'missing'`) — conservative because consent is a regulatory boundary; spurious 403s in dev are better than silent permits.
- 5 tests: pass-through when not opted in, fail-closed default, injected checker pass/deny, custom param override, missing param 403.

## Decisions worth remembering from Phase 1

1. **Fail-closed defaults for consent + audit pluggable sinks**: consent-check default is `'missing'`; audit-logger default is in-memory sink. Production wiring of real DB-backed checkers / sinks is the next bootstrap concern (Story 1.5 + auth ships the connection pool that production plugin instantiation hooks into).
2. **`audit_logs` is strict in-tenant per ADR-0006**: no service-role bypass for cross-tenant audit writes. Cross-org sharing routes will write to the receiver's `inbound_shares` table per arch-addendums §8 (future Epic 8 / Story 12.x).
3. **`fastify-plugin@^5`** required by Fastify v5 to declare plugin names + dependencies (e.g. `audit-logger` declares `dependencies: ['tenant-context']`).
4. **UK intentionally returns `'unknown'` from region-detect** — Anthony to confirm whether UK should map to `'eu'` for GDPR-derived consent treatment. Until then, UK falls through to the tenant default rule.
5. **`request.user` slot already type-augmented** in `apps/api/src/types/fastify.d.ts` so Story 1.5 (auth) has a single seam to fill — JWT-verified `tenantId` flows through the existing `tenant-context` resolution order without plugin-stack changes.

## Phase 1 third cut (2026-04-29) — Story 1.5a auth keystone

Two parallel agents (backend + frontend) against a pre-written shared wire contract at [packages/shared/src/schemas/auth.ts](packages/shared/src/schemas/auth.ts). Workspace gates: 18 typecheck, 256 lint files clean, 204 tests across 30 files (12 contrast + 17 auth + 29 consent + 27 notifications + 52 api + 43 web + 24 mobile).

**Story 1.5a backend — `packages/auth` + auth routes + production-DB wiring:**
- [packages/auth/src/password.ts](packages/auth/src/password.ts) — Argon2id via `@node-rs/argon2`; OWASP 2024 params (19 MiB / 2 iterations / 1 lane / 32-byte hash).
- [packages/auth/src/jwt.ts](packages/auth/src/jwt.ts) — `signAccessToken` / `verifyAccessToken` via `jose` (HS256, 15-min default TTL). Picked `jose` over `jsonwebtoken` — ESM-native, used internally by `@fastify/jwt` v9.
- [packages/auth/src/refresh-token.ts](packages/auth/src/refresh-token.ts) — `RefreshTokenStore` interface; `generateRefreshToken` returns 32-byte base64url. [packages/auth/src/refresh-token-redis.ts](packages/auth/src/refresh-token-redis.ts) — atomic rotation via Redis `MULTI/EXEC`; reusing the old token after rotation deterministically 401s. [packages/auth/src/refresh-token-memory.ts](packages/auth/src/refresh-token-memory.ts) — same contract for tests / single-instance dev.
- [apps/api/src/routes/auth.ts](apps/api/src/routes/auth.ts) — `POST /api/v1/auth/{signup,login,refresh,logout}` + `GET /me`. Conforms exactly to the shared wire contract. `/signup` audits `tenant.created` + `user.created` via auto-emit `auditTags`; `/login` `/refresh` `/logout` use `config.skipAudit: true` (credential management against the refresh store, not tenant-scoped state).
- [apps/api/src/routes/auth-repository.ts](apps/api/src/routes/auth-repository.ts) — `AuthRepository` interface + `DrizzleAuthRepository` + in-memory test variant. Repository seam keeps integration tests honest without pg-mem.
- [apps/api/src/plugins/jwt.ts](apps/api/src/plugins/jwt.ts) — verify-only JWT plugin; populates `request.user` from `Authorization: Bearer <token>`, leaves `null` on missing/invalid (does NOT 401 by itself; protected routes throw).
- [apps/api/src/plugins/db.ts](apps/api/src/plugins/db.ts) — decorates `fastify.db` + `fastify.dbHandle`; closes pool on app shutdown.
- [apps/api/src/lib/audit-sink-postgres.ts](apps/api/src/lib/audit-sink-postgres.ts) — production audit sink (writes via Drizzle inside `withTenantContext`). Default in `buildServer` when `dbHandle` provided; in-memory otherwise for tests.
- [apps/api/src/lib/consent-checker-db.ts](apps/api/src/lib/consent-checker-db.ts) — wraps `packages/consent`'s `consentCheck` with the live Db. Replaces the fail-closed default in `buildServer` when `dbHandle` provided.
- [apps/api/src/plugins/tenant-context.ts](apps/api/src/plugins/tenant-context.ts) — TODO removed. Resolution order is now: (1) verified `request.user.tenantId` from JWT, (2) `x-tenant-id` header in non-prod, (3) 401.
- `buildProductionServer()` helper boots a `DbHandle` from env; production deploy is a single call away.

**Story 1.5a frontend — web + mobile signup/login UX:**
- Web: [apps/web/src/components/feature/auth/](apps/web/src/components/feature/auth/) — `SignupForm` + `LoginForm` via `react-hook-form` + `@hookform/resolvers/zod` against the same shared contract; `AuthError` banner renders RFC 7807 `detail` + `requestId`; per-field server errors map via `setError(jsonPointer, ...)`.
- Web routing: `App.tsx` extends the Story-4.2 demo state-toggle with `'login' | 'signup'`; home page now has a "Sign in" entry. TanStack Router still deferred to Story 1.6.
- Web token store: [apps/web/src/lib/auth/token-store.ts](apps/web/src/lib/auth/token-store.ts) — access token in-memory (Zustand), refresh token in `localStorage` under `aisecretary.refresh-token`. `// TODO(Story 1.5e): swap to httpOnly cookie set by /auth/refresh` marker on file.
- Web `useAuth`: [apps/web/src/hooks/use-auth.ts](apps/web/src/hooks/use-auth.ts) — Zustand store + React Query mutations.
- Web `auth-fetch`: [apps/web/src/lib/auth/auth-fetch.ts](apps/web/src/lib/auth/auth-fetch.ts) — single retry on 401 via `onRefresh()`; `onRefreshFailure()` clears storage + bubbles tokenless 401.
- Mobile: [apps/mobile/components/auth/](apps/mobile/components/auth/) + [apps/mobile/app/auth/](apps/mobile/app/auth/) (Expo Router route group with hidden header). `app/_layout.tsx` wraps `<QueryClientProvider>` around an `AuthGate` that uses `useSegments()` + `useAuth()`: while `!isHydrated` shows `<ActivityIndicator>`; if unauthenticated and not in `/auth/*` group, `<Redirect href="/auth/login" />`.
- Mobile token store: [apps/mobile/lib/auth/token-store.ts](apps/mobile/lib/auth/token-store.ts) — refresh token in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).

## Decisions worth remembering from Phase 1 cut 3

1. **Production deploy is unblocked.** `buildProductionServer()` boots Drizzle pool from env, wires `PostgresAuditSink` + `DrizzleAuthRepository` + `RedisRefreshTokenStore` (when `REDIS_URL` set) + DB-backed consent checker. The fail-closed defaults for audit + consent that 1.4 shipped are now replaced by the real implementations whenever a `dbHandle` is present.
2. **`config.skipAudit: true` is a real opt-out** for credential-management routes (login/refresh/logout). The audit-coverage CI walker honors it. Don't add it to routes that change tenant-scoped state — `/signup` carries `auditTags: ['tenant.created', 'user.created']` instead.
3. **`AuthRepository` repository seam** keeps the auth route handlers DB-agnostic. Production wires `DrizzleAuthRepository`; tests use the in-memory variant. No pg-mem dependency.
4. **Refresh-token rotation is atomic** via Redis `MULTI/EXEC`: GET old → MULTI → DEL old + SREM user-set + SET new (with TTL) + SADD user-set + EXPIRE user-set → EXEC. Replay attacks (reusing the rotated token) fail the GET and never reach EXEC.
5. **Refresh token in localStorage / SecureStore is acknowledged-XSS-vulnerable on web.** Story 1.5e is the cookie-based-refresh hardening follow-up; SecureStore on mobile is fine as-is.
6. **`jose` is the JWT lib of record.** Don't introduce `jsonwebtoken` later; `@fastify/jwt` v9 internals already use jose, and verbatimModuleSyntax compatibility is better.

## Phase 1 fourth cut (2026-04-30) — recording pipeline + citation V2

Two parallel agents (2.1 + 3.5) + one cross-track integration pass to close gaps.

Workspace gates: 18 typecheck, 295 lint files clean, **264 tests** across 41 test files (12 design-tokens contrast + 17 auth + 29 consent + 27 notifications + 16 storage + 62 api + 64 web + 34 mobile + 3 workers).

**Story 2.1 — presigned upload pipeline + workers boot:**
- [packages/storage/src/](packages/storage/src/) — real `S3StorageProvider` via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Provider abstraction enforces "S3 SDK ONLY inside `packages/storage`" discipline. 16 tests. Multipart strategy: presign per part on demand (not batched up front) so aborted uploads don't waste URLs and the 10-min retry budget refreshes per chunk. 15-min default presigned-URL expiry.
- [apps/api/src/routes/recordings.ts](apps/api/src/routes/recordings.ts) — 5 routes mounted at `/api/v1/recordings`: `POST /initiate`, `POST /:id/parts/:partNumber`, `POST /:id/complete`, `POST /:id/abort`, `GET /:id`. New canonical audit action `recording.aborted`. `parts/:n` is `skipAudit: true` (high-frequency presign mint, no tenant state change).
- Consent gate strategy: extended `consent-check` plugin with a named-resolver registry. Routes opt in via `config.requireConsent: { meetingIdResolver: 'recordingMeetingId' }` (the resolver joins through `recordings.meetingId`). One preHandler, one fail-closed default, one error shape across all routes.
- [apps/workers/src/](apps/workers/src/) — `startWorker(env)` boots pg-boss + registers `transcribe` queue handler; SIGTERM/SIGINT → `gracefulStop` (30s in-flight timeout) → close pool → exit. Handler stub transitions `transcribing → completed`; `// TODO(Story 2.2): replace with packages/transcription engine call`.
- Schema: `recordings` table with `(id, tenant_id, meeting_id, owner_user_id, storage_key, content_type, size_bytes, status, s3_upload_id, started_at, uploaded_at, transcribed_at, failure_reason)`. Status FSM `uploading → uploaded → transcribing → completed | failed`. Migration `202604301200_create_recordings.sql`. RLS `0005_rls_recordings.sql`.
- Wire contract: [packages/shared/src/schemas/recordings.ts](packages/shared/src/schemas/recordings.ts) — `initiateUploadRequestSchema`, `partUrlResponseSchema`, `completeUploadRequestSchema`, etc.
- Web + mobile: chunk-poster swap to real presigned-URL flow via [apps/web/src/lib/recording/presigned-poster.ts](apps/web/src/lib/recording/presigned-poster.ts) (and mobile mirror). 3-step lifecycle (initiate → presign-per-part → complete) replaces Story 4.2's mock fetch interception. The 10-min retry budget from Story 4.5 wraps the new poster transparently.

**Story 3.5 — `CitationChip` V2 + `TranscriptSeekPlayer` (absorbs Story 2.4):**
- Schema: [packages/db/src/schema/speaker-turns.ts](packages/db/src/schema/speaker-turns.ts) — `speaker_turns (id, tenant_id, meeting_id, turn_id, speaker, span_start_ms, span_end_ms, text, confidence, sequence)` with `UNIQUE (meeting_id, turn_id)`. Migration `202604301201_create_speaker_turns.sql`. RLS `0006_rls_speaker_turns.sql`.
- **Stable `turn_id` recipe** (locked): `sha256(meetingId || sequence || speaker || spanStartMs || text).slice(0, 16)` — 16 hex chars (64 bits). **Stability commitment**: once written, `turn_id` never mutates; transcription re-runs that change boundaries write NEW rows with NEW IDs so historical citations keep resolving (or break cleanly to the disabled `aria-label="Citation unavailable"` chip state). Helper exported at `@aisecretary/db/lib/speaker-turn-id`.
- Web: real [apps/web/src/components/feature/analysis/citation-chip.tsx](apps/web/src/components/feature/analysis/citation-chip.tsx) replaces the Story 3.4 placeholder. V2 iconic glyph (lucide `MessageSquareQuote` interim — designer-brief follow-up swaps to bespoke illustration via the `data-glyph="speaker-quote-interim"` swap-point). Pill / hover-or-focus tooltip / 120ms active flash / sessionStorage visited state. Backwards-compatible signature so `analysis-card.tsx` doesn't change. Touch target ≥44px via wrapping span. Click → `<TranscriptSeekPlayer>`.
- Web: [apps/web/src/components/feature/analysis/transcript-seek-player.tsx](apps/web/src/components/feature/analysis/transcript-seek-player.tsx) — Radix Dialog modal, scrollable transcript turn list, HTML5 `<audio>` (stub URL pending Story 2.1 follow-up), pre-roll seek via `computeSeekTargetSeconds(spanStartMs)` (exported pure function for testability since jsdom's `currentTime` setter is non-functional), spacebar play/pause, click-another-turn re-seeks.
- Mobile: parallel [apps/mobile/components/analysis/](apps/mobile/components/analysis/) implementations using `expo-audio` `useAudioPlayer` + RN Modal pageSheet + long-press for hover-equivalent preview.
- Mock fixture data: `speaker-turns.fixture.ts` (web + mobile mirror; same `(meetingId, turnId)` resolves to same preview cross-platform). React Query hook with `initialData` synchronous short-circuit so the player seeks on first commit without skeleton flash.

**Cross-track integration pass:**
- `apps/api/src/lib/erasure-cascade.ts` — added `speaker_turns: shred` entry. Now 9 tenant-scoped tables registered.
- `apps/web/src/test/setup.ts` — jsdom polyfills: `Element.prototype.scrollIntoView` stub + `HTMLMediaElement.prototype.{play,pause}` stubs. Note: `currentTime` setter override doesn't take effect in jsdom — pre-roll seek math is unit-tested via the exported `computeSeekTargetSeconds` pure function instead.
- `apps/mobile/components/analysis/citation-chip.stories.tsx` — removed `onClick: undefined` arg (incompatible with `exactOptionalPropertyTypes: true`).

## Decisions worth remembering from Phase 1 cut 4

1. **Presigned URLs are per-chunk, on demand** — not pre-issued in batch. Avoids wasted URLs on aborted uploads. Refreshes per chunk so the 10-min Story 4.5 retry budget gets a fresh URL on each retry.
2. **`config.requireConsent` accepts a named resolver** — `{ meetingIdResolver: 'recordingMeetingId' }` looks up the meetingId through a registered resolver in the consent-check plugin. Lets routes participate in the gate without hardcoding the meeting-id param name. One preHandler, one fail-closed default.
3. **Speaker-turn `turn_id` is sha256-of-content, not a UUID** — 16 hex chars / 64 bits. Lets the citation deep-link contract `(meetingId, turnId)` survive transcription re-runs that produce identical content; only boundary changes break citations (deliberate — different content → different citation).
4. **`CitationChip` V2 ships with an interim lucide glyph** — `data-glyph="speaker-quote-interim"` is the swap point for the bespoke designer illustration (handoff doc in `_bmad-output/planning-artifacts/open-work/`).
5. **`TranscriptSeekPlayer` audio src is a stub** — production wires a presigned-GET URL from `/api/v1/recordings/:id` once the GET-playback endpoint lands as a Story 2.1 follow-up. The seek + transcript view + a11y are all functional today.
6. **jsdom can't fake HTMLMediaElement.currentTime** — extracting pure functions (`computeSeekTargetSeconds`) is the workaround. Tests that need to assert on the seek target unit-test the math; integration tests assert on the active-turn highlight + dialog mount instead.

## Phase 1 fifth cut (2026-04-30) — transcription pipeline closes the capture-to-citation loop

Single backend agent owning `packages/transcription` + worker handler. Workspace gates: 18 typecheck, **309 lint files clean, 303 tests across 46 files** (12 design-tokens contrast + 16 storage + 17 auth + 29 consent + 27 notifications + 35 transcription + 7 workers + 62 api + 64 web + 34 mobile).

**Story 2.2 — real transcription provider + worker pipeline:**
- [packages/transcription/src/](packages/transcription/src/) — `TranscriptionProvider` interface + 3 implementations:
  - [whisper-api.ts](packages/transcription/src/whisper-api.ts) — `WhisperApiProvider` via OpenAI SDK; the ONLY file in repo importing `openai`. `verbose_json` segment mapping with confidence derived from `avg_logprob` via `clamp(0, 1, 1 + avg_logprob / 10)` (heuristic; documented as relative score, not calibrated probability). 30s default timeout via AbortSignal.
  - [faster-whisper.ts](packages/transcription/src/faster-whisper.ts) — `FasterWhisperProvider`; plain `fetch` POST against `${endpoint}/transcribe`; zod-validated wire payload. Bearer auth optional.
  - [mock.ts](packages/transcription/src/mock.ts) — `MockTranscriptionProvider` + static `fromText(text, durationMs)` helper that splits into 5s chunks for tests + dev environments without a real engine.
- [selector.ts](packages/transcription/src/selector.ts) — `selectProviderKindForTenant({ region, compliancePosture })` precedence: HIPAA → faster-whisper (no OpenAI BAA) → EU region → faster-whisper (data residency) → custom-managed-keys → faster-whisper (BYOK) → else whisper-api (ZDR). `bookGdpr` does NOT change routing — region pinning handles it.
- [apps/workers/src/handlers/transcribe.ts](apps/workers/src/handlers/transcribe.ts) — full pipeline: read recording → read tenant compliance posture → `selectProviderKindForTenant` → build provider via factory (with mock fallback if env unset; logs warning) → `presignGet` audio URL via `packages/storage` → `provider.transcribe()` → map segments to `speaker_turns` rows with `computeTurnId` (Story 3.5 helper) → DB transaction insert → `recordings.status = 'completed'` + `transcribed_at`. Failure path: `'failed'` + `failure_reason`. Idempotency guards on `'transcribing'` / `'completed'` re-entry. Region-mismatch + meetingId-null guards.
- Worker boot at [apps/workers/src/index.ts](apps/workers/src/index.ts) wires `createStorageProvider({ kind: 's3', config })` + `createTranscriptionProvider` factory + env into the handler at boot.
- CI provider-isolation gate at [packages/transcription/scripts/check-isolation.ts](packages/transcription/scripts/check-isolation.ts) bans `openai` + `pyannote-audio` (pre-emptive for Story 2.3) + `faster-whisper-client` outside `packages/transcription/**`. Wired into `.github/workflows/ci.yml` typecheck job after the notifications isolation step.
- Diarization deferred to Story 2.3: every `TranscriptionSegment` carries `speaker: null` (literal). `// TODO(Story 2.3): diarization via Pyannote pass` markers in the two real providers + the worker handler. When `speaker` becomes non-null, `computeTurnId` will deterministically include it per the hash recipe (already wires through).

**Capture-to-citation loop now runs end-to-end on the backend:**
1. Web/mobile records audio → consent gate → presigned multipart S3 PUT (Story 2.1).
2. `POST /recordings/:id/complete` enqueues `transcribe` pg-boss job (Story 2.1).
3. Worker reads recording + tenant → routes to compliance-appropriate engine → fetches audio via presigned GET → transcribes → maps to `speaker_turns` (Story 2.2).
4. Story 2.1 follow-up wires the client `useSpeakerTurns` hook to the real `GET /api/v1/meetings/:meetingId/speaker-turns` endpoint (currently mocked with a dev fixture) so the V2 `CitationChip` + `TranscriptSeekPlayer` consume real transcripts (Story 3.5 contract).

## Decisions worth remembering from Phase 1 cut 5

1. **Per-tenant transcription routing precedence** — HIPAA → EU region → BYOK → default whisper-api. This mirrors the LLM-gateway compliance routing pattern and is the single source of truth for "which transcription engine does this tenant get".
2. **Confidence is a heuristic, not calibrated** — `clamp(0, 1, 1 + avg_logprob / 10)` for whisper-api. Documented as relative score; consumers (Story 3.6 citation-required CI gate, Story 5.x per-vertical confidence display) treat it as ordinal.
3. **`speaker: null` is a literal placeholder, not optional** — keeps the type discriminator stable. When Story 2.3 ships diarization, every code path that reads `segment.speaker` already handles the null case.
4. **Mock fallback is intentional for dev/CI** — when `OPENAI_API_KEY` and `FASTER_WHISPER_URL` are both unset, the worker handler logs a warning and uses `MockTranscriptionProvider`. Lets local dev + CI runs exercise the full pipeline without real API keys.
5. **Worker has its own `S3_*` env vars** — separate from `apps/api` because the worker constructs its own `StorageProvider`. Same defaults; different env namespace.
6. **`TRANSCRIBE_TIMEOUT_MS` is configurable** — env knob threading through the factory so tests can speed up timeouts without touching code.

## Phase 1 sixth + seventh cuts (2026-04-30)

Two parallel agents (2.1-followup + 1.6), disjoint paths. Workspace gates: 18 typecheck, **339 lint files clean, 335 tests across 52 files** (12 design-tokens + 16 storage + 17 auth + 29 consent + 27 notifications + 35 transcription + 7 workers + 73 api + 85 web + 34 mobile).

**Story 2.1 follow-up — 3 new GET endpoints + client wiring:**
- `GET /api/v1/recordings/:recordingId/play` — presigned-GET URL (15-min expiry); 404 unless `recordings.status === 'completed'`. Consent gate via existing `recordingMeetingId` resolver.
- `GET /api/v1/meetings/:meetingId/speaker-turns` — returns ordered `speaker_turns` rows for a meeting. Consent gate via `requireConsent: { meetingIdParam: 'meetingId' }` (direct, no resolver).
- `GET /api/v1/meetings/:meetingId/playback-url` — finds the latest 'completed' recording for the meeting + presigns its storage key. Saves the client a recordingId lookup. Same consent gate as speaker-turns.
- All three `config.skipAudit: true` (read-only).
- New `MeetingsRepository` seam at [apps/api/src/routes/meetings-repository.ts](apps/api/src/routes/meetings-repository.ts) (Drizzle + in-memory variants). Repository confidence column is `numeric(4,3)` so `DrizzleMeetingsRepository` coerces via `Number(r.confidence)` (postgres-js returns numerics as strings).
- Wire contract: new [packages/shared/src/schemas/meetings.ts](packages/shared/src/schemas/meetings.ts) with `speakerTurnSchema`, `speakerTurnsResponseSchema`, `recordingPlaybackResponseSchema`.
- Web + mobile: replaced fixture in `use-speaker-turns.ts` with React Query → `authFetch(GET /speaker-turns)`; new `use-playback-url.ts` hook fetches the meeting playback URL with 12-min `staleTime` (under the 15-min URL TTL). `TranscriptSeekPlayer` consumes `usePlaybackUrl` instead of the stub URL.
- Tests: 11 new api tests (4 playback + 4 speaker-turns + 3 meeting playback-url) + new `use-speaker-turns.test.tsx` + updated player test mocks both hooks.

**Story 1.6 — AppShell + TanStack Router (web only):**
- Router setup: [apps/web/src/router.tsx](apps/web/src/router.tsx) + [apps/web/src/routeTree.gen.ts](apps/web/src/routeTree.gen.ts) (auto-generated by `TanStackRouterVite` plugin; committed). Vite plugin config: `routesDirectory`, `generatedRouteTree`, `routeFileIgnorePattern: '\\.test\\.[jt]sx?$'`. `biome.json` ignores the gen file (matches existing migrations/ ignore precedent).
- Route tree:
  - `/` → redirect `/inbox` (auth-gated)
  - `/inbox` → `_authenticated/inbox.tsx`
  - `/record` → `_authenticated/record.tsx` (embeds `RecordingController`)
  - `/meetings/:meetingId` → `_authenticated/meetings/$meetingId.tsx` (placeholder w/ AnalysisCard)
  - `/settings` → `_authenticated/settings.tsx`
  - `/login`, `/signup` → public
  - `/404` → not-found
- Auth gate: `_authenticated.tsx` `beforeLoad` reads `useAuthStore.getState()` (no React-hook context — `beforeLoad` runs outside render). On null user/token, throws `redirect({ to: '/login', search: { redirect: location.href }})`. Login route's `validateSearch` parses the redirect param (deep-link restore is a follow-up; current impl always lands `/inbox` post-login).
- `App.tsx` deleted.
- AppShell components at [apps/web/src/components/layout/](apps/web/src/components/layout/):
  - `app-shell-frame.tsx` — applies `theme-{light,dark}` + `density-{relaxed,dense,accessible}` + `motion-{default,gentle,reduced}` classes via `theme-mode-store.ts` Zustand. Mounts either `AppShellInbox` or `AppShellCards` based on `useShellMode()`.
  - `app-shell-inbox.tsx` — D1: sidebar (collapsible <1024px) + cmd-K + content + RecordingStatusPill slot top-right of header.
  - `app-shell-cards.tsx` — D3: minimal header + content + "Show organization features" toggle that flips `useShellMode()` from `'cards'` → `'inbox'`.
  - `command-palette.tsx` — Radix Dialog cmd-K placeholder (full search lives in Epic 7).
  - `visibility-layer.tsx` — single-user mode hides team-lead/admin/embed surfaces.
- Shell selection: `shell-mode-store.ts` Zustand persists `'inbox' | 'cards'` to `localStorage` under `aisecretary.shell-mode`. Initialiser honours `?mode=cards` URL param on first visit. `// TODO(future Story): replace with tenant.mode field` markers in `shell-mode-store.ts` and `settings.tsx`.
- RecordingStatusPill slot: new [apps/web/src/components/feature/recording/recording-state-store.ts](apps/web/src/components/feature/recording/recording-state-store.ts) Zustand holds `{state, elapsedSeconds, device}`. Both shells mount `<RecordingStatusPill>` in their `data-slot="recording-pill"` slot top-right and subscribe to the same store. `RecordingController` calls `useSyncRecordingPill(...)` once per render — a thin effect-based publisher; controller's existing state machine is untouched. Pill self-hides on `state === 'idle'` so the slot stays mounted across shells.
- Storybook: `app-shell-{inbox,cards}.stories.tsx` (Empty / WithRecordingActive / DarkTheme / AccessibleDensity); `command-palette.stories.tsx` (Closed / OpenEmpty / OpenWithPlaceholderResults).

## Decisions worth remembering from Phase 1 cuts 6+7

1. **`tenant.mode` doesn't exist yet** — shell selection is client-side Zustand + localStorage with TODO markers. When the field lands (probably alongside Story 12.x F2-admin), the store reads from JWT claim instead of localStorage. The toggle behavior carries over.
2. **`tailwind.config.ts` uses `createRequire` not top-level await** — Tailwind's PostCSS pipeline ships an older jiti (1.21.x) that can't evaluate TLA. Pre-existing build blocker surfaced by Story 1.6's first `.test.tsx` that imports a CSS-side-effect component.
3. **`vitest.config.ts` has a CSS-stub plugin** — same root cause as #2; bypasses Tailwind PostCSS in tests so component imports of `.css` files don't crash vitest.
4. **localStorage shim in test setup** — Node 25 ships an experimental global localStorage polyfill whose API is incomplete (clear/getItem/setItem can throw). Setup-level shim replaces it with a Map-backed in-memory Storage. `use-auth.test.tsx` documents the same workaround at file scope.
5. **`window.scrollTo` jsdom polyfill** — TanStack Router scroll-restoration calls scrollTo during route transitions; jsdom doesn't implement it. No-op stub added in test setup.
6. **`routeTree.gen.ts` is committed** — fresh clones typecheck without first running the dev server. Auto-regenerated by the plugin on `vite dev` / `vite build`.
7. **Auth gate uses `useAuthStore.getState()`, not the hook** — `beforeLoad` runs outside the render tree. The Zustand `getState()` accessor is the right primitive.

## Next Phase 1 priorities

1. **Story 1.7** — F2 first-launch flow + tab-closer re-engagement. `_authenticated/inbox.tsx` is the natural mount point for `EmptyStateRecipient` (sample-library + import-CTA co-equal). Re-engagement at 24h + 72h consumes the `packages/notifications` re-engagement template (already authored).
2. **Story 4.4 + 4.5** — heartbeat detection + 10-min retry-budget escalation. Both consume `packages/notifications`. Provides the "your recording dropped" + "upload retry exhausted" UX.
3. **Story 1.5b/c/d/e** — OAuth (Google + Microsoft), TOTP MFA, email invites, cookie-based refresh.
4. **Story 2.3** — Pyannote diarization pass; replaces `speaker: null` with real labels in both real providers.
5. **Production deploy bootstrap** — actually run `buildProductionServer()` against Railway, configure env (DB, Redis, S3, Whisper), smoke test the signup → record → transcribe loop end-to-end.

## Next-session prompt (copy-paste this to launch)

> Resume the AI Secretary work. Read `HANDOFF.md` + memory at `~/.claude/projects/-Users-anthony-ai-secretary/memory/MEMORY.md`. Phase 1 cuts 1–7 are in — full capture-to-citation loop runs end-to-end on backend AND client, with TanStack Router + AppShell.Inbox/Cards on web. Mobile uses Expo Router equivalent. Production deploy is one `buildProductionServer()` call away. Next priority: Story 1.7 (F2 first-launch + tab-closer re-engagement; consumes `packages/notifications` re-engagement template) lands the "first-three receipts polish" UX. Then Stories 4.4/4.5 (heartbeat + retry-budget) provide the resilience UX. Story 2.3 (diarization) is a backend follow-up. Or: deploy bootstrap (run buildProductionServer + Railway config + smoke test) for real-world validation before more features.

---

## Original three-agent parallel-launch prompt (already executed 2026-04-29 — kept for reference)

---

## Three parallel agents to launch

### Agent A — Epic & story revision

**Subagent type:** `general-purpose`

**Prompt:**

> You are revising the AI Secretary epic breakdown to absorb decisions that locked AFTER the epic file was drafted.
>
> Read in full:
> 1. `~/ai-secretary/_bmad-output/planning-artifacts/ux-design-specification.md` (the locked UX spec)
> 2. `~/ai-secretary/_bmad-output/planning-artifacts/epics.md` (the existing epic breakdown)
> 3. `~/ai-secretary/docs/architecture.md` (the locked architecture)
>
> Then revise `epics.md` in place to absorb these locked specifics that weren't fully baked when it was drafted:
>
> - **AAA touch targets** (44px min all densities) — epics may say AA
> - **Geist + Geist Mono + indigo (#4f46e5 / #818cf8)** — palette and typography specifics
> - **Style Dictionary token build pipeline** with WCAG contrast CI gate
> - **D1 + D3 + D4 three-shell layout decision** — `AppShell.Inbox` (default) + `AppShell.Cards` (single-user mode) + `AppShell.Search` (power-user toggle)
> - **`RecordingStatusPill` V2 inline-waveform** as the canonical recording-status primitive
> - **`CitationChip` V2 iconic glyph** as the canonical citation token
> - **F2-admin as a separate flow** from F2 (user) — DPA acceptance, region pin, retention defaults, disclosure config
> - **Detangled patient consent / `ModuleConfirmModal`** — clinician confirms vertical (`ModuleConfirmModal`); patient sees disclosure (`ConsentDisclosureCard`); these are SEPARATE acts at clinical capture
> - **Real-time heartbeat detection** (every 30s; lost heartbeat triggers push within 60s) for capture-at-risk failures
> - **10-minute resumable upload retry budget** before user-facing escalation
> - **F5-CRM deal-mapping multi-step flow** (attendee → contact lookup → associated deal(s) → user picks → optional auto-create deal)
> - **Cross-org sharing scope rules** with audit visibility on receiving tenant
> - **Region-aware EU explicit-consent branch** in F3 bot consent
> - **Re-engagement emails at 24h + 72h** for tab-closers in F2
> - **Telemetry ownership matrix** with named owners + thresholds + actions
> - **"Invest-now" visual identity work-stream** — illustration brief flagged for designer
> - **"Receipt" as PROVISIONAL anchor word** — pre-launch card-sort gate before locking
> - **Per-vertical timing differentiation** — clinical doesn't need <3min arrival; non-clinical does
> - **ARIA live regions** on all streaming surfaces
> - **Streaming arrival pattern** with explicit user benefit ("play transcript while summary cooks")
> - **Citation-native interaction** at speaker-turn level with click-to-seek + 5s pre-roll
>
> Specifically:
> 1. Update existing FR descriptions where needed to reflect locked specifics (don't expand the count unnecessarily — only add new FRs where the locked spec introduces functionality not yet in the FR list).
> 2. Add new FRs as needed (likely FR67 onwards). Probable additions: tab-closer re-engagement emails, telemetry ownership matrix, real-time heartbeat detection, 10-min retry budget, F5-CRM deal mapping, cross-org sharing scope rules, F2-admin flow, region-aware consent branch, EU stack ARIA-streaming.
> 3. Update epic descriptions to reference the locked decisions (replacing "WIP" / "TBD" / vague references).
> 4. **Draft fresh stories inline** at the end of `epics.md` (BMAD pattern — `## Stories by Epic` section). For each of the 15 epics, draft 3–8 stories that decompose the epic into implementable units. Story format: title, user-facing description, acceptance criteria, FRs covered.
>
> Update the frontmatter `stepsCompleted` and `lastStep` to reflect step 2 of `create-epics-and-stories`. Update `notes` with any decisions made during revision.
>
> Output: revised in-place `epics.md` (single file). Report a brief summary at the end of what you changed and added.

---

### Agent B — Solution architecture deep-dive on new patterns

**Subagent type:** `general-purpose`

**Prompt:**

> You are doing a solution-architecture deep-dive on technical patterns introduced by the AI Secretary UX design spec that aren't yet covered in `docs/architecture.md`.
>
> Read in full:
> 1. `~/ai-secretary/docs/architecture.md` (the locked architecture)
> 2. `~/ai-secretary/_bmad-output/planning-artifacts/ux-design-specification.md` (the locked UX spec)
>
> Then write a new file at `~/ai-secretary/_bmad-output/planning-artifacts/arch-addendums.md` covering:
>
> 1. **Style Dictionary token build pipeline** — source-of-truth in `packages/design-tokens/tokens.json`; outputs `tokens.css` (web Tailwind), `tokens.tailwind.js` (Tailwind theme extension), `tokens.native.ts` (RN typed objects); WCAG AA contrast check as CI gate; static fallback generation for `color-mix()`. Detail the build pipeline architecture, token taxonomy, and CI integration.
> 2. **ARIA streaming infrastructure** — taxonomy of live region announcements (polite vs. assertive) for streaming receipt (Step 10 F1), RAG chat (F4), capture-at-risk failures, citation arrivals. Specify component contracts that surface streaming state through ARIA without component authors having to reimplement per-feature.
> 3. **F5-CRM deal-mapping mechanics** — Chrome extension overlay vs. server-side CRM sync; attendee-email lookup; deal-ranking algorithm; deal auto-create; permission/auth flow with HubSpot, Salesforce, Pipedrive; queued retry pattern; audit-log integration. Address the multi-step flow described in UX spec F5-CRM.
> 4. **F2-admin flow + DPA gate** — blocking DPA acceptance step; region-pin lock-after-selection; retention defaults configuration; integration credentials surface; SSO config; tenant provisioning lifecycle. Specify schema changes (probably `tenant_state` enum, `dpa_accepted_at`, `data_region` fields).
> 5. **Real-time heartbeat detection for capture-at-risk** — heartbeat protocol (mobile / web client → server every 30s); detection model (lost heartbeat >90s); push notification dispatch; retry-vs-fail decision tree. Spec the protocol AND the bot-service liveness ping equivalent for F3.
> 6. **10-minute resumable upload retry budget** — retry algorithm, backoff strategy, persistence of in-flight uploads across app restarts, failure escalation handoff to user.
> 7. **Region-aware EU explicit-consent branch in F3** — participant-region detection from meeting metadata; consent-shape branching (legitimate-interest implicit vs. EU explicit); 60-second opt-in window; per-participant exclusion via diarization; org-policy override matrix.
>
> For each section: data flow / sequence diagram (Mermaid), schema changes if any, integration points with existing architecture, failure modes, and one or two ADRs (ADR template at `~/ai-secretary/docs/decisions/0001-template.md`) for non-trivial deviations.
>
> If any of the 7 patterns has a clean architectural fit that doesn't require an addendum (just a documented pattern), say so explicitly — don't pad. The output should be technically dense, not verbose.

---

### Agent C — Open-work bundle (designer brief + research plans + checklists)

**Subagent type:** `general-purpose`

**Prompt:**

> You are bundling the "open work flagged for parallel" items from the AI Secretary UX design spec into a single coordinated set of deliverables.
>
> Read in full:
> 1. `~/ai-secretary/_bmad-output/planning-artifacts/ux-design-specification.md`
>
> Then create a folder `~/ai-secretary/_bmad-output/planning-artifacts/open-work/` and write the following five files:
>
> 1. **`designer-brief.md`** — Brief for an external visual / illustration designer or contractor. Cover:
>    - Three illustration deliverables (3 sample-meeting library illustrations, 2 streaming-receipt skeleton motion illustrations, 1 first-launch hero) — content scope per Step 9
>    - Visual signature follow-up on `RecordingStatusPill` V2 inline-waveform — animation refinement, reduced-motion fallback
>    - Visual signature follow-up on `CitationChip` V2 iconic glyph — final glyph design
>    - Style references (Linear North Star, Granola receipt-screen craft commitment, GOV.UK plain-language register on consent surfaces)
>    - Hard constraints (no module color-coding, monochrome restraint, three density modes, three motion modes)
>    - Deliverable formats and timeline ask
>
> 2. **`card-sort-plan.md`** — Plan for the 5-person card sort to validate or replace the "receipt" anchor word. Cover:
>    - Whole-phrase usage test: *"I'll have my [receipt / brief / debrief / dossier / wrap] in three minutes"*
>    - English + French (per i18n locked-in)
>    - Per-vertical wording exploration (clinical "session note" / *compte rendu* may differ)
>    - 5 participant recruitment criteria (mix of primary personas)
>    - Method, materials, analysis approach
>    - Threshold for keep-vs-replace decision
>
> 3. **`customer-dev-interview-plan.md`** — Plan for 5–10 customer-development interviews per primary persona. Cover:
>    - Personas to recruit (Sales rep, Therapist as Day-1 primary; Org admin, Team lead as cross-cutting)
>    - Discussion guide outline (jobs-to-be-done framework)
>    - What to validate vs. what to discover (validate: receipt content shape, mental-model fit; discover: unmet needs, current workarounds)
>    - Recruiting / scheduling / synthesis cadence
>    - Pre-launch timing — recommended, not gating
>
> 4. **`reduced-motion-audit-checklist.md`** — Pre-launch checklist for the reduced-motion audit committed in Step 8. Cover:
>    - Every animated component verified to respect `--motion-base: 0ms`
>    - Lint rule for hardcoded transition durations not referencing motion-mode tokens
>    - Per-component checklist (RecordingStatusPill waveform, ReceiptStreamLayout streaming animations, CitationChip flash, etc.)
>    - Test methodology (OS preference toggle + DevTools simulation + Storybook stories)
>    - Sign-off owner
>
> 5. **`telemetry-ownership-matrix.md`** — Detailed extension of the matrix sketched in Step 10 F2. Cover:
>    - Every signal collected in F1–F5 + F2-admin (first-receipt thumbs, mental-model free-text, 7-day activation, tab-closer re-engagement, expected-arrival-time accuracy, citation click-through, share recipient view, RAG retrieval confidence distribution, capture-at-risk detection lead-time, etc.)
>    - Named owner per signal (Growth PM, Product, Engineering, Compliance, etc.)
>    - Review cadence (weekly / monthly / quarterly)
>    - Threshold-action mapping (specific number triggers specific action)
>    - Storage location (PostHog / internal table / Sentry)
>    - Privacy / retention rules per signal
>
> Each file is concise but actionable. Anthony will hand designer-brief.md to a contractor; card-sort-plan.md and customer-dev-interview-plan.md are run by an internal researcher (or him); reduced-motion-audit-checklist.md and telemetry-ownership-matrix.md become living documents that engineering and product own.

---

## Sequential follow-up after the three agents return

In order:

1. ✅ Review each agent's output; note discrepancies / open questions.
2. ✅ Reconcile any cross-agent contradictions (see [reconciliation-note.md](_bmad-output/planning-artifacts/reconciliation-note.md)).
3. ✅ Confirm reconciliation with Anthony.
4. ⏭ **Set up Storybook web + Storybook RN scaffolding (Phase 0 per Step 11 roadmap).** ← next
5. ⏭ Style Dictionary token build pipeline + WCAG contrast CI gate per ADR-0002.
6. ⏭ Build `RecordingStatusPill` V2 + `AnalysisCard` contract (Phase 0 priorities — these block Phase 1 work).
7. ⏭ Begin Phase 1 capture-loop component build-out per Step 11.

## Reconciliation outcome (2026-04-29)

Three parallel agents (epics revision / arch addendums / open-work bundle) returned cleanly. Cross-read found:

- **3 P0 gaps closed:**
  - G1 — Cross-tenant audit-log writes: `arch-addendums.md` extended with §8 + ADR-0006 (`inbound_shares` table on receiving tenant; no RLS bypass).
  - G2 — Story 9.5 EU per-participant override: `epics.md` Story 9.5 AC sharpened to make the GDPR per-participant override explicit.
  - G3 — Story 12.1 `tenant_state` FSM: `epics.md` Story 12.1 AC rewritten to consume the FSM + plugin + trigger + `tenant_settings` field set per ADR-0004.
- **5 P1 naming-drift items (N1–N5) deferred** to per-sprint story sharpening (handled by `create-story` workflow against the reconciliation note as input).
- ADRs 0002–0006 are PROPOSED in `arch-addendums.md`. Promotion to `docs/decisions/0002-…` through `0006-…` happens after first-implementation validates each pattern.

## Implementation-readiness outcome (2026-04-29 — same day, post-reconciliation)

Ran `bmad:bmm:workflows:check-implementation-readiness` (6-step BMAD workflow). Results:

- **97% functional / 100% NFR coverage** of PRD-derived requirements
- **9 issues identified:** 1 critical (EQ-1 push-notification forward dep) + 3 major (Gap-EC1 email infra, Gap-EC2 trial policy, Gap-UX1 speaker-turn schema) + 5 minor

**Same-session fix-pass — critical + 3 major all closed:**

- **EQ-1 + Gap-EC1 (combined fix):** `packages/notifications` foundation now ships in Epic 1 Story 1.10 covering both push (Expo) + email (Postmark/SES/SMTP) with provider-agnostic interface, dedup, user-preferences, audit. New FR80 (email pluggability) + FR82 (notifications package contract). FR60 mapping moved from Epic 15 → Epic 1 foundation. Stories 4.4 / 4.5 / 9.6 / 14.1 / 15.5 / 15.6 updated to consume the abstraction. `arch-addendums.md` §5 extended with full package contract + consumer matrix.
- **Gap-EC2 (trial policy):** New FR81 + new Story 13.7. ADR-0004 extended with trial-fields migration (`trial_kind`, `trial_starts_at`, `trial_ends_at`, `trial_card_on_file`, `trial_expired_at` — separate fields on `tenants`, NOT enum-bloat on `tenant_state` — keeps lifecycle/billing concerns orthogonal). Trial-end transition matrix documented. New audit actions for trial lifecycle.
- **Gap-UX1 (speaker-turn schema):** Story 2.4 AC now pins `speaker_turns` table schema with stable hash IDs + stability commitment + citation deep-link contract `(meetingId, turnId)` consumed by Story 3.5 + Story 8.6. Closes N5 from reconciliation.

**5 minor items remaining** (none Phase 0 blocking; deferred to per-sprint story sharpening or post-launch retrospective):
- VoiceInputSurface package boundary (sprint-planning at Story 5.7)
- PRD-EX3 staleness (live-captions exception for accessibility — PRD text update post-launch)
- `architecture.md` should reference `arch-addendums.md` (10-min doc-hygiene edit)
- Story 12.1 likely needs sprint-planning split (8 sub-steps in F2-admin flow)
- Stories 14.7 + 14.8 likely need sprint-planning split (HIPAA chain + EU stack)

**FR count:** 79 → **82** (added FR80, FR81, FR82). All mapped. Epic count unchanged at 15. Story count: 80 → 82 (added Story 1.10, Story 13.7).

## Memory references

Memory at `~/.claude/projects/-Users-anthony-ai-secretary/memory/`:
- `user_anthony.md` — Anthony's role + product context
- `feedback_collaboration_style.md` — terse confirms, lead with synthesis, party-mode aggressively
- `project_ai_secretary_state.md` — current state + close-call decisions worth remembering
- `reference_deliverables.md` — file locations
- `MEMORY.md` — index

Read MEMORY.md first; pull the relevant entries.
