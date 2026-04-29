---
stepsCompleted: [1, 2]
inputDocuments:
  - docs/mini-prd.md
  - docs/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
project_name: 'AI Secretary System'
user_name: 'Anthony'
date: '2026-04-29'
workflowType: 'create-epics-and-stories'
status: 'in-progress'
lastStep: 2
notes:
  - 'UX spec is the source of truth for UX/accessibility — defer to its locked values where they tighten or replace PRD §9.'
  - 'PRD has no explicit FR numbering; FRs are derived from journeys (J0–J13), commitments (§12), pricing axes (§8), integrations (§10), and the locked UX spec.'
  - 'FR60 (push notifications) is NOT deferred — implementation is in scope.'
  - '2026-04-29 revision (step 2): absorbed locked UX-spec decisions that post-dated the step 1 draft.'
  - 'WCAG 2.2 Level AA Day-1 with WCAG AAA target sizing (44×44 minimum) across dense + relaxed; 48px on accessible. AA was a draft underspecification; the locked target is AA + AAA touch.'
  - 'Visual identity locks: Geist + Geist Mono typography; single-accent indigo (#4f46e5 light / #818cf8 dark); monochrome restraint elsewhere; Style Dictionary token build pipeline with WCAG contrast CI gate is Day-1 foundation.'
  - 'Three coexisting app shells over one component library: AppShell.Inbox (D1 default), AppShell.Cards (D3 single-user mode), AppShell.Search (D4 power-user toggle). Same components, different shell.'
  - 'Canonical primitives: RecordingStatusPill V2 inline-waveform (recording-status across every surface) and CitationChip V2 iconic glyph (every cited claim, click → seek + 5s pre-roll). Other variants are discarded.'
  - 'F2-admin (org-admin first-launch) is structurally distinct from F2 (user first-launch) — DPA acceptance + region pin + retention defaults + disclosure config + module enablement + integrations + SSO + invites are blocking steps. Tracked in Epic 12.'
  - 'Clinical capture detangles ModuleConfirmModal (clinician confirms vertical) from ConsentDisclosureCard (patient sees disclosure). Two distinct UI moments at capture-time. Tracked in Epic 6 + Epic 14.'
  - 'Capture-at-risk failure detection is real-time: 30s heartbeat from capturing client + 30s liveness ping from bot service; lost heartbeat triggers push within 60s. Resumable upload retry budget is 10 minutes silent before user-facing escalation.'
  - 'F5-CRM is a designed multi-step deal-mapping flow (attendee lookup → contact match → associated deal(s) ranking → user picks → optional auto-create). Not a single button. Tracked in Epic 15.'
  - 'Cross-org sharing: token URLs to recipients in another AI Secretary tenant appear as inbound shares in the receiving tenant audit log; receiving-org admin can configure accept-policy enforced at view-time, not send-time. Tracked in Epic 8 + Epic 12.'
  - 'F3 bot consent is region-aware: EU + strict-policy = explicit per-participant chat-command opt-in (60s window); non-EU OR legitimate-interest = implicit-by-staying with chat-command opt-out. Org admin configures policy in F2-admin. Tracked in Epic 9 + Epic 12.'
  - 'F2 tab-closer re-engagement = email at 24h (sample-meeting CTA) + email at 72h (import-audio CTA) + 30d cooldown after non-response. Tracked in Epic 1.'
  - 'Telemetry ownership matrix: every signal has named owner (Growth PM / Product) + review cadence + threshold-action rule. Signals without an owner are not collected. Tracked in Epic 1 telemetry foundation; consumers in Epics 2/3/4/13.'
  - '"Invest-now" visual identity work-stream: illustration brief (3 sample-meeting library + 2 streaming-receipt skeleton + 1 hero) handed off to designer in parallel. Component skeletons render without illustrations. Tracked in Epic 1 + Epic 2.'
  - '"Receipt" is provisional anchor word. 5-person card sort runs pre-launch on whole-phrase usage to validate against alternatives (brief / debrief / dossier / wrap / recap). Per-vertical wording allowed (clinical = session note / compte rendu; education = recap). Tracked in Epic 1 + Epic 3.'
  - 'Per-vertical timing differentiation: clinical (medical / psychology) does NOT need <3min arrival; <30 min is acceptable and lets pipeline spend cycles on quality (better diarization, clinical-quality checks). Non-clinical verticals get <3min target. Reflected in Epic 2 SLA copy + Epic 6 pipeline configuration.'
  - 'Streaming arrival pattern is cross-cutting: frame first / content later, each stage labeled, ARIA live region polite announcements per stage, "play transcript while summary cooks" affordance. Used in Epic 2 (receipt) + Epic 7 (RAG chat) + future export progress.'
  - 'Citation-native interaction at speaker-turn level: every analytic claim carries a CitationChip; click → open TranscriptSeekPlayer, seek to span, play 5s pre-roll. Citation-required is enforced as analysis-quality CI check, not optional. Tracked in Epic 3 + Epic 7.'
  - 'ARIA live regions on every streaming surface: receipt streaming (per stage, polite), RAG chat (per chunk + per citation, polite), capture-at-risk failures (assertive). Tracked in Epic 2 + Epic 4 + Epic 7.'
  - 'FR list expanded from 66 to 79 to absorb locked specifics. New FRs: FR67 (heartbeat detection), FR68 (10-min upload retry budget), FR69 (region-aware bot consent branch), FR70 (tab-closer re-engagement emails), FR71 (telemetry ownership matrix), FR72 (F2-admin first-launch flow), FR73 (F5-CRM deal-mapping multi-step flow), FR74 (cross-org sharing scope policy), FR75 (Style Dictionary token build pipeline + WCAG contrast CI gate), FR76 (Geist + indigo brand foundation), FR77 (three app shells), FR78 (citation-native click-to-seek with 5s pre-roll), FR79 (per-vertical receipt timing differentiation).'
  - 'NFR28 (accessibility) tightened from WCAG 2.2 AA to "WCAG 2.2 AA Day-1 + WCAG AAA touch targets (44×44 across dense+relaxed; 48px accessible)" to match locked UX spec.'
  - 'Stories drafted inline at end of file under "## Stories by Epic" — 3-8 stories per epic, in BMAD inline format (title / description / acceptance criteria / FRs covered). Detailed story files generated by create-story workflow per sprint.'
  - '2026-04-29 reconciliation pass: cross-read against arch-addendums.md surfaced 3 P0 gaps (cross-tenant audit-log writes, EU per-participant override semantics, tenant_state FSM consumption in F2-admin AC) + 5 P1 naming-drift items deferred to per-sprint story sharpening. P0 fixes: §8 + ADR-0006 added to arch-addendums.md (inbound_shares table); Story 9.5 AC tightened with per-participant EU override + packages/consent references; Story 12.1 AC rewritten to consume tenant_state enum + tenant-state-check plugin + enforce_region_lock trigger + tenant_settings field set per ADR-0004. See _bmad-output/planning-artifacts/reconciliation-note.md for full audit + N1–N5 sprint-pickup list.'
  - '2026-04-29 implementation-readiness pass: 9 issues identified (1 critical + 3 major + 5 minor). Three critical/major closed in-place: EQ-1 (push-notification forward dependency Epic 4+9 → Epic 15) + Gap-EC1 (email pluggability promise unfulfilled) closed via packages/notifications foundation (FR80 + FR82) shipping in Epic 1 Story 1.10; Gap-EC2 (trial policy mechanism) closed via FR81 + new Story 13.7 + ADR-0004 trial-fields extension; Gap-UX1 (speaker-turn-level addressable schema not pinned) closed via Story 2.4 AC speaker_turns schema + stability commitment + citation deep-link contract. Stories 4.4 / 4.5 / 9.6 / 14.1 / 15.6 updated to consume packages/notifications. FR count: 79 → 82. See _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-29.md for full assessment + remaining minor items (PRD-EX3 staleness, architecture-doc cross-reference, Stories 12.1/14.7/14.8 sprint-planning split, VoiceInputSurface package boundary).'
---

# AI Secretary System - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AI Secretary System, decomposing the requirements from the PRD, locked UX Design Specification, and Architecture decisions into implementable stories.

## Requirements Inventory

### Functional Requirements

> Source PRD frames functionality through 13 user journeys (J0–J13), 8 vertical analysis modules, integrations, and product commitments. The locked UX Spec adds three coexisting app shells (D1 + D3 + D4), V2 canonical primitives (RecordingStatusPill, CitationChip), F2-admin separate from F2, region-aware consent, F5-CRM multi-step flow, cross-org sharing scope, per-vertical timing differentiation, telemetry-with-owners discipline, brand foundation (Geist + indigo), and Style-Dictionary token build pipeline. The FRs below are derived and consolidated from all three sources.

**Onboarding & Identity**

- **FR1:** Users can self-serve sign up with email/password and complete signup in ≤ 60 seconds (J0).
- **FR2:** Users can authenticate via email/password, Google OAuth, Microsoft OAuth, or SAML (Enterprise tier).
- **FR3:** Users can enable TOTP-based MFA; org admins can enforce MFA org-wide.
- **FR4:** First org admin can invite additional users; invited users join the tenant via email link.
- **FR5:** First-launch homepage (`F2` user flow) shows the `EmptyStateRecipient` component with sample meeting library (synthetic content only) **co-equal** to a prominent "import existing audio" CTA. First three receipts get extra polish (illustrations, gentle pop-ins, thumbs prompt) then dial back to calm default.

**Recording & Capture**

- **FR6:** Mobile (Expo + PWA) and web users can start recording with a single tap from any surface.
- **FR7:** Mobile app captures audio with offline-first queueing and resumable background upload (expo-task-manager + expo-background-fetch). iOS background-audio entitlement and Android foreground-service required for background-safe capture.
- **FR8:** Users can upload existing audio/video files up to 4 hours / 2 GB via drag-drop with chunked, resumable uploads (J2).
- **FR9:** Recording UI displays org-configurable consent disclosure pre-mic-activation; account-holder must acknowledge before recording starts (consent shape A).
- **FR10:** For in-person recording, the recording UI can present a QR code or short URL that third parties scan/tap to acknowledge consent; acknowledgment timestamps are stored alongside the meeting (consent shape C — required when org config flags it).
- **FR11:** A single recording-status primitive — **`RecordingStatusPill` V2 inline-waveform** — appears identically across phone lock screen, browser tab pill, bot status row, embed surfaces, and calendar markers. It is canonical; the V1 (pulse-dot) and V3 (gradient ring) variants are discarded. Reduced-motion fallback freezes the bars in static elevated position with ARIA-only confirmation.

**Bot-Captured Meetings (Zoom & Teams)**

- **FR12:** Org admins can connect Zoom via OAuth; the meeting bot auto-joins scheduled meetings within 30 s of meeting start (J3).
- **FR13:** Org admins can connect Microsoft Teams; the meeting bot auto-joins scheduled meetings (J3).
- **FR14:** On join, the bot announces presence and disclosure via TTS first, posts disclosure URL to chat second, and records per-participant acknowledgment timestamps (consent shape B). TTS-first / chat-after order is locked.
- **FR15:** When live capture is unavailable, the bot uploads recordings post-meeting from the host platform.

**Calendar Integration**

- **FR16:** Org admins/users can connect a calendar via Nylas (covers Google + Microsoft + Exchange + iCloud); sync lag ≤ 5 minutes (J4).
- **FR17:** Users can opt in to auto-record per meeting; the per-meeting record toggle persists across syncs (J4).

**Transcription**

- **FR18:** System transcribes recordings using OpenAI Whisper API or self-hosted faster-whisper, routed per tenant configuration.
- **FR19:** System runs speaker diarization on transcripts (Pyannote pass for whisper-api engine; native diarization for faster-whisper). Speaker turns are addressable for citation anchoring.
- **FR20:** Pipeline produces transcript + summary + action items within ≤ 3 minutes after recording stops for ≤ 30-minute audio for **non-clinical verticals** (J1). Clinical verticals (medical / psychology) target <30 min — see FR79.

**Summarization & Action Items**

- **FR21:** System generates a meeting summary within ≤ 60 s after transcript completes for non-clinical verticals.
- **FR22:** System extracts action items including owner and due date from each meeting transcript. Owner + date are pre-parsed and one-tap accept/edit on receipt.
- **FR23:** A cross-meeting "My Actions" space rolls up action items with status, due date, and source-meeting backlink.

**Vertical Analysis Modules (8)**

- **FR24:** System runs vertical-specific analysis on a meeting on demand; output ≤ 90 s for non-clinical; output validates against module schema; cites transcript spans (J6).
- **FR25:** System provides eight first-party analysis modules at MVP: General, Sales, HR/Hiring, Education, Medical/Behavioral Health, Customer Support, Project Management, Psychology.
- **FR26:** Each module is implemented as a config (prompt + output schema + scoring rules); adding a 9th vertical = author one config file with no platform deploy.
- **FR27:** Analysis output renders through the **`AnalysisCard`** shared component contract with module-aware content slots; per-vertical density variants (Medical / Psychology default to relaxed; others dense) and per-vertical copy register (clinical = reflective; non-clinical = snappy) apply automatically through tokens. Module identity is icon + label, never hue (controlled audit-log exception only).

**Search & Chat (RAG)**

- **FR28:** Users can search the meeting corpus (full-text + semantic) and receive ranked snippets with timestamps and deep-links to transcript anchors; p95 < 2 s on a 100K-meeting corpus (J5). cmd-K command palette is one keystroke away on web with locked keyboard contract (↑/↓ cycle, Enter open, Esc close, focus trap on open).
- **FR29:** Users can chat with the corpus via RAG; the system returns grounded answers with citations to specific transcript spans, streaming with citation chips populating inline (J7). Four empty-state shapes: confident, low-confidence-with-rank-chips, "I don't know," off-topic.
- **FR30:** Chat refuses ungrounded claims; faithfulness must meet ≥ 90% on the internal eval set.

**Sharing & Collaboration**

- **FR31:** Users can share a meeting (or clip, or single insight) with teammates via tenant-internal share grant with owner / editor / viewer roles (J8). Token URL default scope is org-internal; configurable.
- **FR32:** Users can share a meeting via read-only token URL viewable without account login. Default expiry 30 d, configurable. Expired tokens show a clear "this share has expired" page with "request new link" CTA.
- **FR33:** Recipients see only what was explicitly shared; tenant + share-scope isolation is enforced and audit-logged. Audit entry shape includes meeting/share/scope/recipient identity/token-URL hash (never raw URL)/expiry/region.
- **FR34:** Team leads / supervisors have a parallel product space showing aggregated team meetings, analysis trends, and a coaching surface (`ManagerCoachingCard`) — annotate teammate's meeting at span level, share feedback. Surveillance aesthetic explicitly avoided.

**LMS Integration**

- **FR35:** System supports LTI 1.3 deep-linking launch from an LMS (J9).
- **FR36:** System supports LTI 1.3 AGS gradebook passback.

**Billing, Entitlements, Plans**

- **FR37:** Stripe webhook events (`customer.subscription.*`) update `tenant_entitlements` transactionally (Gap R1).
- **FR38:** API enforces module entitlement check at every API boundary (refuses access to disabled modules) (J12).
- **FR39:** API enforces seat ceiling per tier; meeting-hour overage above tier-included allotment is tracked and billable.
- **FR40:** System supports four tiers — Free, Pro, Business, Enterprise — with the entitlement axes defined in PRD §8 (modules[], max_seats, max_meetings_per_month, max_audio_hours_per_seat_per_month, retention_days_*, regions[], deployment_topology, sso_types[], mfa_enforced, baa_signed, custom_kms_key_id).

**Org Admin Console (parallel product space)**

