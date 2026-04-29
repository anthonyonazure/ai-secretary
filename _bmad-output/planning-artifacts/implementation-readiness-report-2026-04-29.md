---
project_name: AI Secretary System
user_name: Anthony
date: 2026-04-29
workflowType: check-implementation-readiness
status: in-progress
stepsCompleted: [1, 2, 3, 4, 5, 6]
lastStep: 6
status: complete
inputDocuments:
  - docs/mini-prd.md
  - docs/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/arch-addendums.md
  - _bmad-output/planning-artifacts/reconciliation-note.md
  - docs/input-spec.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-04-29
**Project:** AI Secretary System

## Step 1 — Document Inventory

### PRD Documents

**Whole Documents:**
- `docs/mini-prd.md` (16,346 bytes, modified 2026-04-29 05:10) — locked PRD
- `docs/input-spec.md` (3,294 bytes, modified 2026-04-29 03:38) — original brief (upstream of PRD)

**Sharded Documents:** none

### Architecture Documents

**Whole Documents:**
- `docs/architecture.md` (50,471 bytes, modified 2026-04-29 05:12) — locked architecture (Winston / BMAD architect)
- `_bmad-output/planning-artifacts/arch-addendums.md` (92,343 bytes, modified 2026-04-29 09:54) — 8 addendums covering UX-driven patterns; ADRs 0002–0006 PROPOSED. **Extends** the locked architecture; does not replace.

**Sharded Documents:** none

**Supporting:**
- `docs/decisions/` — ADR folder (currently holds template `0001-template.md` only; ADRs 0002–0006 are PROPOSED in `arch-addendums.md`, awaiting promotion after first-implementation validates each pattern)
- `docs/compliance/`, `docs/runbook/` — directories present, content not in scope for readiness check

### Epics & Stories Documents

**Whole Documents:**
- `_bmad-output/planning-artifacts/epics.md` (117,394 bytes, modified 2026-04-29 09:55) — 79 FRs / 35 NFRs / 34 additional reqs / 15 epics / 80 inline stories. Step 2 of `create-epics-and-stories` complete. Reconciliation pass applied 2026-04-29 (Stories 9.5 + 12.1 sharpened).

**Sharded Documents:** none

### UX Design Documents

**Whole Documents:**
- `_bmad-output/planning-artifacts/ux-design-specification.md` (154,654 bytes, modified 2026-04-29 09:11) — locked 14-step `create-ux-design` output; 3,340 lines

**Sharded Documents:** none

### Supplementary Planning Artifacts (in scope)

- `_bmad-output/planning-artifacts/reconciliation-note.md` (9,769 bytes, modified 2026-04-29 09:47) — 3 P0 gaps closed (G1/G2/G3), 5 P1 items deferred to per-sprint story sharpening (N1–N5)
- `_bmad-output/planning-artifacts/open-work/` — 5 files (designer brief / card-sort plan / customer-dev interview plan / reduced-motion audit checklist / telemetry ownership matrix)

### Critical Issues Found

**Duplicates:** none — no whole + sharded conflicts.

**Missing documents:** none required by the workflow are missing.

**Notes for assessor:**
- `arch-addendums.md` is the source of truth for 8 UX-driven architectural patterns introduced after `architecture.md` was locked. Treat both as the architecture contract.
- `reconciliation-note.md` is the integration record for the cross-agent parallel pass (epics revision / arch deep-dive / open-work bundle, 2026-04-29). Already-closed gaps are noted; deferred N1–N5 items are sprint-pickup work.

---

## Step 2 — PRD Analysis

**Source:** [docs/mini-prd.md](docs/mini-prd.md) (16,346 bytes; locked 2026-04-29).

**Note on extraction method:** The PRD has no explicit FR numbering. Requirements are derived from §6 user journeys (J0–J13), §12 product commitments, §10 integrations, §8 pricing/entitlement axes, §9 NFRs, §4 vertical modules, and §11 deployment topologies. The PRD-derived requirement IDs below carry a provenance prefix (`PRD-J*`, `PRD-C*`, `PRD-I*`, `PRD-E*`, `PRD-V*`, `PRD-T*`) so Step 3 coverage validation can trace cleanly. These are NOT the same identifiers as `epics.md` FR1–FR79 — the FR1–FR79 set is the product-of-derivation; this Step 2 extraction is the source-of-derivation.

### Functional Requirements Extracted

**Onboarding & Activation (PRD-J0)**
- **PRD-J0.1:** New org self-serve signup ≤ 60 s (J0).
- **PRD-J0.2:** First user invites additional users (J0).
- **PRD-J0.3:** First meeting recorded → activation event (J0).
- **PRD-J0.4:** 70% of new orgs reach activation (first meeting analyzed) within 7 days (§7 success metrics — measurable target).

**Recording & Capture (PRD-J1, J2)**
- **PRD-J1.1:** Mobile-web/native (Expo + PWA) supports starting/stopping a recording on phone (J1).
- **PRD-J1.2:** Pipeline produces transcript + summary + action items ≤ 3 min after stop for ≤ 30-min audio (J1).
- **PRD-J1.3:** p95 transcription latency ≤ 6× real-time (J1, §7, §9).
- **PRD-J1.4:** Summary p95 ≤ 60 s after transcript ready (J1).
- **PRD-J2.1:** Drag-drop file upload on web; chunked + resumable; supports up to 4 hr / 2 GB (J2).

**Bot-Captured Meetings (PRD-J3)**
- **PRD-J3.1:** Zoom OAuth connect; bot auto-joins scheduled meetings ≤ 30 s of meeting start (J3).
- **PRD-J3.2:** Microsoft Teams OAuth connect; bot auto-joins scheduled meetings (J3).
- **PRD-J3.3:** Live capture supported during meeting (J3).
- **PRD-J3.4:** Post-meeting upload from host platform if live capture unavailable (J3).

**Calendar (PRD-J4)**
- **PRD-J4.1:** Connect calendar via Nylas (Google + Microsoft + Exchange + iCloud); upcoming meetings visible (J4).
- **PRD-J4.2:** Calendar sync lag ≤ 5 min (J4, §9 SLA implicit).
- **PRD-J4.3:** Per-meeting auto-record opt-in toggle, persistent across syncs (J4).

**Search & Chat (PRD-J5, J7)**
- **PRD-J5.1:** Search corpus (full-text + semantic) returns ranked snippets with timestamps (J5).
- **PRD-J5.2:** Search p95 < 2 s on 100K-meeting corpus (J5, §7).
- **PRD-J5.3:** Search results deep-link to transcript anchor (J5).
- **PRD-J7.1:** RAG chat returns grounded answers with citations (J7).
- **PRD-J7.2:** RAG refuses ungrounded claims (J7).
- **PRD-J7.3:** RAG faithfulness target ≥ 90% on internal eval set (J7, §7).

**Vertical Analysis Modules (PRD-J6, V1–V8)**
- **PRD-J6.1:** Vertical-specific analysis report on a meeting on demand; output ≤ 90 s; output validates against module schema; cites transcript spans (J6).
- **PRD-V1:** General module (fallback for any meeting type).
- **PRD-V2:** Sales module (talk-ratio, objections, next-step clarity, deal-risk, CRM-ready summary).
- **PRD-V3:** HR/Hiring module (competency rubric scoring, behavioral signals, decision-recommendation).
- **PRD-V4:** Education module (engagement signals, learning-objective coverage, student participation).
- **PRD-V5:** Medical/Behavioral Health module (SOAP draft, screening prompts, risk flags; HIPAA/BAA-ready).
- **PRD-V6:** Customer Support module (issue summary, sentiment, resolution status, escalation flag).
- **PRD-V7:** Project Management module (decisions log, action items with owner+due-date, blockers, risks).
- **PRD-V8:** Psychology module (therapeutic alliance signals, themes, intervention notes; HIPAA-eligible posture available).
- **PRD-C1 (commitment §12):** Adding a 9th+ vertical = config PR (prompt + output schema + scoring rules); no platform changes.

**Sharing & Collaboration (PRD-J8)**
- **PRD-J8.1:** Share a meeting / clip with a teammate; recipient sees only what was shared (J8).
- **PRD-J8.2:** Tenant + share-scope isolation enforced (J8).
- **PRD-J8.3:** Every share is audit-logged (J8, §9 audit log).

**LMS Integration (PRD-J9)**
- **PRD-J9.1:** LTI 1.3 deep-linking launch from LMS (J9).
- **PRD-J9.2:** LTI 1.3 AGS gradebook passback (J9).

**Region Residency (PRD-J10)**
- **PRD-J10.1:** EU customer onboards with tenant `data_region` field enforced at storage and LLM-call layer (J10).
- **PRD-C2 (commitment §12):** Tenant data — transcripts, audio, embeddings, LLM calls — stays in tenant's pinned region; no cross-region movement at any layer.

**Retention & Compliance (PRD-J11, J13)**
- **PRD-J11.1:** Org admin configures retention policy per asset type (audio, transcripts) (J11).
- **PRD-J11.2:** Scheduled job enforces retention; every purge audit-logged (J11).
- **PRD-J13.1:** Self-service GDPR DSAR endpoint produces zip export ≤ 24 hr (J13).
- **PRD-J13.2:** Right-to-erasure honored within 30 d (§9 GDPR).

**Entitlements & Pricing (PRD-J12, E*)**
- **PRD-J12.1:** Module-based entitlement check at API layer (J12).
- **PRD-E1:** Entitlement axis `modules[]` (which of 8 verticals enabled).
- **PRD-E2:** Entitlement axis `max_seats`.
- **PRD-E3:** Entitlement axis `max_meetings_per_month` (Free-tier guard).
- **PRD-E4:** Entitlement axis `max_audio_hours_per_seat_per_month` (overage trigger on Pro).
- **PRD-E5:** Entitlement axes `retention_days_audio`, `retention_days_transcripts`.
- **PRD-E6:** Entitlement axis `regions[]`.
- **PRD-E7:** Entitlement axis `deployment_topology` (`saas` | `customer_cloud` | `on_prem`).
- **PRD-E8:** Entitlement axis `sso_types[]` (`email` | `google` | `microsoft` | `saml`).
- **PRD-E9:** Entitlement axis `mfa_enforced`.
- **PRD-E10:** Entitlement axis `baa_signed` (gates Medical / BH module).
- **PRD-E11:** Entitlement axis `custom_kms_key_id` (customer-managed encryption).
- **PRD-E12:** Four tiers (Free / Pro / Business / Enterprise) with axis combinations per §8 table.
- **PRD-E13:** Free trial — Pro 14-day no-CC; Business 14-day sales-assisted; Enterprise scoped pilot.
- **PRD-E14:** Bot integration add-on for Pro tier (~$10/seat/mo); included Business+.