- **FR41:** Org admins manage seats (add / remove / role assignment).
- **FR42:** Org admins configure tenant integrations (Zoom, Teams, Nylas, Slack, HubSpot, Salesforce, Pipedrive).
- **FR43:** Org admins configure retention policy per asset type (audio, transcripts, embeddings); a scheduled purge job enforces and audit-logs (J11). Per-vertical overrides supported.
- **FR44:** Org admins configure module entitlements (which of 8 modules enabled).
- **FR45:** Org admins configure recording disclosure copy per org (used in pre-mic modal + bot announcement + patient artifact).
- **FR46:** Org admins configure whether in-person 3rd-party consent is required (consent shape C toggle).
- **FR47:** Org admins configure tenant region pinning (US or EU); tenant `data_region` is enforced at storage and LLM-call layers (J10). Locked once selected at provision time.
- **FR48:** Org admins configure SSO types (email, google, microsoft, saml) and MFA enforcement.
- **FR49:** Org admins view a queryable, filterable, exportable audit timeline (`AuditLogTable`). Module-tinted left-border on rows is the controlled exception for compliance review only.

**Compliance & Privacy**

- **FR50:** System provides a self-service GDPR DSAR endpoint that produces a zip export within ≤ 24 hr (J13).
- **FR51:** System honors right-to-erasure within 30 days, propagating deletes across audio, transcripts, summaries, analyses, and embeddings (per the erasure-cascade map registered in Epic 1 and updated by every later epic that introduces tenant-scoped data).
- **FR52:** System provides a public-facing, no-auth DSAR portal at a known URL (e.g., `aisecretary.app/data-rights`) for non-account third parties; identity-verified submissions propagate to the correct tenant's admin queue. Plain-language register (GOV.UK-style).
- **FR53:** Admin DSAR processing surface (`DsarQueueItem`) previews cascade scope ("47 transcripts, 12 summaries, 3 analyses, 1,200 embeddings — confirm") before commit.
- **FR54:** Every state-changing operation is recorded in the append-only `audit_logs` table (tenant-scoped read; export endpoint for DSAR).
- **FR55:** Clinicians have access to a screen-shareable patient-facing disclosure artifact — **`ConsentDisclosureCard`** — for in-session use (consent shape D). Three variants: `inline` (in-office, on clinician screen), `screenshare` (full-screen presentation), `link` (URL pre-emailed for telehealth). Auto-applies relaxed density and large touch targets.

**Embed & Distribution Surfaces**

- **FR56:** Chrome extension overlay surfaces AI Secretary in HubSpot, Salesforce, and Pipedrive.
- **FR57:** Slack hub app pushes meeting receipts into team chat.
- **FR58:** Teams hub app pushes meeting receipts into team chat.

**Real-time & Notifications**

- **FR59:** Web client receives real-time updates via SSE (`event: transcription.completed`, `event: meeting.summarized`, etc.) and refetches via React Query.
- **FR60:** Mobile client receives push notifications when meeting analysis completes. Push delivery + dispatch are owned by `packages/notifications` (FR82) shipped in Epic 1 foundation; Epic 15 adds LMS / CRM / Slack / Teams hub-app event types as a consumer. Push is also used for capture-at-risk (FR67) and upload-retry-budget (FR68) escalation.

**UX Capabilities (cross-cutting)**

- **FR61:** System supports three density modes — `dense | relaxed | accessible` — auto-applied via OS prefers-contrast / prefers-reduced-motion media queries with a manual override in settings. Precedence: explicit user choice > OS preference > vertical default.
- **FR62:** Voice / dictation is a first-class input on mobile via `VoiceInputSurface` (SOAP edits, action-item check-off, summary edits, free-text fields).
- **FR63:** System provides a "single-user mode" that hides team-lead, admin sub-product, and embed/CRM surfaces by default; a settings toggle ("organization features") reveals enterprise surfaces when the user joins an org or upgrades. Implemented as feature-visibility layer over the same component library — not a separate codepath.
- **FR64:** Locked-module upsell pattern surfaces an inline "try [Module] analysis on this meeting" CTA when a user views a meeting eligible for a module they don't have entitled.
- **FR65:** Live captions are rendered to participants during recording (same transcript pipeline) for deaf / HoH accessibility. Caption text in semantic markup; matches `accessible` density when active.

**Internationalization**

- **FR66:** UI is available in English and French at launch via i18next (web) + expo-localization (mobile); architecture supports adding locales without a redeploy. Per-vertical anchor word allowed (clinical may use *session note / compte rendu*; education may use *recap*).

**Capture-at-Risk Detection & Recovery**

- **FR67:** Real-time heartbeat detection — capturing client (mobile / web / bot) emits liveness ping every 30 s. Lost ping for >90 s triggers detection; push notification fires within 60 s of detection (*"Recording may have stopped on phone — open AI Secretary to verify"*). Bot-service uses the same 30 s liveness pattern; on lost ping, push + email + in-app banner + offer "Upload from Zoom Cloud" fallback.
- **FR68:** Resumable upload retry budget — 10 minutes of silent retry on transient network failure before user-facing escalation. At budget exhaustion, push + email + banner with explicit options (retry now, upload manually, contact support). The receipt frame remains visible during retry; retry status is a non-blocking subtle banner.

**Region-Aware Consent**

- **FR69:** F3 bot consent branches on participant region:
  - Non-EU OR org policy = legitimate-interest → implicit acknowledgment by staying; chat-command `opt-out` available; per-participant policy applies.
  - EU AND org policy = explicit-consent → explicit per-participant chat-command `opt-in` with 60 s window; absent opt-in = audio diarized but participant excluded; chat-pinged reminder.
  - Org policy is configured by admin in F2-admin (Disclosure step); default is conservative (explicit for EU, legitimate-interest for US).
  - Strict-policy + opt-out branch options: auto-quarantine entire recording for admin review OR per-participant exclusion (admin-configured).

**Re-engagement (F2 tab-closer)**

- **FR70:** Tab-closer re-engagement emails — when a new user closes their first-launch tab without acting, a system email fires at 24 h ("Want to see what AI Secretary does? Try a sample meeting →") and at 72 h ("Got a recording from yesterday? Drop it here →"). Non-response after 72 h marks the user as cold lead with 30 d cooldown before next email. All re-engagement honors notification preferences and is unsubscribable.

**Telemetry Ownership**

- **FR71:** Every product telemetry signal collected has a named owner (Growth PM / Product / Eng) + review cadence + threshold-action mapping recorded in a registry. Signals without an owner are not collected. Initial registry includes: first-receipt thumbs (Growth PM, weekly, <50% positive over 100+ receipts → trigger receipt design review), mental-model validation free-text (Growth PM + Product, weekly, >40% mismatch with anchor word → trigger word-choice card sort revisit), 7-day activation rate (Growth PM, weekly, <60% sustained 4 weeks → trigger F2 redesign), tab-closer re-engagement open rate (Growth PM, monthly, <20% → revise email copy).

**Org Admin First-Launch (F2-admin)**