**Audit & Consent (§9)**
- **PRD-A1:** Every view, share, export, delete logged in immutable append-only audit log (§9).
- **PRD-A2:** Recording UI displays disclosure pre-mic-activation (§9 consent).
- **PRD-A3:** Per-org configurable consent statement (§9).
- **PRD-A4:** Bot-joined meeting participants must acknowledge consent (§9).

**Integrations (§10) — full scope**
- **PRD-I1:** Calendar via Nylas.
- **PRD-I2:** Zoom (Zoom Meeting SDK or Marketplace bot).
- **PRD-I3:** Microsoft Teams (Graph + meeting bot).
- **PRD-I4:** LTI 1.3 (deep linking + AGS).
- **PRD-I5:** Email via SMTP / Postmark / SES — module-pluggable.
- **PRD-I6:** CRM (post-launch but architected for): HubSpot, Salesforce, Pipedrive — webhook-based.
- **PRD-I7:** Storage: AWS S3 default; Azure Blob + GCP GCS supported via abstraction (enables customer-owned cloud / on-prem).

**Provider Pluggability (§12 commitments)**
- **PRD-C3:** Pluggable LLM gateway: Anthropic default; OpenAI ZDR-only; Azure OpenAI no-training default; Ollama / local for offline tenants. **Customer audio + transcripts NEVER sent to model-training pipelines.** Per-tenant routing.
- **PRD-C4:** Pluggable transcription: OpenAI Whisper API + self-hosted faster-whisper. Per-tenant routing.
- **PRD-C5:** Pluggable storage (per PRD-I7 and §12).
- **PRD-C6:** One artifact, three deployments — SaaS, customer-owned cloud, on-prem all run from same Docker images.

**Deployment Topologies (§11) — T*)**
- **PRD-T1:** SaaS — managed multi-tenant on Railway + AWS (us-east-1, eu-west-1).
- **PRD-T2:** Customer-owned cloud — same containers in customer's AWS / Azure / GCP; Terraform module + onboarding script.
- **PRD-T3:** On-premise — Docker Compose / Helm chart; Postgres + Redis + S3-compatible (MinIO acceptable) + local Whisper + optional local LLM.

### Non-Functional Requirements Extracted

**Performance & SLA**
- **PRD-NFR1:** p95 transcription latency ≤ 6× real-time (§7, §9).
- **PRD-NFR2:** Summary p95 ≤ 60 s after transcript ready (§9 derived from J1).
- **PRD-NFR3:** Search p95 < 2 s on 100K-meeting corpus (§7, J5).
- **PRD-NFR4:** 99.5% pipeline success rate (§7).
- **PRD-NFR5:** 99.5% availability per region (§9).
- **PRD-NFR6:** 50 simultaneous transcription jobs without queue starvation; horizontally scalable workers (§9).

**Activation & Quality (success metrics §7)**
- **PRD-NFR7:** ≥ 70% of new accounts complete first upload/record within 7 days (§7).
- **PRD-NFR8:** ≥ 50% of activated accounts return in week 2 (§7).
- **PRD-NFR9:** ≥ 80% summary "useful?" thumbs-up across modules (§7).
- **PRD-NFR10:** RAG chat faithfulness ≥ 90% on internal eval set (§7).

**Cost (unit-economics guardrail §7)**
- **PRD-NFR11:** LLM + transcription cost < $0.40 per 30-min meeting.

**Multi-Tenancy & Region (§9)**
- **PRD-NFR12:** Multi-region (US + EU) from launch.
- **PRD-NFR13:** Tenant pinned to region; storage and LLM calls region-aware.
- **PRD-NFR14:** No cross-region data movement at any layer (§12-C2).

**Compliance (§9)**
- **PRD-NFR15:** GDPR — DPA template, DSAR endpoint, consent records, right-to-erasure honored within 30 d.
- **PRD-NFR16:** HIPAA — BAA available for Medical / Behavioral-Health tenants; region pin + provider-eligible chain (Anthropic via Bedrock or Azure OpenAI w/ HIPAA + AWS+BAA storage).
- **PRD-NFR17:** SOC 2 Type I targeted within 12 months of launch; Type II thereafter.
- **PRD-NFR18:** Audit log immutable, append-only, tenant-scoped (§9).

**Security (§9)**
- **PRD-NFR19:** TLS 1.3 in transit; AES-256 at rest.
- **PRD-NFR20:** Customer-managed keys (KMS) supported.
- **PRD-NFR21:** No-training constraint — **hard**. Provider chain documented; Anthropic API (no-training default), OpenAI only with ZDR, Azure OpenAI default. Local LLMs for fully-offline tenants (§9, §12-C3).

**Accessibility (§9)**
- **PRD-NFR22:** WCAG 2.1 AA target for web + admin console at launch.
- **PRD-NFR23:** Mobile WCAG 2.1 AA within 6 months of GA.
- *(Note: UX spec lock 2026-04-29 tightened this to WCAG 2.2 AA Day-1 + WCAG AAA touch targets; epics.md NFR28 reflects the tightening.)*

**Internationalization (§9)**
- **PRD-NFR24:** English + French at launch (i18next-driven).
- **PRD-NFR25:** Architecture supports adding locales without redeploy.

**Auth (§9)**
- **PRD-NFR26:** Email/password + Google SSO + Microsoft SSO at launch; SAML deferred to first enterprise customer (architecture has plugin slot).

**Storage Defaults (§9)**
- **PRD-NFR27:** Storage retention defaults — audio 90 d, transcripts indefinite (configurable per-org).

**Consent Procedures (§9)**
- **PRD-NFR28:** Recording UI displays consent disclosure pre-mic-activation; per-org configurable; participants must acknowledge for bot-joined meetings.

### Additional Requirements Extracted

**Non-goals / explicit exclusions (§2) — boundary constraints, not implementation requirements**
- **PRD-EX1:** Not a CRM replacement (Salesforce / HubSpot / Pipedrive remain systems of record).
- **PRD-EX2:** Not project / task management (Linear / Jira / Asana / Monday remain SOR).
- **PRD-EX3:** No in-meeting live captioning rendered to participant screens (post-meeting only at MVP). *(Note: UX spec / FR65 introduces live captions for deaf/HoH accessibility — this is a defensible adjustment from PRD via UX spec; flagged for Step 3.)*
- **PRD-EX4:** No real-time meeting coaching / interventions during meeting.
- **PRD-EX5:** No video / audio editing / production tools.
- **PRD-EX6:** No voice cloning / outbound voice synthesis.
- **PRD-EX7:** No calendar / meeting scheduling competition.
- **PRD-EX8:** No EHR replacement (Medical produces drafts; clinicians import to EHR).
- **PRD-EX9:** No e-discovery / legal-review tooling.
- **PRD-EX10:** No third-party module marketplace at MVP.
- **PRD-EX11:** No cross-tenant speaker biometric identification.
- **PRD-EX12:** No native iOS/Android apps separate from Expo (Mobile = Expo + PWA).

**External calendar gates (§13) — non-engineering, parallel-track**
- **PRD-G1:** Zoom Marketplace approval (~2–6 w).
- **PRD-G2:** Microsoft Teams app publish (~1–4 w).
- **PRD-G3:** Apple App Store review (days; rejection cycles possible).
- **PRD-G4:** GDPR DPAs with EU customers (legal cycle).
- **PRD-G5:** HIPAA BAA chains with Anthropic / AWS / Azure (paperwork, days–weeks).

**Personas (§5) — implementation scoping**
- **PRD-P1:** Recorder (most common path).
- **PRD-P2:** Recipient / Collaborator.
- **PRD-P3:** Org Admin.
- **PRD-P4:** Super Admin (AI Secretary internal staff).
- *(Vertical persona overlays are not separate auth roles — they flavor prioritization.)*

### PRD Completeness Assessment

**Strengths:**
- All 8 verticals named with concrete output expectations.
- All major user journeys (J0–J13) carry quantitative acceptance criteria.
- §9 NFRs are concrete (latency, availability, compliance certifications, encryption).
- §12 product commitments are explicit and testable (no-training, region residency, module-as-config, three-topology parity).
- §8 entitlement axes give a precise contract for `tenant_entitlements` schema.
- §13 calls out non-engineering external gates so they're not surprises.

**Gaps / ambiguities flagged for Step 3+ to resolve:**
1. **PRD-EX3 vs FR65** — PRD explicitly excludes live captioning to participants; UX spec (and epics.md FR65) introduces live captions for deaf/HoH accessibility. This is a defensible adjustment via the UX spec lock, but the PRD text itself was not updated. The PRD's own §14 says "when product and architecture diverge, architecture is the source of truth and this PRD must be updated to reflect the product implications" — same principle applies to UX-spec-driven changes. **Action:** flag as non-blocking; PRD §2 should be updated post-launch retrospective to note the UX-spec exception for accessibility.
2. **CRM scope nuance** — PRD-EX1 says "not a CRM replacement" and §10 says CRM is "post-launch but architected for" (HubSpot/Salesforce/Pipedrive webhook-based). Epics.md ships F5-CRM (FR73 deal-mapping multi-step flow) at MVP via Chrome extension overlay. This is consistent ("we don't replace, we hand off") but timing is sharper than PRD §10's "post-launch" phrasing. **Action:** treat as PRD §10 timing-clarification; not a contradiction.
3. **Real-time updates / streaming SLAs** — PRD §9 doesn't specify SSE / streaming UX. UX spec introduces ARIA streaming + receipt-frame-on-stop with stage-level timing. NFR-side ergonomic, not a PRD gap, but worth noting that the streaming-arrival pattern is UX-spec-introduced architecture-implications.
4. **PRD-NFR22/NFR23 vs UX spec accessibility tightening** — already noted; PRD says WCAG 2.1 AA, UX spec says WCAG 2.2 AA + AAA touch. UX spec wins per project rules; PRD text is a stale baseline.