- **FR72:** Org-admin first-launch flow is structurally distinct from user F2 — sequence:
  1. Tenant-wide DPA acceptance (blocking; declined → account suspended; contact sales for custom DPA).
  2. Choose data region (US / EU; locked once selected at provision time; region-pin error → block + support ticket).
  3. Configure consent disclosure text (org-specific copy used by pre-mic modal + bot announcement + patient artifact).
  4. Set retention defaults (audio 30d / 90d / indefinite; transcript retention; per-vertical overrides).
  5. Enable verticals (which of 8 modules are active).
  6. Optional: connect integrations (Nylas / Zoom / Teams / Slack / HubSpot / Salesforce / Pipedrive).
  7. Optional: configure SSO (Google / Microsoft / SAML).
  8. Invite users (seat allocation).
  9. Land on admin home (dashboard / audit / DSAR queue / settings sub-product).
  - No sample-meeting library on the admin path (admins aren't trying to capture meetings).

**CRM Deal-Mapping (F5-CRM)**

- **FR73:** "Push to CRM" on receipt opens a multi-step deal-mapping flow:
  1. Lookup attendees in CRM by email match → contact records.
  2. Branch on contact result: none → offer create / cancel; one contact + one deal → auto-fill, user confirms; N contacts × M deals → show ranked list (recently active deals matching all attendees first); contact exists, no deal → offer create deal / attach to contact only / cancel.
  3. Push receipt summary + actions to selected target as activity note + linked transcript.
  4. Toast confirmation with link to deal in CRM.
  5. Audit log entry: `meeting.pushed-to-crm` with target system + deal ID.
  - Failure modes: API timeout queues retry up to 5 min then notifies; permission error deep-links to re-auth + queues retry post-auth; multiple matching deals never auto-pick — always show ranked list and require user confirm.

**Cross-Org Sharing**

- **FR74:** When sharing to a recipient whose email belongs to another AI Secretary tenant, the share appears as inbound in that tenant's audit log (*"shared from acme.com"*). Receiving-org admin can configure cross-org accept policy — accept all / whitelisted domains only / block all external. Policy is enforced at view-time (recipient sees "blocked by your org" page if denied), not send-time (sender always succeeds).

**Design System Foundation**

- **FR75:** Style Dictionary token build pipeline emits design tokens to web (Tailwind config + CSS variables) and mobile (NativeWind). A WCAG contrast CI gate runs on every PR touching tokens — fails the build on any AA regression for body text (≥4.5:1), large text (≥3:1), or non-text UI (≥3:1). A reduced-motion lint rule flags any transition declaration not referencing the motion-mode token. `color-mix()` and adjacent helpers are pre-computed to static fallbacks at build time.
- **FR76:** Brand foundation locks: **Geist** for UI / body / headings, **Geist Mono** for IDs / audit log / timestamps / citation chips. Single accent indigo: `#4f46e5` (light) / `#818cf8` (dark). Monochrome restraint elsewhere; modules differentiated by lucide icon + label, never hue. First-receipt empty-state illustration system handed off to designer in parallel work-stream (3 sample-library + 2 streaming-receipt skeleton motion + 1 hero illustration); component skeletons render without illustrations until designer work lands.

**App Shells**

- **FR77:** Three coexisting top-level layout shells over one shared component library:
  - `AppShell.Inbox` (D1 default) — persistent left sidebar (Today / My Actions / Search / Chat / Recordings / Settings) + top crumb bar with cmd-K + recording status pill + content pane. For org-context users, any vertical.
  - `AppShell.Cards` (D3 single-user mode) — minimal top header (logo + cmd-K + recording status pill + avatar) + single-column card feed. No sidebar, no admin sub-product, no embed/CRM features. For solo users without an org.
  - `AppShell.Search` (D4 power-user toggle) — minimal top header + `SearchHomeShell` as home content. Activates via setting toggle at ~50+ meetings indexed or by user opt-in.
  - Shell selection is at route level based on `tenant.mode` (org vs single-user) and `user.powerUserMode` setting; never per-page.
  - All three shells share same component library, same tokens, same recording-status primitive position (top-right), same cmd-K availability (web).

**Citation-Native Interaction**

- **FR78:** Every analytic claim carries a `CitationChip` V2 (iconic glyph + speaker + timestamp). Click → opens `TranscriptSeekPlayer`, seeks to span at speaker-turn level, plays 5 s pre-roll. Hover → shows transcript snippet + speaker name (when diarized) via Radix Tooltip, keyboard-accessible. A claim without a citation is a regression — flagged by analysis-quality CI checks.

**Per-Vertical Receipt Timing**

- **FR79:** Receipt SLAs differentiate by vertical:
  - **Non-clinical** (Sales / PM / Support / Education / HR / General): time-from-stop to first-streamed-content <30 s; to summary-readable <90 s; to full receipt <3 min (per PRD §5).
  - **Clinical** (Medical / Psychology): time-from-stop to first-streamed-content <60 s; to summary-readable <5 min; to full receipt <30 min acceptable. Module-correct without user override target ≥99% (vs. ≥95% non-clinical) since ModuleConfirmModal at capture is explicit.
  - Spare clinical-pipeline cycles spent on quality (better speaker diarization, additional clinical-quality checks), not speed nobody asked for.
  - Honest expected-arrival-time indicator on receipt frame; updates honestly when target time is exceeded (never hide a slow pipeline).

**Notifications Infrastructure (Implementation-Readiness Additions, 2026-04-29)**

- **FR80:** Pluggable email provider — system supports SMTP / Postmark / SES via `packages/notifications` (provider-agnostic interface; per-tenant routing via `tenant_settings`). Same import-discipline CI rule as `packages/llm-gateway` / `packages/storage` / `packages/transcription`. Required for re-engagement emails (FR70), DSAR delivery (Story 14.1), trial reminder emails (FR81), transactional email at every consent / share / billing / audit-export touchpoint, and on-prem deployments (SMTP-only mode). Closes readiness gap Gap-EC1 (PRD-I5 email-pluggability promise).
- **FR81:** Trial policy mechanism — system tracks tenant trial state via `tenants.trial_kind` (`pro` | `business` | `enterprise_pilot` | null) + `trial_starts_at` + `trial_ends_at` + `trial_card_on_file` fields (per ADR-0004 extension; orthogonal to `tenant_state` lifecycle FSM). Pro = 14-day no-credit-card trial with soft-conversion gate at trial-end; Business = 14-day sales-assisted with admin-flagged conversion path; Enterprise = scoped pilot with custom expiration. Stripe `trial_period_days` is the source-of-truth for date math; webhook `customer.subscription.trial_will_end` triggers reminder emails at T-3d + T-1d via `packages/notifications` (FR82). Trial-end transitions: paid card → auto-convert; no card on Pro → `trial_expired` blocks new mutations + surfaces upgrade CTA; Business / Enterprise → admin contact-sales handoff. Closes readiness gap Gap-EC2 (PRD-E13 trial-policy implementation).
- **FR82:** `packages/notifications` foundation contract — unified push (Expo Push) + email (Postmark / SES / SMTP) + (future) SMS dispatch as a single workspace package. Provides: provider-agnostic interface (`types.ts`); gateway routing per tenant (`gateway.ts`); pg-boss `notification.send` queue handler with per-channel adapters; `notifications` table for tracked dispatch (recipient, channel, payload-hash, status, attempts, dedup-key); dedup logic suppressing repeat pushes within 5 min for same `(recipient, kind, dedup-key)`; user-preference honoring (per-channel opt-out in `user_preferences`); audit-log entries for every send. Day-1 providers: Expo Push (push) + Postmark (email primary) + SES (email fallback / on-prem SMTP). Closes readiness violation EQ-1 (push forward dependency Epic 4 + 9 → Epic 15).

### NonFunctional Requirements

**Performance & SLA**

- **NFR1:** p95 transcription latency ≤ 6× real-time.
- **NFR2:** Summary p95 ≤ 60 s after transcript ready (non-clinical); clinical may exceed per FR79.
- **NFR3:** Search p95 < 2 s on a 100K-meeting corpus.
- **NFR4:** 99.5% pipeline success rate.
- **NFR5:** 99.5% availability per region.
- **NFR6:** 50 simultaneous transcription jobs without queue starvation; horizontally scalable workers.
- **NFR7:** Mobile chunked upload is resumable across network interruptions and app backgrounding; 10-min silent retry budget per FR68.

**Activation & Quality**

- **NFR8:** ≥ 70% of new accounts complete first upload/record within 7 days; ≥ 50% return in week 2.
- **NFR9:** ≥ 80% summary "useful?" thumbs-up across modules (revisit per-vertical post-launch).
- **NFR10:** RAG chat faithfulness ≥ 90% on internal eval set.

**Cost**

- **NFR11:** LLM + transcription cost < $0.40 per 30-min meeting (unit-economics guardrail).

**Multi-Tenancy & Region**

- **NFR12:** Multi-region (US + EU) from launch; tenant pinned to region via subdomain (`{tenant}.us.aisecretary.app` / `.eu.aisecretary.app`).
- **NFR13:** Tenant data (audio, transcripts, embeddings, LLM calls) stays in the tenant's pinned region; no cross-region data movement.
- **NFR14:** Cross-tenant isolation via Postgres RLS using `tenant_id = current_setting('app.current_tenant_id')::uuid`.
- **NFR15:** Region context propagated through every job payload; workers MUST set `app.current_region` before querying.

**Compliance**

- **NFR16:** GDPR: DPA template, DSAR endpoint, consent records, right-to-erasure honored within 30 d.
- **NFR17:** HIPAA: BAA chain available for medical / behavioral-health tenants; gated by `baa_signed = true`. Provider chain: Anthropic via AWS Bedrock for chat, Azure OpenAI HIPAA-eligible as fallback, embeddings via Azure OAI (BAA) or self-hosted (Gap H1).
- **NFR18:** EU tenants default to Voyage AI or self-hosted bge-m3 for embeddings; Anthropic via AWS-EU; storage stays in `eu-west-1` (Gap E1).
- **NFR19:** SOC 2 Type I targeted within 12 months of launch; Type II thereafter.
- **NFR20:** **No-training constraint (hard).** Customer audio and transcripts never sent to model-training pipelines. Documented per-provider chain (Anthropic no-training default, OpenAI ZDR-only, Azure OpenAI default, Ollama for offline).
- **NFR21:** Audit log immutable and append-only; no UPDATE/DELETE grants to app DB role; tenant-scoped reads; DSAR-exportable.

**Security**

- **NFR22:** TLS 1.3 in transit; AES-256-GCM at rest (S3 SSE-KMS); customer-managed keys (KMS) supported; AWS KMS multi-region keys for SaaS, customer-managed via tenant settings (Gap K1).
- **NFR23:** Argon2id (`@node-rs/argon2`) for password hashing.
- **NFR24:** Short-lived JWT (15 min) + refresh token in Redis; rotates on use; revocable via Redis allow-list.
- **NFR25:** API security middleware: `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` (Redis), `@fastify/jwt`, plus custom `tenant-context`, `audit-logger`, `consent-check`, `entitlement-check`.
- **NFR26:** Webhook endpoints (Zoom, Teams, Nylas, Stripe, LMS) HMAC-verified.
- **NFR27:** PII redaction in logs (no passwords, JWTs, raw audio, full transcripts, API keys).

**Accessibility**

- **NFR28:** **WCAG 2.2 Level AA Day-1 across all user surfaces + WCAG AAA touch targets** (44×44 minimum on dense + relaxed; 48px on accessible). Section 508 conformance documented for medical/clinical surfaces. Color contrast verified by token-build CI gate (FR75). ARIA live regions on every streaming surface (receipt, RAG chat, capture-at-risk failures). Reduced-motion fallback for every animation; pre-launch audit verifies every animated component respects `--motion-base: 0ms` in `accessible` mode.
- **NFR29:** Section 508 conformance documented for medical/clinical surfaces.

**Internationalization**

- **NFR30:** English + French at launch; locale architecture supports addition without redeploy.

**Architecture / Operability**

- **NFR31:** Three deployment topologies (SaaS, customer-owned cloud, on-prem) reuse the same Docker artifacts.
- **NFR32:** API: REST + auto-generated OpenAPI (Fastify zod-to-openapi); URL-versioned (`/api/v1/...`); RFC 7807 errors with `requestId`.
- **NFR33:** Real-time: SSE one-way push (no WebSockets); cursor-based pagination only.
- **NFR34:** All external input zod-validated at boundaries; schemas in `packages/shared/src/schemas`.
- **NFR35:** Provider abstraction discipline enforced by Biome rule + CI grep: LLM SDKs only inside `packages/llm-gateway`; storage SDKs only inside `packages/storage`; transcription clients only inside `packages/transcription`; SQL only in `packages/db`.

### Additional Requirements

> From Architecture and the locked UX spec that materially affect epic and story sequencing.

**From Architecture — starter & foundation**

- **A1 (CRITICAL — Epic 1 Story 1):** No off-the-shelf starter. **pnpm workspaces, hand-rolled** is the selected approach. The first implementation story initializes the workspace skeleton: `apps/{api,web,mobile,bot,workers,admin}` + `packages/{shared,llm-gateway,transcription,storage,db,auth,modules}` + `infra/{railway,docker,terraform}` + base tooling (pnpm 9, Node 22 LTS, TypeScript 5.6+ strict ESM, Biome, Vitest).
- **A2:** Recommended implementation order: `packages/db` → `packages/auth` → `packages/storage` → `packages/llm-gateway` → `apps/api` plugin stack → `apps/workers` boot → first journey end-to-end (J2 upload — simplest path) → expand outward.
- **A3:** Tenant-context middleware (`apps/api/src/plugins/tenant-context.ts`) is upstream of every other API plugin — must exist before any tenant-scoped route.
- **A4:** Module config schema (`packages/shared/src/module-schema.ts`) must be defined before any module is authored.
- **A5:** LLM-gateway provider-agnostic interface (`packages/llm-gateway/src/types.ts`) must be defined before any feature touches LLMs.
- **A6:** Storage abstraction must be defined before recording flow is built.

**From Architecture — infra & observability**

- **A7:** Hosting: Railway (control plane + US data plane); Railway eu-west for EU data plane.
- **A8:** Container artifacts: one Dockerfile per app; three deploy targets (Railway, customer-cloud, on-prem) reuse the same images.
- **A9:** CI/CD: GitHub Actions: typecheck → lint → test → build → deploy on `main`; deploy on merge per app.
- **A10:** Secrets: Railway env vars; GitHub OIDC → AWS for cloud-data access; no long-lived AWS keys in CI.
- **A11:** Observability: pino → Grafana Cloud Loki (logs); OpenTelemetry → Tempo + Mimir (traces + metrics); Sentry (errors + session replay); PostHog (flags + product analytics + web session replay); Better Stack (uptime).
- **A12:** Module entitlements / billing flags live in DB (`tenant_entitlements`), not PostHog (billing-critical).

**From Architecture — data**

- **A13:** Postgres 16 + Drizzle ORM + pgvector (HNSW indexed in same Postgres); separate vector tables per dimension family (`embeddings_1536`, `embeddings_1024`) for swappable embedding models (Gap S1).
- **A14:** pg-boss queues (Postgres-native) — one queue per pipeline stage: `transcribe`, `summarize`, `analyze`, `index`, `retention`. Job naming `<domain>.<action>`. Every job payload carries `tenantId`, `userId | null`, `region`, `data`, `metadata.{enqueuedAt, correlationId}`.
- **A15:** Redis per region (Railway add-on) for rate-limit counters, session cache, presigned-URL cache, RAG query cache, bot session state.
- **A16:** Migrations in `packages/db/migrations/`, filename `YYYYMMDDHHMM_<verb>_<noun>.sql`, forward-only, transactional by default; suffix `_no_tx.sql` when needed (e.g., `CREATE INDEX CONCURRENTLY`).

**From Architecture — bot service credentials**

- **A17:** Zoom Server-to-Server OAuth app per region; Microsoft Teams app-only Graph credentials with admin consent. Stored as Railway secrets per region (Gap B1).

**From Architecture — diarization / CDN / KMS**

- **A18:** Post-transcription Pyannote diarization stage in `packages/transcription` when engine = whisper-api (Gap D1).
- **A19:** Cloudflare in front of Railway web service; aggressively cache static, never API (Gap C1).
- **A20:** AWS KMS multi-region keys for SaaS (one per region); enterprise opts in to customer-managed keys via tenant settings; storage layer uses tenant's key on writes (Gap K1).

**From UX — design system & primitives (LOCKED)**

- **U1:** `RecordingStatusPill` V2 inline-waveform is the canonical recording-status primitive across phone lock screen, browser tab pill, bot status row, embed surfaces, and calendar markers — built first in component sequence (Phase 0). V1 / V3 variants discarded.
- **U2:** `AnalysisCard` shared component contract with module-aware content slots is authored before module #1 (general) ships.
- **U3:** Three density modes (`dense | relaxed | accessible`) implemented as design tokens via Style Dictionary build pipeline; consumed by shared components from Day 1, never retrofitted.
- **U4:** Per-vertical density variants (Medical / Psychology = relaxed default) consume the same tokens; per-vertical copy register tokens (clinical = reflective; non-clinical = snappy) layer on top. No parallel component sets.
- **U5:** Pro-tool density visual language (Linear/Notion/Height school): keyboard-first, no mascots, no "are you sure?" hand-holding, no consumer marketing copy in-app.
- **U6:** Privacy posture invisible in routine flows; visible/exportable in admin only.
- **U21:** `CitationChip` V2 iconic glyph is the canonical citation token. Click → seek transcript + play 5 s pre-roll at speaker-turn level. V1 (generic chip) / V3 (superscript ref) variants discarded.
- **U22:** Geist + Geist Mono typography; single-accent indigo (`#4f46e5` light / `#818cf8` dark); monochrome restraint elsewhere. Single accent product-wide; modules differentiated by lucide icon + label, never hue.
- **U23:** Style Dictionary token build pipeline with WCAG contrast CI gate, reduced-motion lint rule, and pre-computed `color-mix()` static fallbacks. Day-1 foundation.
- **U24:** First-receipt empty-state custom illustration system — designer work-stream in parallel with engineering. Brief: 3 sample-library + 2 streaming-receipt skeleton motion + 1 hero. Component skeletons render without illustrations until they land.

**From UX — product spaces & navigation (LOCKED)**

- **U7:** Org admin and team-lead are parallel product spaces with their own information architecture — not tabs inside the meeting view.
- **U8:** Action items are a first-class product space ("My Actions") — not buried in per-meeting views.
- **U9:** Search-vs-chat navigation: chat-embedded-in-search via cmd-K palette + a peer chat surface for sustained Q&A. Picked once and held.
- **U10:** Mobile vs. web surface scoping: heavy analysis dashboards and RAG chat remain web-only with explicit "Open on web →" handoffs from mobile. Mobile owns capture + glanceable summary + lightweight authoring.
- **U25:** Three coexisting app shells over the same component library — `AppShell.Inbox` (D1 default), `AppShell.Cards` (D3 single-user), `AppShell.Search` (D4 power-user). Shell selection at route level based on `tenant.mode` and `user.powerUserMode`; never per-page.

**From UX — empty state & growth (LOCKED)**

- **U11:** Empty-state activation includes: (a) sample meeting library (synthetic content only), (b) "import existing audio" CTA front-and-center co-equal, (c) inline locked-module upsell pattern. First three receipts get extra polish, then dial back.
- **U12:** Sharing as a viral loop: read-only token URL views require no signup; recipient view is auth-free + WCAG AA.
- **U26:** F2-admin first-launch flow is structurally distinct from F2 user flow (FR72) — DPA + region + retention + disclosure + modules + integrations + SSO + invites. No sample library on admin path.
- **U27:** Tab-closer re-engagement emails at 24 h + 72 h with sample / import-audio CTAs respectively (FR70).

**From UX — single-user mode (LOCKED)**

- **U13:** Single-user mode is a feature-visibility layer (not a separate codepath) that hides team-lead/admin/embed/coaching surfaces by default for solo users; "show organization features" toggle in settings reveals enterprise surfaces. Renders via `AppShell.Cards` (D3).

**From UX — clinical capture (LOCKED)**

- **U28:** Clinical capture detangles `ModuleConfirmModal` (clinician confirms vertical) from `ConsentDisclosureCard` (patient sees disclosure). Two distinct UI moments at capture-time. Disclosure can be inline / screenshare / link variants.

**From UX — failure detection & retry (LOCKED)**

- **U29:** Real-time heartbeat detection — capturing client + bot service ping every 30 s; lost ping >90 s triggers detection; push within 60 s (FR67). 10-min resumable upload silent retry budget before user-facing escalation (FR68).

**From UX — region-aware consent (LOCKED)**

- **U30:** F3 bot consent branches on participant region + org policy (FR69). Default conservative (EU = explicit, US = legitimate-interest).

**From UX — F5-CRM deal mapping (LOCKED)**

- **U31:** "Push to CRM" is a multi-step deal-mapping flow (FR73), not a single button. Never auto-pick when multiple matching deals.

**From UX — cross-org sharing (LOCKED)**

- **U32:** Cross-org token URL shares appear as inbound in receiving tenant audit log (FR74). Receiving-org policy enforced at view-time.

**From UX — telemetry ownership (LOCKED)**

- **U33:** Every telemetry signal has a named owner + cadence + threshold-action (FR71). Orphan signals are not collected.

**From UX — anchor word card sort (LOCKED — pre-launch gate)**

- **U34:** "Receipt" is provisional anchor word. 5-person card sort runs pre-launch on whole-phrase usage to validate against alternatives (brief / debrief / dossier / wrap / recap). Per-vertical wording allowed (clinical = session note / compte rendu; education = recap; sales/PM/support = single word card sort picks). Not a launch blocker for engineering, but a launch blocker for marketing-copy lock.

### FR Coverage Map

| FR | Epic | Coverage note |
|---|---|---|
| FR1 | Epic 1 | Self-serve signup ≤60s |
| FR2 | Epic 1 | Email/Google/MS/SAML auth |
| FR3 | Epic 1 | TOTP MFA + org-wide enforcement toggle |
| FR4 | Epic 1 | First-admin invite-others flow |
| FR5 | Epic 1 | F2 first-launch + EmptyStateRecipient + first-3-receipt polish |
| FR6 | Epic 4 | One-tap record across surfaces |
| FR7 | Epic 4 | Mobile offline-first queue + resumable upload |
| FR8 | Epic 2 | File upload (4hr / 2GB) chunked + resumable |
| FR9 | Epic 4 | Pre-mic consent modal (consent shape A) |
| FR10 | Epic 4 | In-person QR/URL consent (consent shape C) |
| FR11 | Epic 4 | RecordingStatusPill V2 inline-waveform across surfaces (U1) |
| FR12 | Epic 9 | Zoom OAuth + bot auto-join (with own minimal admin UI for creds) |
| FR13 | Epic 9 | Teams OAuth + bot |
| FR14 | Epic 9 | TTS-first / chat-after disclosure + per-participant consent (consent shape B) |
| FR15 | Epic 9 | Post-meeting upload fallback |
| FR16 | Epic 10 | Nylas connect + sync ≤5min (with own minimal admin UI) |
| FR17 | Epic 10 | Per-meeting auto-record opt-in |
| FR18 | Epic 2 | Whisper-API + faster-whisper transcription |
| FR19 | Epic 2 | Diarization (Pyannote post-pass for whisper-api per Gap D1); speaker-turn-level addressable |
| FR20 | Epic 2 | ≤3min pipeline for ≤30min audio non-clinical (transcript portion); summary path completes in Epic 3 |
| FR21 | Epic 3 | Summary ≤60s after transcript (non-clinical) |
| FR22 | Epic 3 | Action item extraction with owner+due-date pre-parsed |
| FR23 | Epic 8 | "My Actions" cross-meeting roll-up |
| FR24 | Epic 3, 5, 6 | Analysis runs ≤90s non-clinical; General in Epic 3, Pro batch in Epic 5, BAA-gated in Epic 6 |
| FR25 | Epic 3, 5, 6 | 8 modules: General (Epic 3), Sales/HR/Edu/Support/PM (Epic 5), Medical/Psych (Epic 6) |
| FR26 | Epic 3 | Module = config (prompt + schema + scoring); framework + schema land in Epic 3 with General |
| FR27 | Epic 3, 5 | AnalysisCard contract (U2 — Epic 3); per-vertical density + copy-register variants (U4 — Epic 5) |
| FR28 | Epic 7 | Search <2s on 100K-meeting corpus + cmd-K palette |
| FR29 | Epic 7 | RAG chat with citations + 4 empty-state shapes |
| FR30 | Epic 7 | Faithfulness ≥90%, refuses ungrounded claims |
| FR31 | Epic 8 | Tenant-internal share grants (owner/editor/viewer) + clip + insight |
| FR32 | Epic 8 | Read-only public token URLs + 30d expiry |
| FR33 | Epic 8 | Tenant + share-scope isolation, audit-logged with full scope shape |
| FR34 | Epic 8 | Team lead/supervisor parallel product space + ManagerCoachingCard |
| FR35 | Epic 15 | LTI 1.3 deep-linking launch |
| FR36 | Epic 15 | LTI 1.3 AGS gradebook passback |
| FR37 | Epic 13 | Stripe webhook → tenant_entitlements transactionally (Gap R1) |
| FR38 | Epic 13 | Module entitlement check at every API boundary (built on Epic 1 baseline) |
| FR39 | Epic 13 | Seat ceiling enforcement |
| FR40 | Epic 13 | Four tiers + entitlement axes |
| FR41 | Epic 11 | Seat management (add/remove/role) |
| FR42 | Epic 12 | Tenant integrations (extends per-integration UIs from Epics 9 & 10) |
| FR43 | Epic 12 | Retention policy + scheduled purge worker + audit |
| FR44 | Epic 13 | Module entitlement configuration in admin UI |
| FR45 | Epic 12 | Recording disclosure copy per org |
| FR46 | Epic 12 | In-person 3rd-party consent requirement toggle |
| FR47 | Epic 12 | Region pin (US/EU) configuration (locked at provision) |
| FR48 | Epic 11 | SSO type and MFA enforcement configuration |
| FR49 | Epic 12 | AuditLogTable (queryable, filterable, exportable, module-tinted left border) |
| FR50 | Epic 14 | Self-service DSAR endpoint ≤24hr |
| FR51 | Epic 14 | Right-to-erasure ≤30d (cascade per erasure-cascade map) |
| FR52 | Epic 14 | Public DSAR portal at known URL, no-auth, identity-verified |
| FR53 | Epic 14 | DsarQueueItem cascade-scope preview before commit |
| FR54 | Epic 1 (foundation) + Epic 14 (export) | Append-only audit log everywhere from Day 1 (Epic 1); export endpoint ships in Epic 14 |
| FR55 | Epic 14 | ConsentDisclosureCard patient artifact (consent shape D) — three variants |
| FR56 | Epic 15 | Chrome extension overlay (HubSpot/Salesforce/Pipedrive) |
| FR57 | Epic 15 | Slack hub app |
| FR58 | Epic 15 | Teams hub app |
| FR59 | Epic 2 + Epic 3 | SSE plumbing (Epic 2 transcript-ready); event types extended in Epic 3 |
| FR60 | Epic 1 (foundation via FR82) + consumed by Epic 4 / 9 / 14 / 15 | Mobile push notifications (Expo Push); foundation in `packages/notifications` from Epic 1; consumers ship per epic |
| FR61 | Epic 1 | Three density modes via design tokens (U3) + precedence rule |
| FR62 | Epic 5 | VoiceInputSurface as first-class mobile input |
| FR63 | Epic 1 | Single-user mode visibility layer + AppShell.Cards |
| FR64 | Epic 13 | Locked-module upsell pattern |
| FR65 | Epic 4 | Live captions during recording |
| FR66 | Epic 1 | i18next EN+FR + locale-add-without-redeploy + per-vertical anchor word allowed |
| FR67 | Epic 4 (capture-side) + Epic 9 (bot-side) | Heartbeat 30s + push ≤60s on detection |
| FR68 | Epic 4 | 10-min resumable upload retry budget |
| FR69 | Epic 9 (capture flow) + Epic 12 (admin policy config) | Region-aware bot consent branch |
| FR70 | Epic 1 | Tab-closer re-engagement emails at 24h + 72h |
| FR71 | Epic 1 (registry foundation) + downstream | Telemetry ownership matrix |
| FR72 | Epic 12 | F2-admin first-launch flow (DPA + region + retention + disclosure + modules + integrations + SSO + invites) |
| FR73 | Epic 15 | F5-CRM deal-mapping multi-step flow |
| FR74 | Epic 8 (sender) + Epic 12 (receiving-org policy) | Cross-org sharing scope rules |
| FR75 | Epic 1 | Style Dictionary token build pipeline + WCAG contrast CI gate + reduced-motion lint |
| FR76 | Epic 1 | Geist + indigo brand foundation; designer illustration brief in parallel |
| FR77 | Epic 1 (Inbox) + Epic 1 (Cards) + Epic 7 (Search) | Three app shells |
| FR78 | Epic 3 (foundation) + Epic 7 (extended in chat) | CitationChip V2 + click-to-seek + 5s pre-roll |
| FR79 | Epic 2 (non-clinical SLA) + Epic 6 (clinical SLA differentiation) | Per-vertical receipt timing |
| FR80 | Epic 1 (foundation in `packages/notifications`) + consumed by Epic 1 (Story 1.7 re-engagement) + Epic 13 (trial reminders) + Epic 14 (DSAR delivery) | Pluggable email provider — closes Gap-EC1 |
| FR81 | Epic 13 | Trial policy mechanism (Pro 14d no-CC + Business 14d sales-assisted + Enterprise pilot) — closes Gap-EC2 |
| FR82 | Epic 1 | `packages/notifications` foundation contract (push + email + future SMS) — closes EQ-1 |

**All 82 FRs mapped. 0 missed.**

## Epic List

### Epic 1: Foundation & Authenticated Workspace

I can sign up for AI Secretary in under 60 seconds, log in (email/password, Google, or Microsoft), enable MFA, invite teammates to my org, and see an inviting empty-state workspace ready to receive my first meeting. The brand foundation looks finished from day one: Geist typography, indigo accent, three density modes, all driven by Style Dictionary tokens with a contrast-gating CI build.

Foundation slices delivered: pnpm workspaces skeleton (Architecture A1); tenant-context plugin (A3); `audit_logs` table + audit-logger plugin + **CI audit-coverage gate** (`apps/api/scripts/check-audit-coverage.ts`) wired before any state-changing route; `tenant_entitlements` table + entitlement-check plugin (default all-enabled); **Style Dictionary token build pipeline** with WCAG contrast CI gate + reduced-motion lint rule + pre-computed `color-mix()` static fallbacks (FR75); **Geist + Geist Mono typography + indigo accent** (`#4f46e5` light / `#818cf8` dark) + monochrome restraint (FR76); three density modes implemented as tokens (FR61/U3); single-user-mode visibility layer (FR63); **`AppShell.Inbox` (D1 default)** + **`AppShell.Cards` (D3 single-user)** scaffolded — `AppShell.Search` (D4) defers to Epic 7 (FR77/U25); i18next EN+FR + per-vertical anchor word allowed (FR66); **erasure-cascade map** registered (every later epic that introduces tenant-scoped data MUST update this map as an acceptance criterion); **`packages/notifications` foundation contract** providing unified push (Expo Push) + email (Postmark / SES / SMTP) dispatch with `notifications` table + dedup logic + user-preference honoring + audit-log entries (FR80, FR82 — closes readiness Gap-EC1 + EQ-1; consumers ship in Epics 1 (re-engagement) / 4 (capture-at-risk push) / 9 (bot-failure push) / 13 (trial reminders) / 14 (DSAR delivery) / 15 (LMS/CRM/Slack/Teams hub-app dispatch)); **F2 user first-launch flow** including `EmptyStateRecipient` skeleton (illustrations land in parallel designer work-stream — FR76/U24), sample-meeting library, "import existing audio" CTA co-equal, locked-module upsell pattern, first-3-receipt polish dial-back; **tab-closer re-engagement emails** at 24 h + 72 h with 30 d cold-lead cooldown (FR70/U27 — consumes `packages/notifications`); **telemetry ownership registry** seeded with named owners + cadences + threshold-actions (FR71/U33); **anchor-word card-sort gate** scheduled pre-launch (U34).

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR54 (audit foundation), FR61, FR63, FR66, FR70, FR71, FR75, FR76, FR77 (Inbox + Cards), FR80, FR82

### Epic 2: Upload, Transcribe, Receipt-Frame-on-Stop

I can drag-drop an audio/video file (up to 4hr / 2GB) and within ~3 minutes (≤30min audio, non-clinical) read the diarized transcript — addressable at speaker-turn level — on the meeting page. The receipt frame appears immediately on stop with an honest expected-arrival-time indicator; ARIA live regions announce each stage as it lands. "Play transcript while summary cooks" affordance is available during streaming.

Foundation slices delivered: `packages/storage` abstraction with S3 adapter + presigned upload pattern (Architecture A6), `packages/llm-gateway` minimum + Anthropic provider (A5), pg-boss workers boot (A14), transcription orchestrator + Whisper-API engine adapter, Pyannote diarization post-pass with **speaker-turn-level addressable spans** for citation anchoring (Gap D1, FR19, FR78 substrate), transcript persistence, **`ReceiptStreamLayout` Granola-grade frame-on-stop** with honest expected-arrival-time indicator + ARIA live region per stage + "play transcript while summary cooks" affordance + reduced-motion fallback (NFR28, FR79 substrate), SSE plumbing.

**FRs covered:** FR8, FR18, FR19, FR20, FR59 (transcript-ready event), FR79 (non-clinical SLA target)

### Epic 3: Summary, Actions, General Module & Citation-Native Substrate

After upload, the meeting page shows summary + action items (with owner + due date pre-parsed for one-tap accept/edit) + General-module analysis output, all rendered through the locked **`AnalysisCard` shared component contract**. Every analytic claim carries a **`CitationChip` V2 iconic glyph**; clicking it opens `TranscriptSeekPlayer`, seeks to the speaker turn, and plays a 5s pre-roll.

Foundation slices delivered: module-schema contract `packages/shared/src/module-schema.ts` (A4); General module config; summarization worker; action-item extraction worker; **`AnalysisCard` contract** with module-aware content slots (UX U2 — must ship here before module #2); **`CitationChip` V2 iconic glyph** as canonical citation token (U21); **`TranscriptSeekPlayer`** with speaker-turn seek + 5 s pre-roll; **citation-required CI check** flags claims without chips as analysis-quality regressions (FR78); SSE event types extended (`meeting.summarized`, `meeting.analyzed`).

**FRs covered:** FR21, FR22, FR24 (General only), FR25 (General only), FR26, FR27 (component contract), FR59 (extended events), FR78

### Epic 4: Recording on Mobile & Web with Heartbeat & Retry Discipline

I can hit one tap to record from my phone, mobile-web/PWA, or desktop browser. Pre-mic consent shows my org's disclosure; for in-person meetings I can present a QR code the other party scans to acknowledge. The same **`RecordingStatusPill` V2 inline-waveform** is visible across phone lock screen, browser tab pill, embed surfaces, and bot status row. If recording fails mid-meeting, I get a push notification within 60 seconds. If upload stalls on a flaky network, the system retries silently for 10 minutes before bothering me. Deaf/HoH participants see live captions during recording.

Foundation slices delivered: **`RecordingStatusPill` V2 inline-waveform** as the only canonical recording-status primitive (UX U1, FR11) — ships first per component sequence; mobile offline-first queue + resumable background upload (NFR7) using expo-task-manager + expo-background-fetch + iOS background-audio entitlement + Android foreground-service; consent shapes A (pre-mic modal) & C (in-person QR/URL with acknowledgment timestamps); **30 s heartbeat detection** from capturing client + push within 60 s on lost ping (FR67/U29); **10-min resumable-upload silent retry budget** before user-facing escalation (FR68/U29); live-captions stream from same transcript pipeline.

**FRs covered:** FR6, FR7, FR9, FR10, FR11, FR65, FR67 (capture-side), FR68

### Epic 5: Vertical Modules — Pro-tier Batch (Sales, HR, Education, Customer Support, PM)

I can run any of the five Pro-batch vertical modules on a meeting and get vertical-fluent output through the same `AnalysisCard` contract: Sales gets a deal card with talk-ratio/objections/next-steps/deal-risk, HR gets competency-rubric scoring, Education gets engagement breakdown + objective coverage, Support gets resolution + escalation flags, PM gets a decisions log + action items + risk register entries. Per-vertical density variants and copy register apply automatically through tokens. On mobile I can edit summaries and action items via voice dictation.

Foundation slices delivered: 5 module configs (sales, hr, education, support, pm); per-vertical density variants (clinical-only relaxed will land in Epic 6); per-vertical copy register tokens (snappy for these 5); `VoiceInputSurface` for mobile dictation (FR62).

**FRs covered:** FR24 (5 module configs), FR25 (Sales/HR/Edu/Support/PM), FR27 (per-vertical density + copy register variants per UX U4), FR62

### Epic 6: BAA-Gated Modules — Medical/Behavioral Health & Psychology *(double-gated)* with Detangled Clinical Capture

Therapists and clinicians can run Medical/BH (SOAP draft, screening prompts, risk flags) and Psychology (therapeutic alliance signals, themes, intervention notes) modules. At capture time, the **`ModuleConfirmModal`** asks the clinician to confirm vertical (a separate UI moment from the patient seeing **`ConsentDisclosureCard`**, which presents the disclosure in an inline / screenshare / link variant). Module schema gains a `requires_baa` flag; the module runner refuses dispatch when `tenant_entitlements.baa_signed = false`. **Per decision (i):** even for `baa_signed = true` tenants, dispatch is additionally refused with a clear "HIPAA-eligible routing not yet enabled — coming in Epic 14" message until Epic 14 lands. Clinical pipeline targets per-vertical relaxed timing (<60s first stream / <5min summary / <30 min full receipt) and spends the spare cycles on quality (better diarization, additional clinical-quality checks).

Foundation slices delivered: `requires_baa` field in module schema; BAA enforcement check in module runner; Medical config; Psychology config; friendly refusal UX for both gate failures; **`ModuleConfirmModal`** (clinician confirms vertical at capture-time); **`ConsentDisclosureCard`** with inline / screenshare / link variants (UX U28, FR55 substrate — full clinical disclosure artifact ships in Epic 14); **per-vertical relaxed density + reflective copy register tokens** auto-applied for clinical surfaces (FR79 clinical SLA branch).

**FRs covered:** FR24 (2 module configs), FR25 (Medical + Psychology), FR79 (clinical SLA branch). Module-level BAA gating mechanism is foundation for NFR17.

### Epic 7: Search & RAG Chat — Knowledge Recall, Power-User Shell & Streaming Citations

I can search my entire corpus across meetings (e.g., "objections about pricing") in <2s and get ranked snippets with timestamps that deep-link to transcript anchors. cmd-K is one keystroke away on web (locked keyboard contract: ↑/↓ cycle, Enter open, Esc close, focus trap). I can chat with the corpus via RAG and receive grounded answers — citations populate inline as the answer streams; chat refuses ungrounded claims; faithfulness ≥90%. Power users with 50+ indexed meetings can toggle on `AppShell.Search` (D4) which makes search the home surface.

Foundation slices delivered: pgvector HNSW indexing (Architecture A13); per-dimension vector tables `embeddings_1536` / `embeddings_1024` (Gap S1); embedding indexer worker; FTS + semantic ranking; RAG retriever; streaming chat through LLM gateway with **inline citation chip population** (FR78 in chat); cmd-K command palette with locked keyboard contract; **`SearchHomeShell`** + **`AppShell.Search` (D4 power-user toggle)** with activation logic (50+ meetings or user opt-in) (FR77/U25); **`RelationshipBrowser`** for people / calendar / project facets; ARIA live region announcements per chunk + per citation arrival (NFR28); four empty-state shapes (confident / low-confidence-with-rank-chips / "I don't know" / off-topic — U9 chosen pattern: chat-embedded-in-search via cmd-K + peer chat surface).

**FRs covered:** FR28, FR29, FR30, FR77 (Search shell), FR78 (in chat context)

### Epic 8: Sharing, My Actions, Team-Lead Space & Cross-Org Scope

I can share a meeting (whole / clip / single insight) with a teammate (owner/editor/viewer grants) or via a public read-only token URL that needs no login. The "My Actions" page rolls up action items across all my meetings. Team leads/supervisors get a parallel product space with team-meeting roll-ups and a `ManagerCoachingCard` to annotate teammates' meetings at span level. When I share with a recipient in another AI Secretary tenant, that share appears as inbound in their audit log; their org admin's accept-policy enforces at view-time.

Foundation slices delivered: share grant model + clip + insight + public token URL views (UX U12); **`ShareRecipientView`** auth-free WCAG AA recipient view (keyboard nav, captioned playback, semantic transcript markup, no upsell, no signup wall); 30 d default token expiry + clear expired-share page; "My Actions" first-class space (UX U8); team-lead parallel product space (UX U7); **`ManagerCoachingCard`** with span-anchored annotation (no surveillance aesthetic); **cross-org sharing scope** detection + audit-visibility on receiving tenant (FR74/U32 — sender side; receiving-org accept-policy lives in Epic 12).

**FRs covered:** FR23, FR31, FR32, FR33, FR34, FR74

### Epic 9: Bot-Captured Meetings (Zoom & Teams) with Region-Aware Consent

As an org admin, I connect Zoom and/or Teams via OAuth from Epic 9's own minimal admin UI for credentials. The meeting bot auto-joins our scheduled meetings within 30s of start, announces presence + disclosure via TTS first, posts disclosure URL to chat second, and records per-participant consent timestamps. The consent flow branches on participant region: EU + strict-policy = explicit chat-command opt-in (60 s window); non-EU OR legitimate-interest = implicit-by-staying with chat-command opt-out. If the bot fails to join, a real-time liveness ping detects within 60s and I get push + email + in-app banner with an "Upload from Zoom Cloud" fallback. If live capture is unavailable, the bot uploads post-meeting from the host platform.

Foundation slices delivered: Zoom Server-to-Server OAuth + Teams app-only Graph credentials per region (Architecture A17 / Gap B1); `apps/bot` service; TTS-first / chat-after disclosure module (FR14); consent acknowledgment store extension; **region-aware consent branch** (FR69/U30) — consent shape B with EU/non-EU + strict/legitimate-interest matrix; **bot-side 30 s heartbeat / liveness ping** + push within 60 s on lost ping (FR67 bot-side); strict-policy auto-quarantine vs per-participant exclusion behaviors; minimal admin UI scoped to integration credentials only (extended later by Epic 12).

**FRs covered:** FR12, FR13, FR14, FR15, FR67 (bot-side), FR69

### Epic 10: Calendar Integration (Nylas)

I can connect a calendar via Nylas (covers Google, Microsoft, Exchange, iCloud) from Epic 10's own minimal admin UI for credentials. Upcoming meetings appear within ~5 minutes of any change. I can opt in to auto-record per meeting, and that toggle persists across syncs.

Foundation slices delivered: Nylas integration adapter; calendar-sync worker; minimal admin UI scoped to Nylas credentials only (extended later by Epic 12).

**FRs covered:** FR16, FR17

### Epic 11: Org Admin — Seats & Access Management

As an org admin, I run my org's user list: invite/remove members, assign roles (org_admin / org_member / org_viewer), choose SSO types (email/google/microsoft/saml), and enforce MFA org-wide.

**FRs covered:** FR41, FR48

### Epic 12: Org Admin — F2-admin First-Launch + Configuration & Integrations + Cross-Org Policy

As an org admin landing on my first launch, I'm walked through a structurally distinct flow from a user (FR72/U26): tenant-wide DPA acceptance (blocking), data-region pin (US/EU, locked once), consent-disclosure copy configuration, retention defaults per asset (with per-vertical overrides), vertical enablement, optional integration connections, optional SSO, then user invites. Afterwards I have a centralized admin product space (UX U7 — parallel product, not a tab) where I configure recording-disclosure copy ongoing, the in-person-consent requirement toggle, region pin (read-only after provision), retention policy with scheduled purge + audit, integration credentials (consolidates the minimal versions shipped in Epics 9 & 10), and **F3 region-aware consent policy** (default EU=explicit, US=legitimate-interest; configurable per-org). I can also configure **cross-org sharing accept-policy** (accept all / whitelist / block all). I can browse a queryable, filterable, exportable audit timeline (`AuditLogTable`, with module-tinted left-border on rows as the controlled compliance-review exception).

**FRs covered:** FR42, FR43, FR45, FR46, FR47, FR49, FR69 (admin policy config side), FR72, FR74 (receiving-org policy)

### Epic 13: Billing, Entitlements, Upsell & Trial Lifecycle

Stripe-driven subscription events (`customer.subscription.*`) automatically update `tenant_entitlements` transactionally; seat ceilings and meeting-hour overage are enforced and tracked. Module entitlements respect tier (e.g., Pro = General + 2 chosen verticals; Business = all 8). **Trial lifecycle is a first-class concern** (FR81 — closes Gap-EC2): Pro 14-day no-credit-card trial with soft-conversion at trial-end; Business 14-day sales-assisted with admin-flagged conversion; Enterprise scoped pilot with custom expiration. Trial reminder emails fire at T-3d + T-1d via `packages/notifications` (FR82). Users see an inline locked-module upsell when viewing meetings eligible for a module they don't have entitled.

Foundation slices delivered: Stripe webhook handler (Gap R1); full entitlement enforcement at API boundary (extends Epic 1 baseline); seat/overage tracking; four-tier configuration; **trial-state tracking** via `tenants.trial_kind` + `trial_starts_at` + `trial_ends_at` + `trial_card_on_file` fields (per ADR-0004 trial-fields extension); **trial-end transitions** (Pro auto-convert if card on file; Pro `trial_expired` blocks new mutations + upgrade CTA if no card; Business / Enterprise admin contact-sales handoff); **trial reminder emails** consuming `packages/notifications` (FR82); locked-module upsell pattern (FR64 / UX U11c); module entitlement configuration in admin UI (`EntitlementGrid`).

**FRs covered:** FR37, FR38, FR39, FR40, FR44, FR64, FR81

### Epic 14: Compliance, Privacy & Public DSAR Portal *(includes EU deployment + HIPAA routing + clinical patient artifact)*

Org admins process GDPR DSARs from a queue with a `DsarQueueItem` cascade-scope preview ("47 transcripts, 12 summaries, 3 analyses, 1,200 embeddings — confirm") before commit. Self-service DSAR endpoint produces a zip within 24h; right-to-erasure honored within 30 days following the erasure-cascade map. Non-customer third parties submit access/deletion requests at the public, no-auth `aisecretary.app/data-rights` portal with plain-language register (GOV.UK style). Clinicians have the full screen-shareable patient-facing **`ConsentDisclosureCard`** (consent shape D, three variants — inline / screenshare / link). **HIPAA-eligible provider chain (Anthropic via AWS Bedrock + Azure OpenAI HIPAA-eligible + BAA-eligible embeddings)** routes medical/BH tenants — releases the second gate on Epic 6's modules. **EU stack deployment** (Railway eu-west) + **EU embeddings routing** (Voyage AI / self-hosted bge-m3) + **Anthropic via AWS-EU** lands as a story inside this epic (Gaps H1 + E1).

**FRs covered:** FR50, FR51, FR52, FR53, FR54 (export endpoint), FR55

### Epic 15: LMS Integration & Distribution Surfaces (incl. F5-CRM Deal-Mapping)

Educators launch AI Secretary from their LMS via LTI 1.3 deep-linking; grades pass back via AGS. Knowledge workers see meeting receipts where they already work: a Chrome extension surfaces AI Secretary inside HubSpot, Salesforce, and Pipedrive with a **multi-step F5-CRM deal-mapping flow** (attendee lookup → contact match → ranked deal list → user picks → optional auto-create → push as activity note + linked transcript); Slack and Teams hub apps push receipts into team chat. Mobile users get push notifications when meeting analysis completes — Epic 15 *consumes* `packages/notifications` (shipped in Epic 1 per FR82) and adds LMS / CRM / Slack / Teams hub-app dispatch event types. Capture-at-risk and upload-retry-budget escalations (Epic 4 / 9) flow through the same package, but their dispatch infrastructure is foundation-side, not introduced here.

**FRs covered:** FR35, FR36, FR56, FR57, FR58, FR60 (consumer side — adds hub-app event types), FR73

---

## Stories by Epic

> Inline story decomposition for each epic. Per BMAD pattern, detailed story files (`stories/<epic>.<n>-<slug>.md`) are generated by the `create-story` workflow per sprint. The drafts below set the shape; sprint planning commits final ACs.

### Epic 1: Foundation & Authenticated Workspace

**Story 1.1 — Workspace skeleton + base tooling**
- *Description:* As an engineer, I have a pnpm workspaces monorepo with all `apps/*` and `packages/*` directories scaffolded and base tooling (TS strict ESM, Biome, Vitest) installed at root, so every later story has a place to live.
- *Acceptance criteria:*
  - `pnpm install` succeeds at root; `pnpm typecheck && pnpm lint && pnpm test` runs across the workspace
  - All apps + packages from architecture present as empty TS modules with `index.ts` exports
  - Node 22 LTS + pnpm 9 pinned via `.nvmrc` and `packageManager` field
  - `infra/{railway,docker,terraform}` exist with placeholder configs
- *FRs covered:* (foundation — supports all)

**Story 1.2 — Style Dictionary token build pipeline + WCAG contrast CI gate + reduced-motion lint**
- *Description:* As a designer/engineer, our Style Dictionary build emits design tokens to web (Tailwind config + CSS variables) and mobile (NativeWind), and CI fails any PR that regresses WCAG AA contrast or hardcodes a transition duration not referencing the motion-mode token.
- *Acceptance criteria:*
  - `pnpm tokens:build` produces web + mobile token outputs from a single source-of-truth
  - WCAG contrast CI gate verifies all defined fg/bg pairs meet ≥4.5:1 (body) / ≥3:1 (large + non-text)
  - Reduced-motion lint rule (Biome custom) flags hardcoded transition durations
  - `color-mix()` and adjacent helpers pre-computed to static fallbacks at build time
- *FRs covered:* FR75

**Story 1.3 — Brand foundation: Geist + indigo + monochrome restraint + three density modes**
- *Description:* As a user, the product looks like a finished pro-tool from sign-up onward — Geist + Geist Mono typography, single-accent indigo (`#4f46e5` light / `#818cf8` dark), three density modes auto-applied via OS preferences with explicit-choice precedence.
- *Acceptance criteria:*
  - Geist + Geist Mono loaded; type scale wired into Tailwind via tokens
  - Light + dark mode palettes implemented; modules differentiate by lucide icon + label, never hue
  - `dense | relaxed | accessible` modes auto-select via `prefers-contrast` + `prefers-reduced-motion`; user override in settings persists; precedence is explicit > OS > vertical-default
  - Storybook (web) + Storybook RN online with all token variants visible
- *FRs covered:* FR61, FR76

**Story 1.4 — Tenant-context plugin + audit-logger plugin + erasure-cascade map registry + audit-coverage CI gate**
- *Description:* As a platform engineer, every state-changing route passes through `audit-logger`, `tenant_id` is always set from auth context (never request body), and the erasure-cascade map is the registry every later epic updates when introducing tenant-scoped data.
- *Acceptance criteria:*
  - `apps/api/src/plugins/tenant-context.ts` is upstream of every other plugin
  - `audit_logs` table append-only, no UPDATE/DELETE grants to app role
  - `apps/api/scripts/check-audit-coverage.ts` CI gate fails when a tagged endpoint lacks audit-log coverage
  - Erasure-cascade map registered in `packages/db` as a maintained registry; ADR template documents how new tables register
- *FRs covered:* FR54

**Story 1.5 — Auth: signup ≤60s + email/password + Google OAuth + Microsoft OAuth + TOTP MFA + org invites**
- *Description:* As a new user, I can sign up in under 60 seconds, log in via email/password / Google / Microsoft, optionally enable TOTP MFA, and (as the first org admin) invite teammates by email.
- *Acceptance criteria:*
  - Signup completes ≤60s on a clean test path
  - Email/Google/Microsoft auth all functional; refresh token in Redis with rotation-on-use
  - TOTP enrollment flow with recovery codes; org-wide enforcement toggle is wired (config respected)
  - Email invite flow lands recipients on accept-invite page; new user joins existing tenant
- *FRs covered:* FR1, FR2, FR3, FR4

**Story 1.6 — `AppShell.Inbox` (D1 default) + `AppShell.Cards` (D3 single-user) scaffold**
- *Description:* As an org-context user, I see `AppShell.Inbox` (sidebar + cmd-K + content pane); as a solo user, I see `AppShell.Cards` (minimal header + card feed). Shell selection is at route level based on `tenant.mode`.
- *Acceptance criteria:*
  - Both shells consume the same component library and tokens
  - `RecordingStatusPill` slot top-right of every shell, always
  - Single-user mode visibility layer hides team-lead / admin / embed/CRM surfaces by default; "show organization features" toggle reveals
  - `AppShell.Search` (D4) is deferred to Epic 7 with a clear interface
- *FRs covered:* FR63, FR77 (Inbox + Cards portion)

**Story 1.7 — F2 user first-launch flow + `EmptyStateRecipient` + first-3-receipt polish + tab-closer re-engagement** *(depends on Story 1.10 for re-engagement email dispatch)*
- *Description:* As a brand-new user, my home page presents the sample meeting library co-equal to "import existing audio," my first three receipts get extra polish (illustrations, gentle pop-ins, optional thumbs prompt), and if I close the tab without acting I get re-engagement emails at 24h + 72h.
- *Acceptance criteria:*
  - `EmptyStateRecipient` component renders with sample-library + import-CTA co-equal; component skeleton works without illustrations (designer brief in parallel work-stream)
  - First-3-receipt polish flag drives extra animations + thumbs prompt; dial back to calm default after 3rd
  - System email at 24h ("Try a sample meeting →") and 72h ("Drop a recording →") fires on tab-close detection via `packages/notifications` (Story 1.10); 30d cooldown on non-response; unsubscribable via per-channel opt-out
- *FRs covered:* FR5, FR70

**Story 1.8 — Telemetry ownership registry + initial signal seeding**
- *Description:* As a Growth PM, every product telemetry signal I rely on has a named owner + cadence + threshold-action rule recorded in a registry, and signals without owners are not collected.
- *Acceptance criteria:*
  - Registry seeded with: first-receipt thumbs (Growth PM weekly), mental-model free-text (Growth PM + Product weekly), 7-day activation rate (Growth PM weekly), tab-closer re-engagement open rate (Growth PM monthly)
  - Each signal includes threshold-action mapping
  - PostHog events fired only when registered; CI grep flags unregistered signal names
- *FRs covered:* FR71

**Story 1.9 — i18next EN+FR + per-vertical anchor word substrate**
- *Description:* As a French-speaking user, the product is fully localized at launch in English + French, and the per-vertical anchor word ("receipt" provisional, with clinical / education overrides) is configurable per locale.
- *Acceptance criteria:*
  - i18next + react-i18next (web) + expo-localization (mobile) wired
  - EN + FR locale files complete for Epic 1 surfaces
  - Anchor word lookup keyed by `(locale, vertical)`; clinical = "session note / compte rendu" reserved
  - No hardcoded strings; CI grep enforces
- *FRs covered:* FR66

**Story 1.10 — `packages/notifications` foundation: push (Expo) + email (Postmark/SES/SMTP) + dispatch queue + dedup**
- *Description:* As a platform engineer, all push-notification and transactional-email dispatch goes through `packages/notifications` only — provider-agnostic interface, per-tenant routing, pg-boss `notification.send` queue, dedup logic. Required for Story 1.7 (re-engagement emails), Story 4.4/4.5/9.6 (capture-at-risk + upload-retry-exhausted + bot-failure escalation pushes), Story 13.7 (trial reminder emails), Story 14.1 (DSAR delivery email), Story 15.5/15.6 (Slack/Teams/LMS/CRM dispatch event types). Closes readiness violations EQ-1 (push forward dependency) + Gap-EC1 (email pluggability promise).
- *Acceptance criteria:*
  - `packages/notifications/` workspace package created with `types.ts` provider-agnostic interface, `gateway.ts` tenant-routing logic, `providers/{expo-push,postmark,ses,smtp}.ts` adapters
  - pg-boss `notification.send` queue handler dispatches per-channel; `notifications` table tracks `(id, tenant_id, recipient, channel, kind, payload_hash, status, attempts, dedup_key, created_at)` with RLS isolation
  - Dedup logic suppresses repeat sends within 5 min for same `(recipient, kind, dedup_key)`; per-channel + per-kind opt-out respected via `user_preferences` table
  - Audit-log entries on every send via existing `audit-logger` plugin (new audit actions `notification.sent`, `notification.failed`, `notification.suppressed-dedup`, `notification.opted-out`); added to `apps/api/src/lib/audit-types.ts` union
  - CI grep blocks `expo-server-sdk` / `postmark` / `aws-sdk/client-ses` / `nodemailer` imports outside `packages/notifications` (same Biome rule pattern as `packages/llm-gateway`, `packages/storage`, `packages/transcription`)
  - Provider selection per tenant via `tenant_settings.notification_email_provider` (`postmark` | `ses` | `smtp`) with conservative default (Postmark for SaaS, SMTP for on-prem)
  - Storybook stories for the email-template renderer (re-engagement / DSAR / trial-reminder templates) at three density × three motion modes
  - On-prem deployment SMTP-only mode verified via integration test
- *FRs covered:* FR60 (foundation side), FR70 (re-engagement email channel), FR80, FR82

### Epic 2: Upload, Transcribe, Receipt-Frame-on-Stop

**Story 2.1 — `packages/storage` S3 abstraction + presigned upload pattern**
- *Description:* As a platform engineer, all file I/O goes through `packages/storage` only; the API returns presigned URLs to clients; CI grep blocks `@aws-sdk/client-s3` imports outside this package.
- *Acceptance criteria:*
  - S3 adapter implemented; abstraction interface in `types.ts`; adapters for Azure Blob / GCS / MinIO stubbed with shared interface
  - Presigned upload pattern: client requests URL → uploads chunked → calls `complete` endpoint
  - Per-tenant KMS key resolution on writes (Gap K1 substrate)
- *FRs covered:* (foundation for FR8)

**Story 2.2 — Chunked + resumable file upload (4hr / 2GB)**
- *Description:* As a user, I can drag-drop an audio/video file up to 4hr / 2GB and the upload survives network interruptions and tab refresh.
- *Acceptance criteria:*
  - Upload UI with progress; chunked uploads resume from last successful chunk
  - 4hr / 2GB upper bounds enforced server-side
  - Audit-log entry on upload-complete
- *FRs covered:* FR8

**Story 2.3 — Whisper-API engine adapter + transcription orchestrator + pg-boss workers boot**
- *Description:* As an engineer, the transcription pipeline runs as a pg-boss worker; the orchestrator selects engine per tenant config; Whisper-API is the Day-1 engine.
- *Acceptance criteria:*
  - `apps/workers` boots; consumes `transcribe` queue
  - Engine adapter for Whisper-API in `packages/transcription`; faster-whisper adapter stubbed for parity
  - Tenant config selects engine; cost-tracker captures usage
- *FRs covered:* FR18

**Story 2.4 — Pyannote diarization post-pass + speaker-turn-level addressable spans**
- *Description:* As the citation substrate, every transcript has speaker turns addressable by stable IDs so `CitationChip` (Story 3.5) can deep-link precisely and `ManagerCoachingCard` (Story 8.6) can anchor span-level annotations. Closes readiness Gap-UX1 (speaker-turn schema not previously pinned).
- *Acceptance criteria:*
  - Pyannote stage runs after Whisper-API transcription (Gap D1)
  - faster-whisper native diarization respected when that engine routes
  - **Speaker-turn schema (Gap-UX1 closure):** `speaker_turns` table — `{ id: TEXT PRIMARY KEY (stable hash of meetingId + speakerId + spanStartMs), meeting_id: UUID, speaker_id: TEXT ('spk_N' from Pyannote, OR external_user_id when bot has matched the speaker to a participant), span_start_ms: INTEGER, span_end_ms: INTEGER, text: TEXT, created_at: TIMESTAMPTZ }`. RLS scoped via `meeting_id` → `meetings.tenant_id`. Index on `(meeting_id, span_start_ms)`.
  - **Stability commitment:** turn IDs survive re-diarization unless underlying audio bytes change. Re-transcription with the same audio + same diarization model → same turn IDs (deterministic hash). Citations stored with turn_id can be safely persisted across re-processing.
  - **Citation deep-link contract (consumed by Story 3.5 CitationChip + Story 8.6 ManagerCoachingCard):** `(meetingId, turnId)` resolves to the span; client computes seek target = `span_start_ms - 5000` (5s pre-roll, clamped to ≥0); transcript player API: `seekTo(meetingId, turnId)` → seeks audio + scrolls to turn + plays.
  - Erasure-cascade map updated: `speaker_turns` deleted when meeting is purged (Story 14.2 cascade)
- *FRs covered:* FR19, FR78 (substrate)

**Story 2.5 — `ReceiptStreamLayout` Granola-grade frame-on-stop + ARIA live + expected-arrival-time indicator**
- *Description:* As a user, the receipt frame appears immediately on stop; each stage announces via ARIA live region as it lands; expected-arrival-time is honest (updates when slow); "play transcript while summary cooks" affordance is always available.
- *Acceptance criteria:*
  - Frame renders ≤500ms after stop; skeletons describe upcoming stages
  - ARIA live region polite per stage; assertive on capture-at-risk failure
  - Expected-arrival-time indicator updates honestly when target exceeded; never hides slow pipeline
  - Reduced-motion fallback swaps animated reveals for discrete content swaps; ARIA announcements unchanged
  - "Play transcript while summary cooks" affordance functional during stages 1-3
- *FRs covered:* FR79 (non-clinical), NFR28 (ARIA live)

**Story 2.6 — SSE plumbing + `transcription.completed` event + ≤3 min non-clinical SLA enforcement**
- *Description:* As a user, when transcription finishes I receive a real-time event in the receipt screen; for ≤30min audio the transcript is ready ≤3 minutes (non-clinical).
- *Acceptance criteria:*
  - `GET /api/v1/events?topic=meeting.<id>` SSE endpoint authed + tenant-scoped
  - `transcription.completed` event fires; web client refetches via React Query
  - SLA verified on a synthetic 30-min sample
- *FRs covered:* FR20, FR59 (transcript-ready)

### Epic 3: Summary, Actions, General Module & Citation-Native Substrate

**Story 3.1 — Module schema contract + module runner + General module config**
- *Description:* As a platform engineer, the module-schema contract `packages/shared/src/module-schema.ts` is the source of truth every module satisfies; the General module is the first config and proves the framework.
- *Acceptance criteria:*
  - Module-output discriminated union schema authored
  - Module runner loads config + dispatches via LLM gateway + zod-validates output + persists
  - General module config (prompt + output schema + scoring rules) ships
- *FRs covered:* FR24 (General), FR25 (General), FR26

**Story 3.2 — Summarization worker + ≤60s post-transcript SLA (non-clinical)**
- *Description:* As a user, my summary appears ≤60s after transcript completes for non-clinical verticals.
- *Acceptance criteria:*
  - Summarization worker consumes `summarize` queue
  - SLA verified on synthetic samples per vertical
  - Audit log + SSE `meeting.summarized` event
- *FRs covered:* FR21

**Story 3.3 — Action-item extraction worker with owner + due-date pre-parsed**
- *Description:* As a user, action items appear with owner and due-date pre-parsed (Things 3-style natural-language parsing) and are one-tap accept/edit.
- *Acceptance criteria:*
  - Worker extracts action items with owner + due-date
  - Receipt UI exposes one-tap accept / edit / mark-done
  - Confidence chip when extraction is uncertain
- *FRs covered:* FR22

**Story 3.4 — `AnalysisCard` shared component contract**
- *Description:* As an engineer, the same `AnalysisCard` shell renders all 8 modules; module-specific content lives in module config (prompt + output schema), never in component code.
- *Acceptance criteria:*
  - `AnalysisCard` consumes `module: ModuleId`, `analysis: ModuleOutput`, `confidence`, `density`, `onAction`
  - Streaming / ready / low-confidence / override / failed states implemented
  - `inline` / `standalone` / `email` variants implemented
  - Storybook stories with all variants + densities + motion modes
- *FRs covered:* FR27

**Story 3.5 — `CitationChip` V2 iconic glyph + `TranscriptSeekPlayer` + 5s pre-roll**
- *Description:* As a user, every analytic claim has a citation chip — clicking it opens the transcript at the speaker turn and plays the 5s before the cited span so I land in context.
- *Acceptance criteria:*
  - `CitationChip` V2 implemented per locked spec (glyph + timestamp + hover preview)
  - Click → opens `TranscriptSeekPlayer`, seeks span, plays 5s pre-roll
  - Keyboard navigable; touch target ≥44px (visual ~24px + extended hit area)
  - Hover preview keyboard-accessible via Radix Tooltip
- *FRs covered:* FR78

**Story 3.6 — Citation-required CI check (analysis-quality regression gate)**
- *Description:* As a quality gate, an analysis output without citations on its analytic claims fails the analysis-quality CI check.
- *Acceptance criteria:*
  - CI gate parses module outputs in fixtures
  - Any analytic claim without a `CitationChip` reference fails the build
  - Gate runs on PR + nightly with synthetic eval samples
- *FRs covered:* FR78

**Story 3.7 — Extended SSE event types (`meeting.summarized`, `meeting.analyzed`)**
- *Description:* As a web client, I receive distinct SSE events per pipeline stage so I can update the receipt UI granularly.
- *Acceptance criteria:*
  - Event names typed in shared schema; client `useSSE` hook dispatches React Query invalidations
- *FRs covered:* FR59 (extended)

### Epic 4: Recording on Mobile & Web with Heartbeat & Retry Discipline

**Story 4.1 — `RecordingStatusPill` V2 inline-waveform across all surfaces**
- *Description:* As a user, my recording status is the same pill — phone lock screen, browser tab pill, bot status row, embed surfaces, calendar markers — and I never wonder whether I'm recording.
- *Acceptance criteria:*
  - V2 inline-waveform variant implemented per locked spec; V1 / V3 not implemented
  - Reduced-motion fallback freezes bars in static elevated position with ARIA-only confirmation
  - Compact / standard / with-device-chip variants implemented
  - `role="status" aria-live="polite"`; timer mono MM:SS; updated every 30s
  - Touch target ≥44px
- *FRs covered:* FR11

**Story 4.2 — One-tap recording on mobile (Expo) + PWA + web with offline-first queue**
- *Description:* As a mobile user, I tap once anywhere (lock-screen widget, app, mobile-web) to start; recording survives backgrounding, screen-lock, and network drops; iOS background-audio entitlement + Android foreground-service in place.
- *Acceptance criteria:*
  - One-tap entry from every surface
  - expo-task-manager + expo-background-fetch handle resumable upload
  - iOS background-audio entitlement + Android API 34+ foreground-service correctly declared
  - PWA Web Audio + service worker for browser-tab record (with acknowledged offline-tab-closed limit)
- *FRs covered:* FR6, FR7

**Story 4.3 — Pre-mic consent modal (consent shape A) + in-person QR/URL consent (consent shape C)**
- *Description:* As a user, before recording starts I acknowledge the org-configurable disclosure; for in-person meetings I can present a QR code my conversation partner scans to acknowledge.
- *Acceptance criteria:*
  - Pre-mic modal blocks `startRecording` until acknowledged
  - In-person QR/URL surface (consent shape C) — only required when org config flags it (FR46)
  - Consent acknowledgment timestamps stored alongside meeting; `consent-check` plugin returns 403 if missing
- *FRs covered:* FR9, FR10

**Story 4.4 — 30s heartbeat detection (capture-side) + push within 60s on lost ping** *(consumes Story 1.10 `packages/notifications` for push dispatch)*
- *Description:* As a user, if my recording silently dies (battery, app killed, etc.), I get a push notification within 60 seconds of detection so I can verify or restart.
- *Acceptance criteria:*
  - Capturing client emits liveness ping every 30s via `POST /api/v1/recordings/:id/heartbeat` (Redis SETEX 90s; Agent B addendum §5)
  - `recording-watchdog` pg-boss job (every 15s) detects lost ping >90s → enqueues `notification.send` job with `kind: 'capture-at-risk'` to `packages/notifications` (Story 1.10)
  - Push copy: *"Recording may have stopped on phone — open AI Secretary to verify"*; dedup logic suppresses repeat pushes within 5 min for same `recordingId`
  - Bot-side liveness ping uses same pattern (deferred to Story 9.6)
- *FRs covered:* FR67 (capture-side)

**Story 4.5 — 10-min resumable-upload silent retry budget + escalation UX** *(consumes Story 1.10 `packages/notifications` for escalation push + email)*
- *Description:* As a user, when my upload hits a flaky network, the system silently retries for 10 minutes; only after the budget exhausts do I get push + email + banner with explicit options.
- *Acceptance criteria:*
  - Silent retry up to 10 min; receipt frame remains visible with non-blocking subtle banner
  - At budget exhaustion: enqueue `notification.send` jobs with `kind: 'upload-retry-exhausted'` to `packages/notifications` (push + email channels) + in-app banner with options (retry now / upload manually / contact support)
  - Recording stays saved on device until upload succeeds or user manually discards
- *FRs covered:* FR68

**Story 4.6 — Live captions during recording for deaf / HoH accessibility**
- *Description:* As a deaf or hard-of-hearing participant, I see real-time captions during a recorded meeting in semantic markup matching `accessible` density when active.
- *Acceptance criteria:*
  - Captions feed from same transcript pipeline (`packages/transcription`)
  - Caption text in semantic HTML; matches `accessible` density when active
  - Toggle visible to participant on receipt + during recording
- *FRs covered:* FR65

### Epic 5: Vertical Modules — Pro-tier Batch (Sales, HR, Education, Customer Support, PM)

**Story 5.1 — Sales module config + deal card output**
- *Description:* As a sales rep, after my call I get a deal card with talk-ratio, objections raised, next-steps surfaced, deal-risk score.
- *Acceptance criteria:*
  - Sales module config ships (prompt + output schema + scoring rules)
  - Output renders through `AnalysisCard` with action row including "Push to CRM" (handed off to Epic 15 F5-CRM flow)
  - Citations on all analytic claims
- *FRs covered:* FR24, FR25 (Sales)

**Story 5.2 — HR/Hiring module config + competency-rubric scoring**
- *Description:* As a hiring manager, my interview gets a competency-rubric scored output mapped to the rubric I've configured.
- *Acceptance criteria:*
  - HR module config ships
  - Competency rubric configurable per-tenant
  - Output renders through `AnalysisCard`
- *FRs covered:* FR24, FR25 (HR)

**Story 5.3 — Education module config + engagement breakdown + objective coverage**
- *Description:* As an educator, my class gets an engagement breakdown + objective-coverage analysis.
- *Acceptance criteria:*
  - Education module config ships
  - Output renders through `AnalysisCard`
- *FRs covered:* FR24, FR25 (Education)

**Story 5.4 — Customer Support module config + resolution + escalation flags**
- *Description:* As a support agent, my call gets a resolution-status + escalation-needed analysis.
- *Acceptance criteria:*
  - Support module config ships
  - Output renders through `AnalysisCard`
- *FRs covered:* FR24, FR25 (Support)

**Story 5.5 — PM module config + decisions log + risk register entries**
- *Description:* As a PM, my meeting gets a decisions log, action items, and risk-register-entry candidates.
- *Acceptance criteria:*
  - PM module config ships
  - Output renders through `AnalysisCard`
- *FRs covered:* FR24, FR25 (PM)

**Story 5.6 — Per-vertical density + copy register tokens (snappy register for these 5)**
- *Description:* As a user, sales / PM / support / education / HR all get the snappy copy register and dense density automatically; no per-vertical custom CSS.
- *Acceptance criteria:*
  - Density variant tokens + copy-register tokens applied per module via config
  - Storybook variants visible
- *FRs covered:* FR27 (per-vertical variants)

**Story 5.7 — `VoiceInputSurface` first-class mobile dictation**
- *Description:* As a mobile user, I edit summaries, action items, and free-text fields by voice.
- *Acceptance criteria:*
  - `VoiceInputSurface` component implemented per locked spec
  - Recording / processing / ready / error states; permission-denied + mic-unavailable handled
  - Used in `LiveNoteEditor` and SOAP-note editing
- *FRs covered:* FR62

### Epic 6: BAA-Gated Modules — Medical/BH & Psychology with Detangled Clinical Capture

**Story 6.1 — `requires_baa` flag in module schema + double-gate enforcement**
- *Description:* As a compliance engineer, BAA-gated modules refuse dispatch when `tenant_entitlements.baa_signed = false`; even when true, dispatch is refused with a clear "HIPAA-eligible routing not yet enabled — coming in Epic 14" message until Epic 14 lands.
- *Acceptance criteria:*
  - `requires_baa: true` in Medical + Psychology configs
  - Module runner returns friendly refusal UX for both gate states
  - ADR records the per-decision-(i) double-gate rationale
- *FRs covered:* FR24 (gating mechanism), NFR17 (foundation)

**Story 6.2 — Medical/BH module config + SOAP draft + screening prompts + risk flags**
- *Description:* As a clinician, my session gets a SOAP draft, screening-prompt suggestions, and clinical risk flags through `AnalysisCard`.
- *Acceptance criteria:*
  - Medical module config ships with relaxed density + reflective copy register tokens
  - SOAP draft output renders; screening prompts + risk flags surface
  - Edit-and-sign action row
- *FRs covered:* FR24, FR25 (Medical)

**Story 6.3 — Psychology module config + therapeutic alliance + themes + intervention notes**
- *Description:* As a therapist, my session gets therapeutic-alliance signals, themes, and intervention-note candidates.
- *Acceptance criteria:*
  - Psychology module config ships
  - Output renders through `AnalysisCard` with relaxed density + reflective register
- *FRs covered:* FR24, FR25 (Psychology)

**Story 6.4 — `ModuleConfirmModal` (clinician-facing) at capture time**
- *Description:* As a clinician at capture, I confirm the inferred vertical (medical / psychology) before recording starts; this is structurally separate from any patient-facing disclosure.
- *Acceptance criteria:*
  - Modal shows inferred vertical + brief context + confirm/override
  - Override list lets clinician pick from available verticals
  - Focus trap; primary action focused on open
- *FRs covered:* FR27 (clinical capture path), foundation for U28

**Story 6.5 — `ConsentDisclosureCard` (patient-facing) inline / screenshare / link variants**
- *Description:* As a patient at capture, I see a screen-shareable disclosure card (in-office) or receive a pre-session link (telehealth) explaining what's recorded, where it goes, and my rights — distinct from the clinician confirming the module.
- *Acceptance criteria:*
  - Three variants implemented: `inline`, `screenshare`, `link`
  - Plain-language register (GOV.UK style); readable in <60s
  - Auto-applies relaxed density + AAA touch targets
  - Acknowledgment timestamp captured + audit-logged (full clinical disclosure artifact ships in Epic 14)
- *FRs covered:* FR55 (substrate), U28

**Story 6.6 — Per-vertical clinical SLA branch (FR79 clinical timing)**
- *Description:* As a clinician, my receipt timing is generous (<60s first stream / <5min summary / <30 min full receipt); spare cycles fund quality (better diarization, clinical-quality checks).
- *Acceptance criteria:*
  - Clinical pipeline configured to spend extra cycles on quality
  - Receipt expected-arrival-time indicator reflects clinical timing honestly
  - Module-correct without override target ≥99% verified on synthetic samples
- *FRs covered:* FR79 (clinical branch)

### Epic 7: Search & RAG Chat — Knowledge Recall, Power-User Shell & Streaming Citations

**Story 7.1 — pgvector HNSW indexing + per-dimension vector tables + embedding indexer worker**
- *Description:* As a platform engineer, embeddings live in `embeddings_1536` and `embeddings_1024` tables (Gap S1); the indexer worker keeps them current.
- *Acceptance criteria:*
  - pgvector HNSW index per table
  - Indexer worker consumes `index` queue; runs on transcript completion
  - Tenant region honored in vector queries
- *FRs covered:* (foundation for FR28, FR29)

**Story 7.2 — FTS + semantic ranking + p95 <2s on 100K-meeting corpus**
- *Description:* As a user, full-text + semantic search returns ranked snippets with timestamps and deep-links in <2s on a 100K corpus.
- *Acceptance criteria:*
  - Search service combines FTS + semantic; ranker tuned
  - p95 <2s verified on seeded 100K-meeting corpus
  - Snippet + module badge + meeting title + relative time per result
- *FRs covered:* FR28

**Story 7.3 — cmd-K command palette with locked keyboard contract**
- *Description:* As a power user, I press cmd-K from anywhere on web to search/navigate with the locked contract: ↑/↓ cycle, Enter open, Esc close, focus trap on open, restore focus to trigger.
- *Acceptance criteria:*
  - Built on shadcn Command primitive; type-ahead fuzzy search
  - Keyboard contract verified by Storybook a11y addon + Playwright
  - ARIA live region announces result count
- *FRs covered:* FR28 (cmd-K substrate)

**Story 7.4 — RAG retriever + streaming chat with inline citation chips + 4 empty-state shapes**
- *Description:* As a user, I chat with my corpus; answers stream with citation chips populating inline; empty states are honest ("I don't know" beats hallucination).
- *Acceptance criteria:*
  - RAG retriever federated across transcripts / summaries / actions / analyses
  - Streaming chat through LLM gateway; ARIA live region per chunk + per citation arrival
  - Four empty states: confident / low-confidence-with-rank-chips / "I don't know" / off-topic
  - Faithfulness ≥90% on internal eval set (NFR10)
  - Refuses ungrounded claims
- *FRs covered:* FR29, FR30, FR78 (in chat), NFR28

**Story 7.5 — `RelationshipBrowser` for people / calendar / project facets**
- *Description:* As a user, I navigate by relationship — "meetings with Dana," "Q2 deals," "Acme account" — alongside cmd-K's text search.
- *Acceptance criteria:*
  - Built on shadcn Command + custom IA
  - Facets: participants, calendar, project, patient (clinical)
- *FRs covered:* FR28 (relationship navigation)

**Story 7.6 — `AppShell.Search` (D4 power-user toggle) + `SearchHomeShell` + activation logic**
- *Description:* As a power user with 50+ indexed meetings (or by opt-in), I toggle on a search-first home shell where search is the home content.
- *Acceptance criteria:*
  - `AppShell.Search` implemented as third top-level shell
  - Activation: `user.powerUserMode` setting OR `meetingsIndexed >= 50`
  - Selection at route level; never per-page
  - Same component library, same tokens
- *FRs covered:* FR77 (Search shell)

### Epic 8: Sharing, My Actions, Team-Lead Space & Cross-Org Scope

**Story 8.1 — Share grant model (owner/editor/viewer) + tenant-internal share flow**
- *Description:* As a user, I share a meeting (full / clip / single insight) with a teammate at owner/editor/viewer scope; recipient sees only what was shared.
- *Acceptance criteria:*
  - Share grant model in DB; clip + insight scopes implemented
  - Tenant + share-scope isolation enforced via RLS + service-layer checks
  - Audit-log entry per locked shape (meeting / share / scope / recipient / token-URL hash / expiry / region)
- *FRs covered:* FR31, FR33

**Story 8.2 — Public read-only token URL + 30d default expiry + expired-share UX**
- *Description:* As a recipient without an account, I view a shared meeting via a token URL with no signup required; expired tokens show a clear message with "request new link" CTA.
- *Acceptance criteria:*
  - Token URL generation; 30d default expiry; configurable
  - Expired share page with "request new link" CTA
- *FRs covered:* FR32

**Story 8.3 — `ShareRecipientView` auth-free WCAG AA recipient view**
- *Description:* As a recipient on a token URL, I get a keyboard-navigable, captioned-playback, semantic-transcript-markup view with no upsell and no signup wall.
- *Acceptance criteria:*
  - Component implemented per locked spec
  - WCAG AA verified by axe-core in Storybook + Playwright
  - Lands focus on receipt title; honors recipient OS preferences for density
- *FRs covered:* FR32 (recipient view contract)

**Story 8.4 — Cross-org sharing scope detection + sender-side audit visibility**
- *Description:* As a sender, when I share to an email belonging to another AI Secretary tenant, the share is generated; on the receiving tenant the share appears in their audit log as inbound (*"shared from acme.com"*) and is enforced at view-time per their org's accept-policy (configured in Epic 12).
- *Acceptance criteria:*
  - Cross-org email detection; share marked `cross_org: true`
  - Receiving-tenant audit-log entry written
  - View-time enforcement honors receiving-org policy (admin-config in Epic 12)
- *FRs covered:* FR74 (sender side + audit visibility)

**Story 8.5 — "My Actions" first-class cross-meeting roll-up**
- *Description:* As a user, I see all my open + completed action items across all my meetings on a "My Actions" page with status, due-date, and source-meeting backlink.
- *Acceptance criteria:*
  - Dedicated route `/actions`
  - Filter by status + due-date + source meeting
  - One-tap mark-done; deep-link back to meeting receipt
- *FRs covered:* FR23

**Story 8.6 — Team-lead parallel product space + `ManagerCoachingCard`**
- *Description:* As a team lead, I have a parallel product space with team-meeting roll-ups, analysis trends, and a `ManagerCoachingCard` to annotate teammates' meetings at span level and share back.
- *Acceptance criteria:*
  - Team-lead space lives at separate IA, not a tab in meeting view
  - `ManagerCoachingCard` implemented per locked spec; span-anchored annotations
  - Surveillance aesthetic explicitly avoided (per Step 5 anti-pattern)
- *FRs covered:* FR34

### Epic 9: Bot-Captured Meetings (Zoom & Teams) with Region-Aware Consent

**Story 9.1 — Zoom Server-to-Server OAuth (per region) + minimal admin UI for credentials**
- *Description:* As an org admin, I connect Zoom from a minimal credentials UI; credentials live as Railway secrets per region.
- *Acceptance criteria:*
  - Zoom S2S OAuth app per region (Gap B1)
  - Minimal admin UI scoped to credentials only (extended later by Epic 12)
- *FRs covered:* FR12

**Story 9.2 — Microsoft Teams app-only Graph credentials + minimal admin UI**
- *Description:* As an org admin, I connect Teams via app-only Graph creds with admin consent; minimal UI mirrors Zoom flow.
- *Acceptance criteria:*
  - Teams app-only Graph credentials per region with admin consent
  - Minimal admin UI shipped
- *FRs covered:* FR13

**Story 9.3 — `apps/bot` service + bot auto-join within 30s of meeting start**
- *Description:* As an org user, my opted-in scheduled meetings get a bot that joins within 30s of start time.
- *Acceptance criteria:*
  - Bot service spins up; joins per Zoom Meeting SDK / Teams meeting webhook
  - 30s join-time SLA verified
- *FRs covered:* FR12, FR13 (auto-join)

**Story 9.4 — TTS-first / chat-after disclosure (consent shape B) + per-participant consent timestamps**
- *Description:* As a meeting participant, I hear the spoken disclosure first, see the chat post second, and the bot records each participant's acknowledgment timestamp.
- *Acceptance criteria:*
  - TTS announcement on join (configurable copy from F2-admin Disclosure step)
  - Chat post with disclosure URL follows immediately
  - Per-participant consent timestamp captured
- *FRs covered:* FR14

**Story 9.5 — Region-aware consent branch (FR69)**
- *Description:* As a participant, the consent flow branches on my region + org policy: EU + strict = explicit chat-command opt-in (60s window); non-EU OR legitimate-interest = implicit-by-staying with chat-command opt-out. EU per-participant detection forces the explicit-consent path even when the tenant default is `legitimate-interest` — most-protective rule wins per ADR-0005.
- *Acceptance criteria:*
  - Region detection via meeting metadata implemented in `packages/consent/region-detect.ts` (Zoom: participant locale + IP region from webhook payload; Teams: Graph user `usageLocation` + tenant region; conservative `unknown` on conflicting signals)
  - **Per-participant override (GDPR-driven hard rule, not admin preference):** any EU participant gets the explicit-consent path regardless of `tenant_settings.consent_legal_basis`; tenant default is the floor, never the ceiling
  - EU + explicit branch: 60s window via `apps/bot/src/zoom/consent-orchestrator.ts` (and Teams equivalent), absent opt-in = audio diarized + participant excluded via `packages/transcription/diarize-exclude.ts`, chat-pinged reminder
  - Non-EU branch: implicit acknowledgment by staying, chat-command opt-out available
  - Strict-policy + opt-out: admin-configurable auto-quarantine vs per-participant exclusion (`tenant_settings.policy_optout_action`)
  - Default conservative (EU=explicit, US=legitimate-interest); admin overrides tenant *default* in Epic 12 but cannot override per-participant EU detection
  - `consents` rows persisted per participant per decision (legal_basis + consent_shape + decision + evidence JSONB) before any pipeline enqueue; transcribe handler joins consents → diarization speakers and suppresses transcript content for `declined` / `expired-no-response` decisions
- *FRs covered:* FR69

**Story 9.6 — Bot-side 30s liveness ping + push within 60s on lost ping + Zoom Cloud upload fallback** *(consumes Story 1.10 `packages/notifications` for escalation dispatch)*
- *Description:* As an org user, if the bot fails to join or drops mid-meeting, I get push + email + in-app banner within 60s of detection, with an "Upload from Zoom Cloud" fallback option.
- *Acceptance criteria:*
  - Bot-service liveness ping every 30s to `POST /api/v1/bot/sessions/:id/heartbeat` (HMAC-signed; Redis key prefix `heartbeat:bot:`)
  - `recording-watchdog` job detects lost ping → enqueues `notification.send` jobs with `kind: 'bot-join-failed'` (push + email + in-app banner channels) within 60s of detection
  - Post-meeting upload fallback wired (FR15) via `apps/workers/handlers/zoom-cloud-recording-fetch.ts` (Zoom only)
- *FRs covered:* FR15, FR67 (bot-side)

### Epic 10: Calendar Integration (Nylas)

**Story 10.1 — Nylas integration adapter + minimal admin UI for credentials**
- *Description:* As an org admin, I connect a calendar via Nylas (Google / Microsoft / Exchange / iCloud) from a minimal credentials UI.
- *Acceptance criteria:*
  - Nylas adapter implemented; HMAC-verified webhooks
  - Minimal admin UI scoped to credentials only
- *FRs covered:* FR16 (connection)

**Story 10.2 — Calendar-sync worker + ≤5 min sync lag**
- *Description:* As a user, my upcoming meetings appear in AI Secretary within 5 minutes of any change in my calendar.
- *Acceptance criteria:*
  - Sync worker consumes Nylas webhooks
  - p95 sync lag ≤5 min verified
- *FRs covered:* FR16 (sync SLA)

**Story 10.3 — Per-meeting auto-record opt-in + persistence across syncs**
- *Description:* As a user, I toggle auto-record per meeting; the toggle persists across calendar syncs (re-sync doesn't drop my opt-ins).
- *Acceptance criteria:*
  - Per-meeting flag stored independent of Nylas sync state
  - Toggle UI on calendar view
- *FRs covered:* FR17

### Epic 11: Org Admin — Seats & Access Management

**Story 11.1 — Seat management (invite / remove / role assignment)**
- *Description:* As an org admin, I add and remove members and assign roles (org_admin / org_member / org_viewer).
- *Acceptance criteria:*
  - Invite flow + email; revocation flow
  - Role assignment with audit-log entries
- *FRs covered:* FR41

**Story 11.2 — SSO type configuration + MFA enforcement**
- *Description:* As an org admin, I configure which SSO types are allowed (email / Google / Microsoft / SAML) and whether MFA is enforced org-wide.
- *Acceptance criteria:*
  - SSO toggles per-tenant
  - MFA-enforced flag respected by login flow
- *FRs covered:* FR48

### Epic 12: Org Admin — F2-admin First-Launch + Configuration & Integrations + Cross-Org Policy

**Story 12.1 — F2-admin first-launch flow (DPA + region + retention + disclosure + modules + integrations + SSO + invites)**
- *Description:* As a first-time org admin, I'm walked through the structurally distinct F2-admin sequence with DPA acceptance blocking, region-pin locking-once-set, retention defaults, disclosure copy, vertical enablement, optional integrations, optional SSO, then user invites. Lifecycle is modeled as a Postgres `tenant_state` enum per ADR-0004; capability gates progressively unlock as steps complete.
- *Acceptance criteria:*
  - **Tenant lifecycle FSM** (per ADR-0004): `tenants.state` enum transitions `draft → dpa_required → dpa_accepted → region_pinning → provisioning → active`. New `tenant-state-check` Fastify plugin rejects mutating recording-pipeline routes when state ∉ `{active, provisioning}`
  - **DPA gate:** `POST /api/v1/tenants/me/dpa` accepts; declined → state flips to `suspended` + contact-sales surface. `tenants.dpa_version`, `dpa_accepted_at`, `dpa_accepted_by_user_id` recorded; audit `tenant.dpa-accepted`
  - **Region pin:** `POST /api/v1/tenants/me/region` is one-shot — sets `data_region` + `region_locked_at`; subsequent calls 409. DB trigger `enforce_region_lock` enforces immutability at storage layer (defense in depth). Audit `tenant.region-pinned`
  - **`tenant_settings` table** (per ADR-0004) carries `disclosure_text_*` (premic / bot-announcement / patient-artifact), `retention_audio_days` / `retention_transcript_days` / `retention_per_vertical` (JSONB), `consent_legal_basis` (per-region default), `policy_in_person_consent_required`, `policy_optout_action`, `cross_org_share_policy` + `cross_org_share_whitelist`. Each `PATCH /v1/tenants/me/settings` audit-logged with the specific field group
  - **Auto-activation:** server transitions `provisioning → active` automatically when disclosure set + retention set + ≥1 module enabled in `tenant_entitlements`
  - **Onboarding progress source-of-truth:** `GET /api/v1/tenants/me/state` returns current state + completed-steps array for UI rendering
  - Integration credentials surface (Nylas / Zoom / Teams / Slack / HubSpot / Salesforce / Pipedrive) provisions `tenant_integrations` rows (introduced in §3 addendum); each connection audit-logged via existing CRM/calendar/etc audit actions
  - SSO config (Day-1: Google + Microsoft via `tenant_settings.required_sso_provider` flag; SAML deferred per ADR-0004)
- *FRs covered:* FR72

**Story 12.2 — Tenant integrations consolidation surface (Nylas + Zoom + Teams + Slack + HubSpot + Salesforce + Pipedrive)**
- *Description:* As an org admin, I configure all tenant integrations in one centralized admin product space; this consolidates the minimal credential UIs from Epics 9 + 10.
- *Acceptance criteria:*
  - All integration credentials manageable from one place
  - Per-integration audit-log entries
- *FRs covered:* FR42

**Story 12.3 — Retention policy per asset + scheduled purge worker + audit**
- *Description:* As an org admin, I set retention per audio / transcript / embedding (and per-vertical overrides); a scheduled purge worker enforces and audit-logs.
- *Acceptance criteria:*
  - Retention config UI; per-vertical overrides
  - Scheduled purge worker via pg-boss
  - Each purge audit-logged with cascade scope
- *FRs covered:* FR43

**Story 12.4 — Recording disclosure copy + in-person 3rd-party consent toggle + region pin display**
- *Description:* As an org admin (post-F2-admin), I edit recording disclosure copy ongoing, toggle the in-person 3rd-party consent requirement, and view (read-only) the region pin.
- *Acceptance criteria:*
  - Disclosure copy editable; flows propagate to capture flows + bot + patient artifact
  - In-person consent toggle wired to recording UI (FR46)
  - Region pin read-only display
- *FRs covered:* FR45, FR46, FR47

**Story 12.5 — `AuditLogTable` queryable / filterable / exportable + module-tinted left-border**
- *Description:* As an org admin, I browse a Stripe-grade audit timeline filterable by user / action / date / module / region; module-tinted left border on rows is the controlled compliance-review exception.
- *Acceptance criteria:*
  - Built on shadcn DataTable; CSV / JSON export
  - Filters wired; row-level expand for full event detail
  - Module-tinted left border (3px Tailwind 300-shade) only in this audit context
- *FRs covered:* FR49

**Story 12.6 — F3 region-aware consent policy admin config**
- *Description:* As an org admin, I configure the consent policy (explicit per-participant for EU vs legitimate-interest implicit for non-EU) and the strict-policy opt-out behavior (auto-quarantine vs per-participant exclusion).
- *Acceptance criteria:*
  - Admin UI exposes both knobs with sensible defaults
  - Policy change audit-logged
  - Bot service honors policy at runtime
- *FRs covered:* FR69 (admin policy side)

**Story 12.7 — Cross-org sharing accept-policy (accept all / whitelist / block all)**
- *Description:* As an org admin, I configure the receiving-side cross-org accept policy; enforced at view-time so senders always succeed but recipients may see "blocked by your org."
- *Acceptance criteria:*
  - Admin UI with three options + whitelist domain entry
  - Policy enforced at view-time
  - Audit-log entries on policy change + on view-time block events
- *FRs covered:* FR74 (receiving-org policy)

### Epic 13: Billing, Entitlements & Upsell

**Story 13.1 — Stripe webhook handler → `tenant_entitlements` transactional update**
- *Description:* As a platform engineer, every `customer.subscription.*` Stripe webhook event updates `tenant_entitlements` transactionally; entitlements are never computed from Stripe API at request time.
- *Acceptance criteria:*
  - HMAC-verified webhook endpoint
  - Transactional update; idempotent
  - Audit-log entry per change
- *FRs covered:* FR37

**Story 13.2 — Entitlement-check plugin at every API boundary + module entitlement enforcement**
- *Description:* As a platform engineer, every tenant-scoped route calls `entitlement-check` before dispatch; disabled modules return 403 with friendly upsell hint.
- *Acceptance criteria:*
  - Plugin in upstream chain after `tenant-context`
  - Module dispatch enforces entitlement
- *FRs covered:* FR38

**Story 13.3 — Seat ceiling + meeting-hour overage tracking + billable surfacing**
- *Description:* As a billing engineer, seat ceilings and meeting-hour overage are enforced and tracked; overage is billable.
- *Acceptance criteria:*
  - Seat ceiling per tier respected on invite flow
  - Hour-overage tracker in DB; billing pipeline picks it up
- *FRs covered:* FR39

**Story 13.4 — Four tiers + entitlement axes**
- *Description:* As a tenant, my plan tier (Free / Pro / Business / Enterprise) maps to all entitlement axes per PRD §8.
- *Acceptance criteria:*
  - Tier definitions in DB
  - Entitlement axes (modules[], max_seats, max_meetings_per_month, max_audio_hours_per_seat_per_month, retention_days_*, regions[], deployment_topology, sso_types[], mfa_enforced, baa_signed, custom_kms_key_id) all respected
- *FRs covered:* FR40

**Story 13.5 — Module entitlement configuration in admin UI (`EntitlementGrid`)**
- *Description:* As an org admin, I see a matrix of users × 8 verticals and toggle entitlements; bulk edit; audit-logged.
- *Acceptance criteria:*
  - Built on shadcn DataTable
  - Bulk edit; per-row toggle
  - Audit-log entries on change
- *FRs covered:* FR44

**Story 13.6 — Locked-module upsell pattern**
- *Description:* As a user viewing a meeting eligible for a module my tenant doesn't have entitled, I see an inline "try [Module] analysis on this meeting" CTA.
- *Acceptance criteria:*
  - Inline CTA on receipt for eligible-but-not-entitled modules
  - Click → upsell flow (admin contact for Pro+, self-serve checkout for Free)
- *FRs covered:* FR64

**Story 13.7 — Trial state tracking + reminder emails + auto-conversion / sales-handoff** *(consumes Story 1.10 `packages/notifications`; extends ADR-0004 trial fields)*
- *Description:* As a Pro / Business / Enterprise customer in trial, I see my trial state on every billing surface, get reminder emails at T-3d and T-1d before expiration, and on trial-end either auto-convert (Pro with card on file), block new mutations + see upgrade CTA (Pro without card → `trial_expired`), or get a sales handoff (Business / Enterprise pilot).
- *Acceptance criteria:*
  - `tenants` table extended (per ADR-0004 trial-fields migration) with `trial_kind` (`pro` | `business` | `enterprise_pilot` | null), `trial_starts_at`, `trial_ends_at`, `trial_card_on_file` (boolean)
  - Stripe webhook handlers process `customer.subscription.trial_will_end` (3d before) → enqueue T-3d reminder via `packages/notifications` `kind: 'trial-ending-soon'`; cron-scheduled T-1d reminder via pg-boss
  - Trial-end transitions: Pro `trial_card_on_file = true` → Stripe auto-converts via `customer.subscription.updated`; Pro `trial_card_on_file = false` → tenant moves to `trial_expired` state (extends `tenant_state` enum per ADR-0004 trial-fields update OR sets a separate flag — see arch-addendums.md ADR-0004 for chosen approach); Business → admin sees "talk to sales" CTA; Enterprise pilot → admin contact-sales handoff with custom expiration override
  - `trial_expired` blocks new state-changing mutations (recording-pipeline, share-creation) but allows read-only access + DSAR + admin actions
  - Audit-log entries: `tenant.trial-started`, `tenant.trial-reminder-sent`, `tenant.trial-converted`, `tenant.trial-expired`, `tenant.trial-extended` (added to `apps/api/src/lib/audit-types.ts` union)
  - Admin UI surfaces trial state + days remaining + manual-extend CTA (Enterprise only)
- *FRs covered:* FR81

### Epic 14: Compliance, Privacy & Public DSAR Portal *(includes EU deployment + HIPAA routing)*

**Story 14.1 — Self-service DSAR endpoint + ≤24h zip export** *(consumes Story 1.10 `packages/notifications` for email delivery)*
- *Description:* As a tenant user, I request a DSAR and receive a zip export within 24 hours.
- *Acceptance criteria:*
  - DSAR worker produces zip; presigned link delivered via `packages/notifications` email channel with `kind: 'dsar-ready'` (Postmark default; SES fallback; SMTP for on-prem)
  - p95 ≤24h verified
  - Audit-log entry on DSAR request + zip-ready + email-sent
- *FRs covered:* FR50

**Story 14.2 — Right-to-erasure cascade per erasure-cascade map ≤30d**
- *Description:* As a user requesting erasure, my data (audio / transcripts / summaries / analyses / embeddings) is deleted within 30 days following the registered cascade map.
- *Acceptance criteria:*
  - Cascade follows erasure-cascade map (registered Epic 1, updated by every later epic)
  - 30d SLA verified
  - Audit-log entry per stage
- *FRs covered:* FR51

**Story 14.3 — Public DSAR portal at `aisecretary.app/data-rights`**
- *Description:* As a non-customer third party, I submit access/deletion requests at a public, no-auth portal with plain-language register; identity-verified submissions propagate to the right tenant's admin queue.
- *Acceptance criteria:*
  - No-auth public route
  - Plain-language GOV.UK register
  - Identity verification flow (email + secondary)
  - Submission propagates to receiving tenant's `DsarQueueItem` queue
- *FRs covered:* FR52

**Story 14.4 — `DsarQueueItem` cascade-scope preview before commit**
- *Description:* As an org admin, I see a cascade-scope preview ("47 transcripts, 12 summaries, 3 analyses, 1,200 embeddings — confirm") before committing a DSAR.
- *Acceptance criteria:*
  - Component implemented per locked spec
  - Preview computed from erasure-cascade map
  - Approve / reject / escalate-to-legal action buttons
- *FRs covered:* FR53

**Story 14.5 — Audit-log export endpoint**
- *Description:* As an org admin, I export the audit log via a tenant-scoped endpoint for compliance evidence.
- *Acceptance criteria:*
  - Tenant-scoped read enforced via RLS
  - CSV / JSON export
- *FRs covered:* FR54 (export endpoint)

**Story 14.6 — Full clinical patient-disclosure artifact (consent shape D)**
- *Description:* As a clinician, I have a fully production-grade `ConsentDisclosureCard` (extending the substrate from Epic 6) with all three variants (inline / screenshare / link), screen-shareable, and fully WCAG AA + plain-language.
- *Acceptance criteria:*
  - Three variants polished to spec
  - Full localization (EN + FR with clinical wording — *compte rendu*)
  - Section 508 conformance documented
- *FRs covered:* FR55

**Story 14.7 — HIPAA-eligible provider chain + Medical/Psych second-gate release**
- *Description:* As a medical/BH tenant with `baa_signed = true`, my requests route through Anthropic via AWS Bedrock (chat) + Azure OpenAI HIPAA-eligible (fallback) + BAA-eligible embeddings (Azure or self-hosted), and the second gate on Epic 6's modules releases.
- *Acceptance criteria:*
  - LLM gateway routing matrix encodes HIPAA chain
  - Embeddings via Azure OAI (BAA) or self-hosted SentenceTransformers
  - Module runner releases double-gate; Medical + Psych dispatch when posture matches
- *FRs covered:* (NFR17 fulfillment — releases FR24/FR25 second gate from Epic 6)

**Story 14.8 — EU stack deployment (Railway eu-west) + EU embeddings (Voyage / bge-m3) + Anthropic AWS-EU**
- *Description:* As an EU tenant, my full stack runs in eu-west-1; embeddings via Voyage AI or self-hosted bge-m3; chat via Anthropic AWS-EU; storage in eu-west-1; no cross-region data movement.
- *Acceptance criteria:*
  - Railway eu-west services deployed
  - LLM gateway routing matrix encodes EU chain
  - Subdomain routing `{tenant}.eu.aisecretary.app` resolves correctly
- *FRs covered:* (NFR12, NFR13, NFR18 fulfillment)

### Epic 15: LMS Integration & Distribution Surfaces (incl. F5-CRM Deal-Mapping)

**Story 15.1 — LTI 1.3 deep-linking launch from LMS**
- *Description:* As an educator, I launch AI Secretary from my LMS via LTI 1.3 deep-linking.
- *Acceptance criteria:*
  - LTI 1.3 launch endpoint
  - Tool launch token verified; tenant + user resolved correctly
- *FRs covered:* FR35

**Story 15.2 — LTI 1.3 AGS gradebook passback**
- *Description:* As an educator, scores from analyses pass back to my LMS gradebook via LTI AGS.
- *Acceptance criteria:*
  - AGS passback endpoint
  - Score schema mapped from Education module output
- *FRs covered:* FR36

**Story 15.3 — Chrome extension overlay (HubSpot / Salesforce / Pipedrive)**
- *Description:* As a sales rep, I see meeting receipts inside my CRM via a Chrome extension overlay.
- *Acceptance criteria:*
  - Extension renders in HubSpot, Salesforce, Pipedrive deal pages
  - Inherits host viewport; consumes shared component library + tokens
- *FRs covered:* FR56

**Story 15.4 — F5-CRM deal-mapping multi-step flow**
- *Description:* As a sales rep, "Push to CRM" walks me through attendee lookup → contact match → ranked deal list → user picks → optional auto-create deal → push as activity note + linked transcript.
- *Acceptance criteria:*
  - Multi-step flow per locked F5-CRM design
  - Never auto-pick when multiple matching deals
  - Failure modes: API timeout = 5min retry queue then notify; permission error = deep-link to re-auth + post-auth retry
  - Audit-log entry: `meeting.pushed-to-crm` with target system + deal ID
  - Toast confirmation with link to deal in CRM
- *FRs covered:* FR73

**Story 15.5 — Slack hub app + Teams hub app (receipt push to channel)**
- *Description:* As a team member, meeting receipts land in my Slack or Teams channel as summary-with-link-back posts.
- *Acceptance criteria:*
  - Slack hub app + Teams hub app implemented
  - Receipt arrives in-channel; link-back to full receipt
- *FRs covered:* FR57, FR58

**Story 15.6 — Hub-app dispatch event types via `packages/notifications`** *(consumer of Story 1.10)*
- *Description:* As a mobile user, I receive push notifications on analysis completion through the foundation `packages/notifications` package (shipped in Epic 1 Story 1.10). Epic 15 adds the hub-app-specific event types — Slack/Teams in-channel posts (Story 15.5) and CRM-side notifications (Story 15.4). Capture-at-risk (FR67) and upload-retry-exhausted (FR68) push dispatch already lands via Epic 4 / Epic 9 directly through the foundation package; Story 15.6 does NOT introduce push infrastructure.
- *Acceptance criteria:*
  - New event-type constants registered with `packages/notifications` for `analysis.completed`, `share.received`, `share.cross-org-blocked-by-policy`, plus Slack/Teams channel-post and CRM-side completion events
  - Email + push templates added to the package's template registry for these events
  - User notification preferences (per-channel + per-event) honored — uses `user_preferences` table established in Story 1.10
  - Audit-log entries via existing notification audit actions
- *FRs covered:* FR60 (consumer adds event types only)