**Total PRD-derived requirements:**
- FRs (functional): 71 (across journey, commitment, integration, vertical, deployment, audit, consent, entitlement axes)
- NFRs (non-functional): 28
- Exclusions / non-goals: 12
- External gates: 5
- Personas: 4

---

## Step 3 — Epic Coverage Validation

### Coverage Matrix — PRD-derived FRs → epics.md FR# → Epic

| PRD-ID | PRD requirement (short) | epics.md FR# | Epic | Status |
|---|---|---|---|---|
| **Onboarding & Activation (J0)** | | | | |
| PRD-J0.1 | Signup ≤ 60s | FR1 | Epic 1 (Story 1.5) | ✓ Covered |
| PRD-J0.2 | First user invites others | FR4 | Epic 1 (Story 1.5) | ✓ Covered |
| PRD-J0.3 | First meeting recorded → activation | FR5, FR6, FR8 | Epic 1 (Story 1.7) + Epic 2 + Epic 4 | ✓ Covered |
| PRD-J0.4 | 70% activation in 7d (success metric) | NFR8 | cross-cutting telemetry | ✓ Covered |
| **Recording & Capture (J1, J2)** | | | | |
| PRD-J1.1 | Mobile + web record start/stop | FR6, FR7 | Epic 4 (Story 4.2) | ✓ Covered |
| PRD-J1.2 | ≤ 3 min pipeline for ≤ 30 min audio | FR20, FR79 | Epic 2 + Epic 6 (clinical branch) | ✓ Covered |
| PRD-J1.3 | p95 transcription ≤ 6× real-time | NFR1 | Epic 2 | ✓ Covered |
| PRD-J1.4 | Summary p95 ≤ 60s post-transcript | NFR2, FR21 | Epic 3 (Story 3.2) | ✓ Covered |
| PRD-J2.1 | Drag-drop ≤ 4hr / 2GB chunked + resumable | FR8, FR68 | Epic 2 (Story 2.2) + Epic 4 (Story 4.5) | ✓ Covered |
| **Bot Capture (J3)** | | | | |
| PRD-J3.1 | Zoom OAuth, bot ≤ 30s | FR12 | Epic 9 (Stories 9.1, 9.3) | ✓ Covered |
| PRD-J3.2 | Teams OAuth, bot | FR13 | Epic 9 (Stories 9.2, 9.3) | ✓ Covered |
| PRD-J3.3 | Live capture during meeting | FR12, FR13, FR14 | Epic 9 (Story 9.4) | ✓ Covered |
| PRD-J3.4 | Post-meeting upload fallback | FR15 | Epic 9 (Story 9.6) | ✓ Covered |
| **Calendar (J4)** | | | | |
| PRD-J4.1 | Nylas calendar connect | FR16 | Epic 10 (Story 10.1) | ✓ Covered |
| PRD-J4.2 | Sync lag ≤ 5 min | FR16 SLA | Epic 10 (Story 10.2) | ✓ Covered |
| PRD-J4.3 | Per-meeting auto-record toggle | FR17 | Epic 10 (Story 10.3) | ✓ Covered |
| **Search & Chat (J5, J7)** | | | | |
| PRD-J5.1 | FT + semantic ranked search | FR28 | Epic 7 (Stories 7.2, 7.3) | ✓ Covered |
| PRD-J5.2 | Search p95 < 2s on 100K corpus | NFR3 | Epic 7 (Story 7.2) | ✓ Covered |
| PRD-J5.3 | Deep-link to transcript anchor | FR28, FR78 | Epic 7 + Epic 3 | ✓ Covered |
| PRD-J7.1 | RAG grounded with citations | FR29 | Epic 7 (Story 7.4) | ✓ Covered |
| PRD-J7.2 | Refuses ungrounded claims | FR30 | Epic 7 (Story 7.4) | ✓ Covered |
| PRD-J7.3 | Faithfulness ≥ 90% | NFR10 | Epic 7 (Story 7.4) | ✓ Covered |
| **Vertical Analysis (J6 + V1–V8)** | | | | |
| PRD-J6.1 | Analysis ≤ 90s, schema-validated, cites spans | FR24, FR26, FR27, FR78 | Epic 3 framework + Epic 5/6 modules | ✓ Covered |
| PRD-V1 | General module | FR25 | Epic 3 (Story 3.1) | ✓ Covered |
| PRD-V2 | Sales module | FR25 | Epic 5 (Story 5.1) | ✓ Covered |
| PRD-V3 | HR/Hiring module | FR25 | Epic 5 (Story 5.2) | ✓ Covered |
| PRD-V4 | Education module | FR25 | Epic 5 (Story 5.3) | ✓ Covered |
| PRD-V5 | Medical/BH module (BAA-gated) | FR25 | Epic 6 (Story 6.2, double-gated) | ✓ Covered |
| PRD-V6 | Customer Support module | FR25 | Epic 5 (Story 5.4) | ✓ Covered |
| PRD-V7 | Project Management module | FR25 | Epic 5 (Story 5.5) | ✓ Covered |
| PRD-V8 | Psychology module (BAA-gated) | FR25 | Epic 6 (Story 6.3, double-gated) | ✓ Covered |
| PRD-C1 | Module = config, no platform deploy | FR26 | Epic 3 (Story 3.1 framework) | ✓ Covered |
| **Sharing (J8)** | | | | |
| PRD-J8.1 | Share with teammate, scope-limited | FR31, FR32, FR33 | Epic 8 (Stories 8.1, 8.2, 8.3) | ✓ Covered |
| PRD-J8.2 | Tenant + share-scope isolation | FR33 | Epic 8 (Story 8.1) | ✓ Covered |
| PRD-J8.3 | Audit-logged shares | FR33, FR54 | Epic 8 + Epic 1 | ✓ Covered |
| **LMS (J9)** | | | | |
| PRD-J9.1 | LTI 1.3 deep-link launch | FR35 | Epic 15 (Story 15.1) | ✓ Covered |
| PRD-J9.2 | LTI 1.3 AGS gradebook passback | FR36 | Epic 15 (Story 15.2) | ✓ Covered |
| **Region Residency (J10, C2)** | | | | |
| PRD-J10.1 | EU customer, region pinned | FR47, NFR12, NFR13 | Epic 12 (Story 12.1) + Epic 14 (Story 14.8) | ✓ Covered |
| PRD-C2 | No cross-region data movement | NFR13 | cross-cutting; enforced at storage + LLM-call | ✓ Covered |
| **Retention & DSAR (J11, J13)** | | | | |
| PRD-J11.1 | Retention policy config | FR43 | Epic 12 (Story 12.3) | ✓ Covered |
| PRD-J11.2 | Scheduled purge audit-logged | FR43 | Epic 12 (Story 12.3) | ✓ Covered |
| PRD-J13.1 | DSAR self-serve zip ≤ 24h | FR50 | Epic 14 (Story 14.1) | ✓ Covered |
| PRD-J13.2 | Right-to-erasure ≤ 30d | FR51 | Epic 14 (Story 14.2) | ✓ Covered |
| **Entitlements (J12, E*)** | | | | |
| PRD-J12.1 | Module entitlement check at API | FR38 | Epic 13 (Story 13.2) | ✓ Covered |
| PRD-E1–E11 | All 11 entitlement axes | FR40 | Epic 13 (Story 13.4) | ✓ Covered |
| PRD-E12 | Four tiers (Free/Pro/Business/Enterprise) | FR40 | Epic 13 (Story 13.4) | ✓ Covered |
| **PRD-E13** | **Trial policy (Pro 14d / Business 14d / Ent pilot)** | **(none — implicit only)** | **—** | **❌ GAP** |
| PRD-E14 | Bot integration add-on for Pro | FR40 (tier config) | Epic 13 | ✓ Covered (config-level) |
| **Audit & Consent (A*)** | | | | |
| PRD-A1 | Every state-change audit-logged immutable | FR54, NFR21 | Epic 1 + Epic 14 export | ✓ Covered |
| PRD-A2 | Pre-mic disclosure | FR9 | Epic 4 (Story 4.3) | ✓ Covered |
| PRD-A3 | Per-org configurable consent statement | FR45 | Epic 12 (Story 12.4) | ✓ Covered |
| PRD-A4 | Bot-meeting consent acknowledgment | FR14 | Epic 9 (Story 9.4) | ✓ Covered |
| **Integrations (I*)** | | | | |
| PRD-I1 | Calendar (Nylas) | FR16, FR17 | Epic 10 | ✓ Covered |
| PRD-I2 | Zoom (SDK or Marketplace bot) | FR12 | Epic 9 | ✓ Covered |
| PRD-I3 | Microsoft Teams (Graph + bot) | FR13 | Epic 9 | ✓ Covered |
| PRD-I4 | LTI 1.3 (deep + AGS) | FR35, FR36 | Epic 15 | ✓ Covered |
| **PRD-I5** | **Email (SMTP/Postmark/SES — module-pluggable)** | **(implicit only — no explicit FR for pluggable provider)** | **Epic 1 (Story 1.7) + Epic 14 (Story 14.1) consume; no FR captures the abstraction** | **❌ GAP** |
| PRD-I6 | CRM (HubSpot/Salesforce/Pipedrive) | FR56, FR73 | Epic 15 (Stories 15.3, 15.4) | ✓ Covered (sharper than PRD's "post-launch") |
| PRD-I7 | Storage (S3/Azure Blob/GCS/MinIO) | A6, NFR31 (impl in `packages/storage`) | Epic 2 foundation (Story 2.1) | ✓ Covered |
| **Provider commitments (C*)** | | | | |
| PRD-C3 | Multi-LLM, no-training | NFR20, NFR17, NFR18 | Epic 14 (Story 14.7 HIPAA chain) + foundation | ✓ Covered |
| PRD-C4 | Pluggable transcription | FR18 | Epic 2 (Story 2.3) | ✓ Covered |
| PRD-C5 | Pluggable storage | (see PRD-I7) | Epic 2 (Story 2.1) | ✓ Covered |
| PRD-C6 | One artifact, three deployments | NFR31, A8 | cross-cutting; arch-level | ✓ Covered |
| **Deployment topologies (T*)** | | | | |
| PRD-T1 | SaaS managed multi-tenant | NFR31, A7 | cross-cutting (Railway) | ✓ Covered |
| PRD-T2 | Customer-owned cloud | NFR31, A8 | cross-cutting (arch supports; not Day-1 epic) | ✓ Covered (per PRD §11 "SaaS launches first") |
| PRD-T3 | On-premise (Docker / Helm) | NFR31, A8 | cross-cutting (arch supports; not Day-1 epic) | ✓ Covered (per PRD §11 "SaaS launches first") |

### NFR Coverage Matrix

| PRD-ID | PRD NFR | epics.md NFR# | Status |
|---|---|---|---|
| PRD-NFR1 | p95 transcription ≤ 6× real-time | NFR1 | ✓ Covered |
| PRD-NFR2 | Summary p95 ≤ 60s | NFR2 | ✓ Covered |
| PRD-NFR3 | Search p95 < 2s on 100K | NFR3 | ✓ Covered |
| PRD-NFR4 | Pipeline 99.5% success | NFR4 | ✓ Covered |
| PRD-NFR5 | Availability 99.5% per region | NFR5 | ✓ Covered |
| PRD-NFR6 | 50 simultaneous transcription jobs | NFR6 | ✓ Covered |
| PRD-NFR7 | Activation ≥ 70% in 7d | NFR8 | ✓ Covered |
| PRD-NFR8 | Week-2 return ≥ 50% | NFR8 (combined) | ✓ Covered |
| PRD-NFR9 | Summary thumbs-up ≥ 80% | NFR9 | ✓ Covered |
| PRD-NFR10 | RAG faithfulness ≥ 90% | NFR10 | ✓ Covered |
| PRD-NFR11 | LLM cost < $0.40 / 30-min | NFR11 | ✓ Covered |
| PRD-NFR12 | Multi-region (US+EU) at launch | NFR12 | ✓ Covered |
| PRD-NFR13 | Tenant region pin enforced | NFR13 | ✓ Covered |
| PRD-NFR14 | No cross-region movement | NFR13 (implicit) | ✓ Covered |
| PRD-NFR15 | GDPR (DPA/DSAR/RTBF 30d) | NFR16 | ✓ Covered |
| PRD-NFR16 | HIPAA (BAA + provider chain) | NFR17 | ✓ Covered |
| PRD-NFR17 | SOC 2 Type I within 12mo | NFR19 | ✓ Covered |
| PRD-NFR18 | Audit log immutable append-only | NFR21 | ✓ Covered |
| PRD-NFR19 | TLS 1.3 + AES-256 | NFR22 | ✓ Covered |
| PRD-NFR20 | Customer-managed KMS | NFR22 (Gap K1) | ✓ Covered |
| PRD-NFR21 | No-training (hard) | NFR20 | ✓ Covered |
| PRD-NFR22 | WCAG 2.1 AA web at launch | NFR28 | ✓ **Tightened** to WCAG 2.2 AA + AAA touch (UX spec lock) |
| PRD-NFR23 | Mobile WCAG 2.1 AA within 6mo | NFR28 | ✓ **Tightened** — WCAG 2.2 AA Day-1 across all surfaces |
| PRD-NFR24 | EN + FR at launch | NFR30, FR66 | ✓ Covered |
| PRD-NFR25 | Locale add without redeploy | NFR30, FR66 | ✓ Covered |
| PRD-NFR26 | Email/pwd + Google/MS SSO; SAML deferred | FR2, FR3 + Epic 11 | ✓ Covered |
| PRD-NFR27 | Storage retention defaults (audio 90d, transcripts indefinite) | FR43 + Story 12.3 | ✓ Covered |
| PRD-NFR28 | Recording disclosure pre-mic + per-org + bot-ack | FR9, FR45, FR14 | ✓ Covered |

### Missing Requirements

**Critical Missing FRs:** none.

**High-priority gaps (2):**

#### Gap-EC1 — PRD-I5 Email infrastructure has no explicit FR

**PRD requirement:** §10 lists Email (SMTP / Postmark / SES) as "module-pluggable." Implies an abstraction (similar to LLM gateway / storage / transcription) selecting per-tenant or per-environment.

**Current epics coverage:** Email is *consumed* in two stories — Story 1.7 (re-engagement emails at 24h + 72h) and Story 14.1 (DSAR zip presigned-link delivery) — but no FR captures email infrastructure as a *pluggable provider abstraction* with per-tenant routing. There's no `packages/email` mentioned in the architecture or addendums; Agent B introduced `packages/notifications` (§5) for push/email but didn't fully lock the email-provider-abstraction contract that PRD §10 implies.

**Impact:**
- PRD §10 promises "module-pluggable" for email; without an FR + arch-package contract, dev work in Story 1.7 / Story 14.1 will likely default to a single hardcoded provider, undoing the abstraction promise.
- Compliance posture (Postmark vs. SES vs. self-hosted SMTP for on-prem topology PRD-T3) needs per-tenant routing.
- Customer-owned cloud (PRD-T2) and on-prem (PRD-T3) deployments must be able to swap email providers without code changes (parity with §12 commitments PRD-C4 / PRD-C5).

**Recommendation:**
- Add **FR80 — Pluggable email provider** to `epics.md`: "System supports SMTP / Postmark / SES via `packages/email` (or extend `packages/notifications` per Agent B addendum §5) with provider-agnostic interface; per-tenant routing via `tenant_entitlements` or `tenant_settings`. Same import-discipline CI rule as `packages/llm-gateway`."
- Map FR80 → Epic 1 (foundation) + consumed by Epic 14 + Epic 1 Story 1.7.
- Spec the abstraction in a follow-on §9 of `arch-addendums.md` OR fold into Agent B §5 (heartbeat + notifications package) explicitly listing email as a sub-domain alongside push.

#### Gap-EC2 — PRD-E13 Trial policy mechanism has no explicit FR

**PRD requirement:** §8 trial policy — Pro 14-day no-CC; Business 14-day sales-assisted; Enterprise scoped pilot.

**Current epics coverage:** Epic 13 covers Stripe webhook → `tenant_entitlements` (FR37), entitlement-check (FR38), seat ceilings (FR39), four-tier configuration (FR40), and locked-module upsell (FR64). **No FR captures trial state, trial-end notifications, sales-assisted-trial handoff for Business tier, or scoped-pilot tracking for Enterprise.**

**Impact:**
- Stripe natively supports `trial_period_days`, but the in-app *trial-state UI*, *trial-ending reminder emails*, *trial → paid conversion vs. churn paths*, and *Business sales-assisted handoff* are product behaviors not in epics.
- Pro's "no credit card required" creates a different conversion funnel than typical card-on-file trials — trial-end UX needs a soft conversion gate (per UX spec patterns; not yet specced).
- Enterprise scoped-pilot is contract-led; needs an admin-flagged tenant state.

**Recommendation:**
- Add **FR81 — Trial policy mechanism** to `epics.md`: "System tracks tenant trial state (`tenants.trial_state` field or extend `tenant_state` enum from ADR-0004 with `trialing` value); trial-end at 14 days for Pro/Business with conversion CTA + sales-assisted handoff for Business; Enterprise scoped-pilot tracked as `pilot` tenant_state with custom expiration. Trial-end emails fire at 3-day + 1-day-before. Stripe `trial_period_days` is the source of truth for date math."
- Map FR81 → Epic 13 (entitlement / billing) + Epic 12 (admin sees trial status).
- Schema impact: extend ADR-0004's `tenant_state` enum (add `trialing`, `pilot`, `trial_expired`) — ~1 hour edit to `arch-addendums.md` §4.

### Coverage Statistics

- **Total PRD-derived FRs:** 71 (functional)
- **FRs covered in epics:** 69
- **Coverage percentage (functional):** **97%**
- **Total PRD-derived NFRs:** 28
- **NFRs covered in epics:** 28 (with NFR22/23 *tightened*, not relaxed)
- **Coverage percentage (non-functional):** **100%**
- **Critical missing FRs:** 0
- **High-priority gaps:** 2 (Gap-EC1 email infrastructure; Gap-EC2 trial policy)
- **PRD-text drift items (cosmetic — flagged in Step 2):** 1 (PRD-EX3 vs FR65 live-captions exception for accessibility)

### Coverage-Validation Verdict

**PASS WITH 2 MINOR GAPS.** Both gaps are infrastructure / billing-mechanism additions that fit cleanly into existing epics (Epic 1 foundation + Epic 13 billing) and don't require structural rework. Both are **fixable in <1 hour total** and should be closed before sprint planning starts on Phase 0 — Phase 0 itself doesn't depend on either, so Phase 0 launch is not blocked, but **Phase 1's Epic 13 sprint will stall on FR81 if the trial state isn't speced**, and **Story 1.7's re-engagement emails will hit the email-abstraction question on day one of implementation if FR80 isn't added.**

---

## Step 4 — UX Alignment

### UX Document Status

**Found.** `_bmad-output/planning-artifacts/ux-design-specification.md` (154,654 bytes; 3,340 lines). Locked 2026-04-29 from 14-step `create-ux-design` BMAD workflow. Source-of-truth for UX/accessibility per project CLAUDE.md ("UX spec is the source of truth for UX/accessibility — defer to its locked values where they tighten or replace PRD §9").

### UX ↔ PRD Alignment

#### What aligns cleanly (no issues)

- **All 8 verticals (V1–V8)** rendered through UX components (`AnalysisCard` shared contract; per-vertical density + copy-register variants).
- **All 13 user journeys (J0–J13)** have corresponding UI surfaces in UX spec. F1 (capture-to-receipt) maps to J1; F2 (first-launch) maps to J0; F3 (bot consent) maps to J3; F4 (search/RAG) maps to J5/J7; F5 (sharing/CRM) maps to J8.
- **All 4 personas (P1–P4)** plus vertical overlays explicitly addressed in UX spec persona-driven flows.
- **Multi-region + region pin** surfaced in F2-admin step (matches PRD-J10).
- **Backend pluggability (LLM / transcription / storage)** is correctly *invisible* in routine flows per UX U6 ("Privacy posture invisible in routine flows; visible/exportable in admin only").

#### UX additions not literally in PRD (defensible per BMAD architecture-source-of-truth rule)

UX spec introduces 11 patterns not specified in the PRD. Each is a defensible UX-side refinement, with the relationship to PRD captured below:

| UX-introduced pattern | Relationship to PRD | Verdict |
|---|---|---|
| F2-admin as structurally distinct flow from F2 (FR72) | PRD-P3 names "Org Admin" persona but doesn't differentiate F2 vs F2-admin onboarding | ✓ Refinement; PRD-text update post-launch retrospective |
| Re-engagement emails at 24h + 72h (FR70) | PRD doesn't mention re-engagement | ✓ Activation enhancement; doesn't conflict with PRD |
| F5-CRM multi-step deal-mapping at MVP (FR73) | PRD §10 says CRM "post-launch but architected for" | ⚠ Timing-sharpening: epics.md ships at MVP. Already noted in Step 2 PRD assessment. Acceptable as PRD timing-clarification, not contradiction. |
| Three-shell layout (D1/D3/D4 — FR77) | PRD doesn't go to layout depth | ✓ UX-locked specific |
| V2 component lock (RecordingStatusPill, CitationChip — FR11, FR78) | PRD doesn't go to component depth | ✓ UX-locked specific |
| Anchor word "receipt" (provisional, U34) | PRD doesn't constrain copy | ✓ Pre-launch card-sort gate planned (open-work bundle) |
| Telemetry ownership matrix (FR71) | PRD §7 lists metrics but not ownership | ✓ Process discipline added by UX spec |
| Real-time heartbeat detection (FR67) | PRD-J2 covers resumable uploads but not capture-side liveness | ✓ Reliability enhancement |
| 10-min upload retry budget (FR68) | PRD-J2 says "resumable" with no SLA | ✓ Implementation detail |
| Region-aware EU explicit-consent branch (FR69) | PRD-A4 says "participants must acknowledge" — silent on per-region branch | ✓ GDPR-driven UX refinement; closed by ADR-0005 |
| Cross-org sharing scope rules (FR74) | PRD-J8.2 says "tenant + share-scope isolation" — silent on cross-tenant inbound visibility | ✓ Refinement; closed by §8 + ADR-0006 |
| Per-vertical timing differentiation (FR79) | PRD-J1.2 says "≤3min for ≤30min audio" globally | ✓ Clinical-specific relaxation; spare cycles fund quality |
| Citation-native click-to-seek + 5s pre-roll (FR78) | PRD-J5.3 says "deep-link to anchor"; PRD-J6.1 says "cites transcript spans" | ✓ Sharpens behavior; matches intent |
| Live captions for deaf/HoH accessibility (FR65) | PRD-EX3 explicitly excludes live captioning to participants | ⚠ **Contradiction:** UX spec relaxes PRD-EX3 for accessibility. Already flagged in Step 2 (gap #1). Defensible per accessibility imperative; PRD-EX3 text needs post-launch retrospective update. |

#### UX-tightening of PRD NFRs (PRD baseline → UX-tightened)

| Concern | PRD baseline | UX-tightened | Verdict |
|---|---|---|---|
| Accessibility | WCAG 2.1 AA (web Day-1; mobile within 6mo) | WCAG 2.2 AA Day-1 across all surfaces + WCAG AAA touch targets (44×44 dense+relaxed; 48px accessible) | ✓ Tightening, not relaxing — UX spec wins |

### UX ↔ Architecture Alignment

The UX spec lock (2026-04-29) **post-dated** the architecture lock (2026-04-29 — same day, but architecture committed first). The reconciliation pass identified 7 architectural patterns introduced by UX that needed addendum spec'ing:

| UX-introduced pattern | Arch addendum coverage | Status |
|---|---|---|
| Style Dictionary token build pipeline + WCAG contrast CI gate | `arch-addendums.md` §1 + ADR-0002 | ✓ Closed |
| ARIA streaming infrastructure (live regions for receipt / RAG / capture-at-risk) | `arch-addendums.md` §2 (no ADR — pure frontend convention) | ✓ Closed |
| F5-CRM deal-mapping mechanics (Chrome ext + server-side gateway) | `arch-addendums.md` §3 + ADR-0003 | ✓ Closed |
| F2-admin flow + DPA gate + tenant lifecycle FSM | `arch-addendums.md` §4 + ADR-0004 | ✓ Closed |
| Real-time heartbeat detection (capture-at-risk + bot liveness) | `arch-addendums.md` §5 (no ADR — protocol fits existing surfaces) | ✓ Closed |
| 10-min resumable upload retry budget | `arch-addendums.md` §6 (no addendum — fits existing presigned-multipart story; algorithm only) | ✓ Closed |
| Region-aware EU explicit-consent branch (per-participant override) | `arch-addendums.md` §7 + ADR-0005 | ✓ Closed |
| Cross-tenant audit-log writes (cross-org sharing inbound) | `arch-addendums.md` §8 + ADR-0006 (added during reconciliation) | ✓ Closed |

**5 ADRs PROPOSED in `arch-addendums.md`:** ADR-0002 through ADR-0006. Promotion to `docs/decisions/000N-…` happens after first-implementation validates each pattern.

**3 P0 gaps identified by reconciliation pass — all closed:**
- G1 (cross-tenant audit-log writes) — closed via §8 + ADR-0006
- G2 (Story 9.5 EU per-participant override) — closed via direct AC edit in `epics.md`
- G3 (Story 12.1 `tenant_state` FSM consumption) — closed via direct AC edit in `epics.md`

**5 P1 items (N1–N5) deferred** to per-sprint story sharpening (the `create-story` workflow consumes `reconciliation-note.md` as input). N1–N5 cover naming-drift items: `recording-watchdog` job name, `packages/notifications` reference, `packages/consent` reference, full CRM audit-action enumeration, and **N5 — speaker-turn-level addressable spans schema**.

### Performance Alignment Check

| UX requirement | Architecture support | Status |
|---|---|---|
| Receipt frame ≤500ms after stop on F1 | SSE one-way push (architecture § API & Communication Patterns) + `ReceiptStreamLayout` skeleton (Story 2.5) | ✓ Supported |
| Honest expected-arrival-time indicator (updates when slow) | Backend job-state timeline + SSE updates | ✓ Supported |
| ARIA polite/assertive live regions per stage | `useStreamingAria` / `useCaptureAlert` hooks (§2) | ✓ Supported |
| Click-to-seek with 5s pre-roll at speaker-turn level | Pyannote diarization (Gap D1) + transcript schema with addressable speaker turns | ⚠ **Schema not pinned** — N5 deferred item |
| <2s search p95 on 100K corpus | pgvector HNSW per-dimension tables (§ A13, Gap S1) | ✓ Supported |
| Streaming RAG chat with citation chip arrival inline | LLM-gateway streaming + `useStreamingAria('chat')` + citation-extraction stream | ✓ Supported |

### UX-Implied Components — Architecture Support Status

| UX component (UX spec / FR ref) | Architecture provision | Status |
|---|---|---|
| `RecordingStatusPill` V2 inline-waveform (FR11, U1) | Heartbeat protocol §5 + reduced-motion tokens (ADR-0002) | ✓ |
| `AnalysisCard` shared contract (FR27, U2) | Module-schema contract `packages/shared/src/module-schema.ts` (A4) | ✓ |
| `CitationChip` V2 + `TranscriptSeekPlayer` (FR78, U21) | Pyannote diarization (Gap D1) + speaker-turn addressable schema | ⚠ **N5 — schema needs pinning at Story 2.4 sprint planning** |
| `ReceiptStreamLayout` (Story 2.5) | SSE + ARIA hooks (§2) | ✓ |
| `AppShell.Inbox` / `Cards` / `Search` (FR77, U25) | Frontend layering on shadcn — no arch deviation | ✓ |
| `AuditLogTable` (FR49) | `audit_logs` table + DataTable | ✓ |
| `DsarQueueItem` (FR53) | Erasure-cascade map registry (Story 1.4) | ✓ |
| `EmptyStateRecipient` (FR5) | Sample library data only | ✓ |
| `ManagerCoachingCard` (FR34) | Span-anchored annotation — needs same speaker-turn schema as CitationChip | ⚠ **Same N5 schema dependency** |
| `ShareRecipientView` (FR32) | Auth-free token-URL view; RLS scoped | ✓ |
| `VoiceInputSurface` (FR62) | Mobile speech-to-text via Expo (`expo-speech`); package boundary unclear | ⚠ **Minor** — sprint-planning detail (which package owns the abstraction) |
| `RelationshipBrowser` (FR28) | Built on shadcn Command + custom IA | ✓ |
| `SearchHomeShell` (FR77/D4) | Activates via setting + meeting-count threshold | ✓ |
| `ConsentDisclosureCard` 3 variants (FR55, U28) | Plain HTML/CSS — no arch deviation | ✓ |
| `ModuleConfirmModal` (Story 6.4, U28) | Plain modal — no arch deviation | ✓ |

### Alignment Issues

**Critical:** none.

**High-priority (1):**

#### Gap-UX1 — Speaker-turn-level addressable span schema not pinned anywhere

**UX requirement:** FR78 (CitationChip click-to-seek + 5s pre-roll at speaker-turn level) and FR34 (ManagerCoachingCard span-anchored annotation) both require an addressable transcript-span scheme. UX spec implies it; locked. Reconciliation note flagged it as N5.

**Current state:**
- PRD-J5.3 says "deep-link to transcript anchor" (no schema)
- PRD-J6.1 says "cites transcript spans" (no schema)
- Architecture `docs/architecture.md` mentions Pyannote diarization (Gap D1) but doesn't define a span addressing scheme
- `arch-addendums.md` does not address it (Agent B did not address — implicit gap)
- `epics.md` Story 2.4 AC says *"Transcript persistence schema includes speaker turns; turns are queryable + addressable"* — prose only
- The CitationChip click-to-seek depends on this scheme being deterministic across re-transcription / re-diarization

**Recommendation:** Sprint-planning at Story 2.4 must pin a concrete schema. Likely shape:
```ts
type SpeakerTurn = {
  id: string;                         // stable hash of (meetingId, speakerId, spanStartMs)
  meetingId: string;
  speakerId: string;                  // 'spk_2' from Pyannote (or external_user_id when bot has matched it)
  spanStartMs: number;
  spanEndMs: number;
  text: string;
};
```
With a stability commitment: turn IDs survive re-diarization unless the underlying audio bytes change.

This is **not Phase 0 blocking** — Phase 0 is Storybook + token pipeline + RecordingStatusPill V2 + AnalysisCard contract. None of those depend on speaker-turn addressing. **It IS Phase 1 blocking for Epic 2 Story 2.4 + Epic 3 Story 3.5 + Epic 8 Story 8.6.**

**Owner of fix:** sprint-planning at Epic 2 Story 2.4 (per the reconciliation note's deferral plan). Adding a 2-3 line spec to Story 2.4 AC would close it now if you prefer pre-emptive closure.

**Medium-priority (1):**

#### Gap-UX2 — `VoiceInputSurface` package boundary unclear

**UX requirement:** FR62 (`VoiceInputSurface` first-class mobile dictation); used in `LiveNoteEditor` and SOAP-note editing per Story 5.7.

**Current state:**
- Architecture lists `apps/mobile` (Expo SDK 52+) but doesn't name a `packages/voice` or similar abstraction
- Implementation likely uses `expo-speech` + native iOS/Android speech-to-text APIs
- No package-discipline rule like `packages/llm-gateway` for voice input

**Recommendation:** Sprint-planning detail at Story 5.7 — decide whether to:
- (a) Inline `expo-speech` calls in `apps/mobile/src/components/voice-input/...` (acceptable if voice is mobile-only forever)
- (b) Create `packages/voice` abstraction if web-side voice (browser SpeechRecognition API) becomes a roadmap item

Acceptable to defer; not Phase 0 blocking; not Phase 1 blocking unless mobile dictation lands ahead of expectations.

### Warnings

- **PRD-EX3 vs FR65 contradiction** (already flagged Step 2 + Step 3): live captioning excluded by PRD §2; reintroduced by UX spec for deaf/HoH accessibility. PRD text update is non-blocking but worth doing for canon coherence.
- **Architecture doc + addendums doc are two files** — engineers reading `architecture.md` alone will miss 8 patterns. Recommend adding a one-liner to `architecture.md` at top: "See `_bmad-output/planning-artifacts/arch-addendums.md` for 8 UX-driven patterns added 2026-04-29; ADRs 0002–0006 PROPOSED awaiting promotion." (Non-blocking; documentation hygiene.)

### UX Alignment Verdict

**PASS.** UX spec aligns with PRD (with one defensible relaxation of PRD-EX3 for accessibility) and with architecture (with all 8 UX-introduced patterns covered by `arch-addendums.md`). One real schema gap (Gap-UX1 — speaker-turn addressing) and one minor gap (Gap-UX2 — VoiceInputSurface package boundary) — both have known sprint-planning resolutions and are **not Phase 0 blocking**.

---

## Step 5 — Epic Quality Review

### Epic-by-Epic User-Value Validation

| Epic | User-value statement | User-value verdict |
|---|---|---|
| 1 | "I can sign up in 60s, log in, MFA, invite teammates, see an inviting empty-state workspace" | ✓ Clear user outcome (mixed with foundation slices, but epic-level value clear) |
| 2 | "I can drag-drop a 4hr/2GB file and read the diarized transcript on the meeting page within ~3min" | ✓ Clear |
| 3 | "Meeting page shows summary + actions + General-module analysis through AnalysisCard with click-to-seek citations" | ✓ Clear |
| 4 | "I can one-tap record from phone/PWA/desktop with consent + heartbeat + 10-min retry budget" | ✓ Clear |
| 5 | "I can run Sales/HR/Edu/Support/PM analysis on a meeting through AnalysisCard with vertical-specific copy" | ✓ Clear |
| 6 | "Therapists run Medical/BH and Psychology with detangled ModuleConfirmModal + ConsentDisclosureCard" | ✓ Clear |
| 7 | "Search corpus <2s + RAG chat with citations + power-user search-first shell" | ✓ Clear |
| 8 | "Share with teammate / clip / public token URL + My Actions roll-up + team-lead space + cross-org scope" | ✓ Clear |
| 9 | "Org admin connects Zoom/Teams; bot joins ≤30s + region-aware consent + bot heartbeat" | ✓ Clear |
| 10 | "Connect calendar via Nylas; upcoming meetings within 5min; per-meeting auto-record toggle" | ✓ Clear |
| 11 | "Org admin manages seats, roles, SSO types, MFA enforcement" | ✓ Clear |
| 12 | "Org admin walks through F2-admin first-launch (DPA → region → retention → disclosure → modules → integrations → SSO → invites) + ongoing config + audit + cross-org policy" | ✓ Clear |
| 13 | "Stripe drives entitlements; seat ceilings tracked; locked-module upsell visible" | ✓ Clear |
| 14 | "Org admin processes DSARs with cascade preview; public portal for non-customers; HIPAA routing releases Medical/BH; EU stack deployed" | ✓ Clear |
| 15 | "LMS launch via LTI 1.3 + receipts in Slack/Teams + F5-CRM deal-mapping multi-step + Chrome ext + push notifications" | ✓ Clear |

**Verdict:** No epic is a pure technical milestone. Epic 1 includes foundation slices (workspace skeleton, tenant-context plugin) but the epic-level outcome is user-facing (signup → workspace). Acceptable per BMAD pattern.

### Epic Independence Validation

Tested each epic's ability to function with only Epics 1..N-1 outputs, **with no forward dependencies on Epic N+1 or later**.

#### 🔴 Critical violations

**EQ-1 — Epic 4 + Epic 9 forward-depend on Epic 15 for push notifications (FR60)**

- **Epic 4 Story 4.4 AC:** *"Server detects lost ping >90s → fires push within 60s. Push copy: 'Recording may have stopped on phone — open AI Secretary to verify'."*
- **Epic 4 Story 4.5 AC:** *"At budget exhaustion: push + email + banner with options."*
- **Epic 9 Story 9.6 AC:** *"Lost ping → push + email + banner within 60s."*
- **Epic 15 Story 15.6 AC:** *"Expo Push integration; `notifications` table. Per-event types: `analysis.completed`, `capture.at-risk`, `upload.retry-exhausted`, `bot.failed-to-join`. User notification preferences honored."*

**Problem:** Push notification infrastructure (Expo Push integration, `notifications` table, dispatch service) is owned by Epic 15. Epic 4 and Epic 9 ship before Epic 15 (epics are numerically ordered, and capture/bot work logically lands before LMS+CRM+Slack/Teams hub). At the moment Epic 4 ships, push isn't available — Story 4.4's AC cannot be satisfied.

**FR Coverage Map confirms this:** FR60 (push notifications) is mapped to Epic 15 only. FR67 (heartbeat) maps to Epic 4 + Epic 9 with note "push within 60 s." But push *delivery* lives in Epic 15.

**Recommendation:** Move push-notification infrastructure (Expo Push integration + `notifications` table + dispatch service) out of Epic 15 into either:
- **(a) Epic 1 foundation** — package boundary `packages/notifications` (already named in Agent B addendum §5) gets scaffolded in Epic 1 alongside email infrastructure (per Gap-EC1 recommendation). Epics 4, 9, 14, 15 then *consume* the abstraction. This is the cleanest fix.
- **(b) Epic 4 foundation slice** — Epic 4 introduces push as part of "capture-at-risk escalation channel." Epic 9 consumes it. Epic 14 (DSAR delivery), Epic 15 (LMS/CRM/Slack/Teams notifications) consume later.

Option (a) is preferred because it pairs with the Gap-EC1 email-pluggability fix into a single `packages/notifications` package handling push + email + (future) SMS. **Cost to fix:** ~30 minutes — move FR60 mapping to Epic 1, restructure Epic 15 Story 15.6 to consume the abstraction rather than introduce it. Likely also adds a new FR82 for the notifications-package contract.

#### 🟡 Documented intentional dependencies (not violations)

These are forward dependencies that the epics doc explicitly acknowledges with friendly-refusal or sensible-default behavior. Per BMAD pragmatic interpretation, these are acceptable when documented and when the dependent epic can ship its primary user value with default behavior:

| From | To | Pattern | Default behavior in absence of dependent |
|---|---|---|---|
| Epic 6 Story 6.1 | Epic 14 Story 14.7 (HIPAA chain) | Module dispatch refused with *"HIPAA-eligible routing not yet enabled — coming in Epic 14"* | ✓ Friendly UX; gates open when 14 ships |
| Epic 8 Story 8.4 | Epic 12 Story 12.7 (cross-org accept policy) | Default policy `allow` per ADR-0006 / `tenant_settings.cross_org_share_policy` | ✓ Safe default; admin tightens at Epic 12 |
| Epic 9 Story 9.5 | Epic 12 Story 12.6 (consent-policy admin config) | Default conservative (EU=explicit, US=legitimate-interest) | ✓ GDPR-safe default; admin tunes at Epic 12 |
| Epics 9 + 10 minimal admin UIs | Epic 12 (consolidated admin product space) | Per-integration scoped UI ships with the integration; consolidated UI is Epic 12 enhancement | ✓ Each integration usable on its own |

**Verdict on documented dependencies:** Each is explicit in the epic descriptions, has a sensible default, and the depended-upon-epic ship adds polish/admin-control rather than core function. Acceptable BMAD-wise. Worth noting at sprint planning to ensure the friendly-refusal and default behaviors are tested.

### Story Quality Assessment

#### A. Acceptance Criteria Format

ACs use bullet-list outcomes rather than strict Given/When/Then BDD format. **Acceptable per BMAD** — testable + specific + measurable matters more than format. Spot-checks:

| Story | AC sample | Quality |
|---|---|---|
| Story 1.5 | "Signup completes ≤60s on a clean test path" | ✓ Testable, measurable |
| Story 2.6 | "SLA verified on a synthetic 30-min sample" | ✓ Testable |
| Story 3.5 | "Click → opens TranscriptSeekPlayer, seeks span, plays 5s pre-roll. Touch target ≥44px" | ✓ Specific + measurable |
| Story 4.3 | "Pre-mic modal blocks startRecording until acknowledged" | ✓ Testable |
| Story 4.5 | "At budget exhaustion: push + email + banner with options" | ✓ Error-path covered |
| Story 7.4 | "Faithfulness ≥90% on internal eval set; refuses ungrounded claims" | ✓ Quantitative + testable |
| Story 9.5 | (post-reconciliation edit) "EU per-participant detection forces explicit-consent path regardless of tenant default; consents rows persisted before pipeline enqueue" | ✓ Specific + traceable to ADR-0005 |
| Story 12.1 | (post-reconciliation edit) "tenants.state enum transitions draft → dpa_required → ... → active; tenant-state-check plugin gate" | ✓ Specific + traceable to ADR-0004 |

**No critical AC violations.** A few stories have terse ACs (Story 13.5 "Built on shadcn DataTable; Bulk edit; per-row toggle; Audit-log entries on change") — sprint-planning sharpening will expand these. Acceptable for inline-draft phase.

#### B. Story sizing

- **80 stories across 15 epics** — average 5.3 per epic; range 2 (Epic 11) to 9 (Epic 1).
- Most stories are appropriately sized for 1–3 sprint days.
- **Stories that may need splitting at sprint planning** (3 noted, none blocking):
  - **Story 12.1** — F2-admin first-launch flow has 8 sub-steps (DPA → region → retention → disclosure → modules → integrations → SSO → invites). Likely 5+ sprint days unless split into Story 12.1a (DPA + region + state machine), 12.1b (settings configuration steps), 12.1c (integration + SSO + invite handoff).
  - **Story 14.7** — HIPAA-eligible provider chain. Routing matrix + Bedrock setup + Azure HIPAA-eligible setup + embeddings via Azure OAI/self-hosted + module-runner gate release. Likely 5+ days; may split by provider.
  - **Story 14.8** — EU stack deployment. Railway eu-west services + LLM gateway routing matrix + subdomain routing + storage residency. Likely 5+ days; may split by infrastructure layer.
- **Verdict:** ✓ Defensible at draft phase; sprint planning will split as needed.

#### C. Within-Epic Linear Dependency Check

For each epic, stories should form a valid DAG (no cycles, no story refers to a later-numbered story).

Spot-checked:
- **Epic 1:** 1.1 (workspace) → 1.2 (tokens) → 1.3 (brand consumes 1.2) → 1.4 (tenant-context, independent) → 1.5 (auth, builds on 1.4) → 1.6 (shells consume 1.3) → 1.7 (F2 flow consumes 1.6) → 1.8 (telemetry, mostly independent) → 1.9 (i18n, mostly independent). ✓ Clean.
- **Epic 2:** 2.1 (storage) → 2.2 (upload consumes 2.1) → 2.3 (transcription) → 2.4 (diarization consumes 2.3) → 2.5 (receipt frame consumes 2.3 + 2.4) → 2.6 (SSE consumes 2.3 + 2.4 + 2.5). ✓ Clean.
- **Epic 3:** 3.1 (module schema) → 3.2 (summary) → 3.3 (actions) → 3.4 (AnalysisCard) → 3.5 (CitationChip + TranscriptSeekPlayer consumes Epic 2 Story 2.4 speaker-turn schema — cross-epic backward) → 3.6 (CI gate consumes 3.5) → 3.7 (SSE events). ✓ Clean.
- **Epic 4:** 4.1 (RecordingStatusPill V2) → 4.2 (one-tap recording) → 4.3 (consent shapes A + C) → 4.4 (heartbeat — push delivery is forward-dep on Epic 15 per EQ-1) → 4.5 (10-min retry — same push dep) → 4.6 (live captions). Within epic ✓; cross-epic forward dep flagged in EQ-1.
- **Epic 7:** 7.1 (pgvector) → 7.2 (FTS+semantic search) → 7.3 (cmd-K) → 7.4 (RAG chat) → 7.5 (RelationshipBrowser) → 7.6 (D4 shell). ✓ Clean.
- **Epic 14:** 14.1 (DSAR endpoint) + 14.2 (erasure cascade) + 14.3 (public portal) + 14.4 (queue cascade preview) + 14.5 (audit export) + 14.6 (clinical patient artifact) + 14.7 (HIPAA chain — releases Epic 6 second gate) + 14.8 (EU stack). All independent or backward-referencing. ✓ Clean.

**Verdict on within-epic dependencies:** ✓ Clean except for the documented cross-epic situations addressed above.

### Database/Entity Creation Timing

- **Story 1.1** initializes pnpm workspace (per Architecture A1) — no tables ✓
- **Story 1.4** introduces `audit_logs` table (foundational) — needed by every later epic ✓
- **Story 2.1** introduces `recordings` schema implicitly (via storage abstraction) — when first needed ✓
- **Story 2.4** introduces speaker-turn schema (currently prose-only — see Gap-UX1) — when first needed ✓
- **Story 7.1** introduces pgvector tables (`embeddings_1536`, `embeddings_1024`) — when first needed ✓
- **Story 9.x** introduces `bot_sessions` per Agent B §5 schema — when first needed ✓
- **Story 12.1** introduces `tenant_settings` per ADR-0004 — when first needed ✓
- **Story 13.1** introduces `tenant_entitlements` writes — when first needed ✓
- **Story 14.x** consumes erasure-cascade map registered in Epic 1 ✓

**Verdict:** ✓ Per-epic table creation, not upfront — clean per BMAD best practice.

### Greenfield Indicators

- ✓ Story 1.1 — Workspace skeleton initialization
- ✓ Story 1.2 — Token build pipeline + CI gate
- ✓ Story 1.4 — Tenant-context plugin + audit-coverage CI gate
- ✓ Architecture A9 — GitHub Actions CI pipeline (typecheck → lint → test → build → deploy on `main`)
- ✓ Story 1.6 — Three-shell scaffolding ready for Phase 1 features

**Verdict:** ✓ Greenfield setup is well-scoped in Epic 1.

### Starter Template

Architecture A1: *"No off-the-shelf starter. pnpm workspaces, hand-rolled is the selected approach. The first implementation story initializes the workspace skeleton."*

**Story 1.1** explicitly delivers the hand-rolled scaffold with all `apps/*` + `packages/*` + `infra/*` + base tooling (pnpm 9, Node 22 LTS, TS 5.6+ strict ESM, Biome, Vitest).

**Verdict:** ✓ Starter pattern correctly handled.

### Best-Practices Compliance Checklist (per epic)

| Epic | User value | Independent | Story sizing | No fwd-dep | DB-creation timing | AC quality | FR traceability |
|---|---|---|---|---|---|---|---|
| 1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | ✓ | ✓ (uses 1) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 | ✓ | ✓ (uses 1, 2) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 | ✓ | ✓ (uses 1, 2) | ✓ | 🔴 EQ-1 push dep | ✓ | ✓ | ✓ |
| 5 | ✓ | ✓ (uses 1, 2, 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 | ✓ | ✓ (uses 1, 2, 3, 5) | ✓ | 🟡 doc'd intentional dep on 14 | ✓ | ✓ | ✓ |
| 7 | ✓ | ✓ (uses 1, 2, 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8 | ✓ | ✓ (uses 1, 2, 3) | ✓ | 🟡 doc'd intentional dep on 12 | ✓ | ✓ | ✓ |
| 9 | ✓ | ✓ (uses 1, 2, 3) | ✓ | 🔴 EQ-1 push dep + 🟡 doc'd 12 dep | ✓ | ✓ | ✓ |
| 10 | ✓ | ✓ (uses 1) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 11 | ✓ | ✓ (uses 1) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 12 | ✓ | ✓ (uses 1, 9, 10, 11) | ⚠ Story 12.1 large; sprint-split likely | ✓ | ✓ | ✓ | ✓ |
| 13 | ✓ | ✓ (uses 1) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 14 | ✓ | ✓ (uses 1, 6) | ⚠ Stories 14.7, 14.8 large | ✓ | ✓ | ✓ | ✓ |
| 15 | ✓ | ✓ (uses 1, 2, 3, 4, 9) | ✓ | ⚠ Story 15.6 (push) is the *target* of EQ-1 | ✓ | ✓ | ✓ |

### Quality Findings Summary

#### 🔴 Critical Violations (1)

- **EQ-1 — Push notification infrastructure forward dependency.** Epic 4 + Epic 9 require push delivery (FR60) but push is owned by Epic 15. Recommendation: move `packages/notifications` (push + email scaffolding) into Epic 1 foundation. **Fix cost:** ~30 minutes — restructure FR60 epic mapping; introduce FR82 for the notifications-package contract; Epic 15 Story 15.6 becomes a consumer, not the introducer.

#### 🟠 Major Issues (0)

None.

#### 🟡 Minor Concerns (3)

- **Story 12.1** (F2-admin first-launch — 8 sub-steps) likely needs sprint-planning split into 12.1a/b/c.
- **Stories 14.7 + 14.8** (HIPAA chain + EU stack) are large infra stories; sprint-planning will likely split.
- **4 documented intentional cross-epic dependencies** (6→14 / 8→12 / 9→12 / 9+10→12 admin consolidation) are acceptable but should be tested for default-behavior correctness when the depending epic ships before the depended-on epic.

### Quality-Review Verdict

**PASS WITH 1 CRITICAL VIOLATION (EQ-1, fixable in 30 minutes).**

Apart from the push-notification forward dependency, all 15 epics:
- Deliver clear user value (no pure technical milestones)
- Stand on their own with sensible defaults where they reference later epics
- Have appropriately-sized stories with testable acceptance criteria
- Follow per-epic table-creation discipline
- Maintain FR traceability via the FR Coverage Map + per-story `FRs covered`

EQ-1 is a real blocker for Epic 4 and Epic 9 ships unless fixed. The fix is architecturally clean (folds into the Gap-EC1 email infrastructure recommendation — both become `packages/notifications` in Epic 1).

---

## Summary and Recommendations

### Overall Readiness Status

**READY for Phase 0 implementation. NEEDS WORK before Phase 1.**

Phase 0 (Storybook + Style Dictionary token pipeline + `RecordingStatusPill` V2 + `AnalysisCard` contract) **does not depend on any of the issues found**. Phase 0 can launch immediately.

Phase 1 onward requires the four fixes below to ship cleanly. Total fix effort: **~90 minutes of editorial work** (no new design or architecture decisions; all paths are clear).

### All Issues Found — Consolidated by Severity

| ID | Severity | Issue | Fix location | Phase 0 blocker? | Phase 1+ blocker? |
|---|---|---|---|---|---|
| **EQ-1** | 🔴 Critical | Push-notification infrastructure (FR60) lives in Epic 15 but is consumed by Epic 4 + Epic 9 | `epics.md` epic-mapping + Story 15.6 + new Story 1.x | No | **Yes** (Epic 4 + Epic 9 unships without this) |
| **Gap-EC1** | 🟠 Major | Email infrastructure (PRD-I5) has no FR; pluggable-provider abstraction promise unfulfilled | `epics.md` add FR80 + Epic 1 foundation | No | Yes (Story 1.7 re-engagement + Story 14.1 DSAR delivery hit it on day one) |
| **Gap-EC2** | 🟠 Major | Trial policy mechanism (PRD-E13) has no FR; tenant_state enum doesn't cover trial states | `epics.md` add FR81 + extend ADR-0004 | No | Yes (Epic 13 sprint stalls without it) |
| **Gap-UX1** | 🟠 Major | Speaker-turn-level addressable span schema not pinned anywhere (PRD silent, arch silent, addendums silent, Story 2.4 prose only) — N5 from reconciliation | `epics.md` Story 2.4 AC + tech-spec | No | Yes (Story 2.4 + Story 3.5 + Story 8.6 depend on it) |
| **Gap-UX2** | 🟡 Minor | `VoiceInputSurface` (FR62) package boundary unclear (`packages/voice` vs inline in mobile app) | sprint-planning at Story 5.7 | No | No (sprint-planning detail) |
| **PRD-EX3 vs FR65** | 🟡 Minor | Live-captions exception for accessibility relaxes PRD-EX3 explicit non-goal | `docs/mini-prd.md` post-launch retrospective | No | No |
| **Architecture cross-reference** | 🟡 Minor | `docs/architecture.md` should reference `arch-addendums.md` so engineers reading the locked doc see the 8 added patterns | One-line edit at top of `architecture.md` | No | No |
| **Story 12.1 sizing** | 🟡 Minor | F2-admin first-launch (8 sub-steps) likely needs split | sprint-planning split at Epic 12 | No | No (caught at sprint planning) |
| **Stories 14.7 + 14.8 sizing** | 🟡 Minor | HIPAA chain + EU stack are large infra stories | sprint-planning split at Epic 14 | No | No (caught at sprint planning) |

**Total:** 1 critical + 3 major + 5 minor = **9 issues across 4 categories** (FR coverage, UX alignment, epic quality, doc hygiene).

### Critical Issues Requiring Immediate Action

#### Action 1 — Fix EQ-1 + Gap-EC1 together (single coordinated edit)

**The fix:** Introduce a new package `packages/notifications` (already named in Agent B's `arch-addendums.md` §5) covering both push (Expo Push) and email (SMTP / Postmark / SES) with provider-agnostic interface and per-tenant routing.

**Specific edits:**
1. **`epics.md` — add to Epic 1:**
   - **FR80** *Pluggable email provider* — "System supports SMTP / Postmark / SES via `packages/notifications` with provider-agnostic interface; per-tenant routing via `tenant_settings`. Same import-discipline CI rule as `packages/llm-gateway`. Required for Story 1.7 re-engagement emails + Story 14.1 DSAR delivery + transactional email."
   - **FR82** *Notifications package contract* — "`packages/notifications` provides unified push + email + (future) SMS dispatch with `notification.send` queue, `notifications` table for tracking, dedup logic (suppress repeat pushes within 5 min for same target), and provider-agnostic provider selection per tenant. Day-1 providers: Expo Push (push) + Postmark (email) + SES fallback. On-prem deployment: SMTP-only mode."
   - **Story 1.x** (new, fits between current 1.5 and 1.6) — *Notifications package + Expo Push + email provider abstraction* — workspace package skeleton; provider interfaces; pg-boss `notification.send` job; `notifications` table.
2. **`epics.md` — restructure FR60 mapping** in FR Coverage Map: change from "Epic 15" to "Epic 1 (foundation) + consumed by Epic 4 / 9 / 14 / 15."
3. **`epics.md` — restructure Epic 15 Story 15.6:** change from "introduces Expo Push integration" to "consumes `packages/notifications`; adds LMS / CRM / Slack / Teams hub-app dispatch event types."
4. **`arch-addendums.md` §5** — extend the existing "Push notification dispatch" subsection to make explicit the email side of the package (the existing text mentions "iOS / Android via Expo Push... Email via existing email provider" but doesn't lock the abstraction).
5. **Frontmatter notes** in `epics.md` — add a note recording the refactor: "Push + email infrastructure consolidated in Epic 1 `packages/notifications` (FR82) per readiness review EQ-1 fix; FR60 + FR80 are consumers."

**Time estimate:** 30–45 minutes (mostly mechanical FR/story-mapping edits).

#### Action 2 — Fix Gap-EC2 (trial policy mechanism)

**The fix:** Add FR81 to Epic 13 + extend ADR-0004's `tenant_state` enum.

**Specific edits:**
1. **`epics.md` — add to Epic 13:**
   - **FR81** *Trial policy mechanism* — "System tracks tenant trial state via `tenant_state` enum extension (`trialing`, `pilot`, `trial_expired`). Pro 14-day no-credit-card trial; Business 14-day sales-assisted; Enterprise scoped pilot with custom expiration. Trial-end reminder emails fire at T-3d + T-1d (consume `packages/notifications` per FR82). Stripe `trial_period_days` is the source of truth for date math; webhook `customer.subscription.trial_will_end` triggers reminder dispatch. Auto-conversion to paid at trial-end if card on file (Pro paid path); manual sales handoff for Business; Enterprise pilot expiration triggers `trial_expired` state with admin contact-sales surface."
   - **Story 13.x** (new) — *Trial state tracking + reminder emails + auto-conversion* — extend tenant_entitlements; consume Stripe trial events; consume `packages/notifications`.
2. **`arch-addendums.md` §4 / ADR-0004:** extend the `tenant_state` enum with `trialing`, `pilot`, `trial_expired` values; add a note about trial-state being orthogonal to the lifecycle FSM (a tenant in `provisioning` or `active` can also be in a trial sub-state, OR trial state is a lifecycle state — pick one and document). Recommend: add `trial_starts_at`, `trial_ends_at`, `trial_kind` (`pro` | `business` | `enterprise_pilot`) fields to `tenants` rather than enum-bloating `tenant_state`. Cleaner.

**Time estimate:** 20–30 minutes.

#### Action 3 — Pre-emptively close Gap-UX1 (speaker-turn schema)

**The fix:** Add a 3-line schema spec to Story 2.4 AC.

**Specific edits:**
1. **`epics.md` — Story 2.4 AC, append:**
   - "**Speaker-turn addressing scheme** (per Gap-UX1): Each turn is `{ id: string (stable hash of meetingId+speakerId+spanStartMs), meetingId: UUID, speakerId: 'spk_N' (Pyannote-assigned) | external_user_id (when bot maps to participant), spanStartMs: number, spanEndMs: number, text: string }`. Stability commitment: turn IDs survive re-diarization unless underlying audio bytes change. CitationChip click-to-seek (Story 3.5) and ManagerCoachingCard span-anchored annotation (Story 8.6) consume this contract."

**Time estimate:** 5 minutes.

### Recommended Next Steps

In order:

1. **Apply Actions 1 + 2 + 3 above** (~60 minutes total). Single coordinated `epics.md` + `arch-addendums.md` edit pass; foreground task; safe to do sequentially.
2. **Optional housekeeping** (Gap-UX2, PRD-EX3, architecture cross-reference) — 10 minutes; can defer to next housekeeping pass.
3. **Update `HANDOFF.md` + `MEMORY.md`** to reflect EQ-1 + Gap-EC1 + Gap-EC2 + Gap-UX1 closure, and the new Epic 1 notifications-package story.
4. **Begin Phase 0** — Storybook scaffold (web + RN) + Style Dictionary token build pipeline (per ADR-0002) in parallel; both are independent and unblock `RecordingStatusPill` V2 + `AnalysisCard` contract. The Phase 0 entry prompt in `HANDOFF.md` is already configured for this.
5. **Phase 1 sprint planning** — run `bmad:bmm:workflows:create-story` per Phase 1 story (Epic 2 + Epic 4 + Epic 3 batch), consuming `reconciliation-note.md` + this readiness report as inputs to pick up the N1–N5 naming-drift items + the speaker-turn schema commitment from Action 3.

### Final Note

This assessment identified **9 issues across 4 categories** (FR coverage, UX alignment, epic quality, doc hygiene). **Phase 0 is unblocked.** Phase 1 onward requires Actions 1–3 (~60 minutes of editorial work, no new design decisions). The artifacts produced so far (PRD + UX spec + architecture + addendums + epics.md with 80 stories + reconciliation note + 5 ADRs PROPOSED) constitute a complete planning package — the issues found are integration-level adjustments, not foundational gaps.

The recommended path: **fix Actions 1–3 in one focused edit pass, then start Phase 0**. The cost of doing it now (~60 min) versus discovering the issues mid-Epic-4-sprint (lost dev day + sprint-planning churn) is the right trade.

**Assessor:** Implementation Readiness workflow (`check-implementation-readiness` v6.0.0-alpha.22)
**Date:** 2026-04-29
**Inputs:** `docs/mini-prd.md`, `docs/architecture.md`, `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/ux-design-specification.md`, `_bmad-output/planning-artifacts/arch-addendums.md`, `_bmad-output/planning-artifacts/reconciliation-note.md`, `docs/input-spec.md`


