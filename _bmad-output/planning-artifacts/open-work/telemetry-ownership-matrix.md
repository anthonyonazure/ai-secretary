# Telemetry Ownership Matrix

**Status:** Living document; engineering + product co-owned
**Owners:** Product (matrix custodian) + Engineering (instrumentation) + named per-signal owners
**Source spec:** [`../ux-design-specification.md`](../ux-design-specification.md) — Step 10 F1–F5 + F2-admin

---

## 1. Why this document exists

Per the spec (Step 10):

> **Telemetry has owners.** Every signal collected has a named
> reviewer and a threshold-action mapping. No orphan data
> collection.

This file is the canonical extension of the F2 telemetry table
sketched in the spec. It enumerates **every signal collected across
F1–F5 + F2-admin**, names a human owner, sets a review cadence,
defines a threshold-action mapping, declares a storage location,
and applies privacy / retention rules per signal.

Signals not in this matrix are not collected. New signals require
a row added before instrumentation lands.

---

## 2. Conventions

### Owner roles

| Role | Responsible for |
|---|---|
| **Growth PM** | Activation, retention, mental-model fit, re-engagement |
| **Product** | Feature usage, mental-model validation, receipt-shape feedback |
| **Engineering** | Pipeline performance, system health, error rates, capture reliability |
| **Compliance / DPO** | Consent capture, audit log integrity, DSAR processing, retention |
| **Customer Success** | Adoption depth, share velocity, integration usage |
| **Design** | Receipt scan-time, accessibility usage, motion-mode preference distribution |

### Review cadence

| Cadence | What it means |
|---|---|
| **Realtime** | Alerted via PagerDuty / Sentry / Grafana when threshold crossed |
| **Daily** | Reviewed in standup + dashboard glance |
| **Weekly** | Reviewed in product / growth weekly review |
| **Monthly** | Reviewed in monthly business review |
| **Quarterly** | Reviewed in QBR; informs roadmap |

### Storage locations

| Location | Used for |
|---|---|
| **PostHog** | Product analytics, funnels, feature flags, free-text feedback |
| **Grafana Cloud (Mimir)** | Time-series metrics — pipeline timing, system health, error rates |
| **Grafana Cloud (Loki)** | Structured logs (pino-emitted) |
| **Grafana Cloud (Tempo)** | Distributed traces |
| **Sentry** | Error events, error-rate aggregations |
| **Internal Postgres tables** | Audit logs, DSAR queue, consent records — durable + queryable + tenant-scoped (per architecture RLS) |
| **CSV / data warehouse** | Long-form synthesis data for research |

### Privacy rules

| Class | Rule |
|---|---|
| **Aggregate / anonymized** | Default; no PII; safe for product analytics |
| **Pseudonymous** | Hashed identifiers (user UUID); reversible only with privileged access |
| **Identified, consented** | User opted in; e.g., free-text feedback voluntarily submitted |
| **Audit-logged** | Required by compliance; immutable; tenant-scoped; retained per region/regulation |
| **PHI / clinical-restricted** | Special handling; never sent to PostHog; lives in tenant-region database only; access-controlled |

---

## 3. The matrix — F1: Capture → Receipt

### F1.1 — Recording started

| Field | Value |
|---|---|
| Signal | Recording session initiated (mobile, web, bot) |
| Owner | Engineering |
| Review cadence | Daily (volume) + Realtime (failure rate) |
| Threshold → action | <99% start success rate over 100 attempts → realtime page; investigation within 1h |
| Storage | PostHog (event) + Grafana (counter) |
| Privacy | Pseudonymous |
| Retention | 13 months (PostHog default); aggregates retained indefinitely |

### F1.2 — Heartbeat liveness

| Field | Value |
|---|---|
| Signal | 30s heartbeat from active recording client to server |
| Owner | Engineering |
| Review cadence | Realtime |
| Threshold → action | Lost heartbeat >90s → push notification within 60s of detection (per spec F1) |
| Storage | Grafana (gauge) |
| Privacy | Pseudonymous |
| Retention | 30 days |

### F1.3 — Capture-at-risk detection lead-time

| Field | Value |
|---|---|
| Signal | Time between actual failure event and user notification |
| Owner | Engineering |
| Review cadence | Weekly |
| Threshold → action | p95 lead-time >120s sustained 1 week → eng investigation; >180s → block release |
| Storage | Grafana (histogram) |
| Privacy | Aggregate |
| Retention | 13 months |

### F1.4 — Per-stage pipeline timing (transcript / summary / actions / analysis)

| Field | Value |
|---|---|
| Signal | Time from recording stop to each receipt stage arrival |
| Owner | Engineering + Product |
| Review cadence | Daily (p50/p95/p99) |
| Threshold → action | Sales/PM/Support/Edu/HR/General: p95 transcript >60s OR full receipt >5min → eng review. Clinical: p95 full receipt >45min → eng review |
| Storage | Grafana (histogram per stage per vertical) |
| Privacy | Aggregate |
| Retention | 13 months |

### F1.5 — Expected-arrival-time accuracy

| Field | Value |
|---|---|
| Signal | Difference between predicted arrival time shown to user and actual arrival time |
| Owner | Product |
| Review cadence | Weekly |
| Threshold → action | >25% of predictions off by >50% → recalibrate prediction model OR widen prediction interval |
| Storage | Grafana (histogram) |
| Privacy | Aggregate |
| Retention | 13 months |

### F1.6 — Module-correct rate (without user override)

| Field | Value |
|---|---|
| Signal | Did the user click "Switch vertical" on receipt within first 24h? |
| Owner | Product |
| Review cadence | Weekly |
| Threshold → action | Non-clinical override rate >5% → review module-inference logic. Clinical override rate >1% → halt; clinical confirm-at-capture is failing |
| Storage | PostHog (event) + internal table for clinical |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F1.7 — Vertical override events (audit)

| Field | Value |
|---|---|
| Signal | User clicked "Switch vertical" on a receipt; meeting ID, old module, new module |
| Owner | Compliance / DPO |
| Review cadence | Monthly (compliance review) |
| Threshold → action | Per-tenant override pattern detection; alerts admin if a clinician repeatedly overrides clinical → general (potential consent issue) |
| Storage | Internal Postgres `audit_logs` table |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years (HIPAA); EU 6 years (GDPR ancillary) |

### F1.8 — Resumable upload retry events

| Field | Value |
|---|---|
| Signal | Network drop occurred during upload; retry attempts; final outcome (recovered / failed-permanent) |
| Owner | Engineering |
| Review cadence | Weekly |
| Threshold → action | Permanent failure rate >0.5% → infra review |
| Storage | Grafana (counter) + Sentry (error events for permanent failures) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F1.9 — First-receipt thumbs (first 3 receipts only)

| Field | Value |
|---|---|
| Signal | Thumbs-up / thumbs-down on receipt #3 ("Was this useful?") |
| Owner | Growth PM |
| Review cadence | Weekly |
| Threshold → action | <50% positive over 100+ thumbs collected → trigger Step 7 receipt design review (per spec F2 table) |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F1.10 — Mental-model validation free-text

| Field | Value |
|---|---|
| Signal | Free-text answer to *"In one sentence — how would you describe what you just got from us?"* (collected after 1st, 2nd, 3rd receipts) |
| Owner | Growth PM + Product |
| Review cadence | Weekly (manual scan) + Quarterly (NLP categorization) |
| Threshold → action | >40% mismatch with anchor word ("receipt") → trigger word-choice card sort revisit (per spec F2 table) |
| Storage | PostHog (event with text payload) |
| Privacy | Identified, consented (user typed it; tied to user UUID) |
| Retention | 13 months; quarterly samples archived to research data warehouse |

### F1.11 — Citation click-through rate

| Field | Value |
|---|---|
| Signal | User clicked a `CitationChip`; meeting ID, citation span |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | <5% click-through rate after 30d corpus age → review citation visual design (chip too subtle? scan-time too short?) |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F1.12 — Receipt scan-to-comprehend time (study-driven)

| Field | Value |
|---|---|
| Signal | Self-reported scan time from N≥10 user-per-vertical study (per Step 7) |
| Owner | Design |
| Review cadence | Pre-launch + at each major receipt-screen revision |
| Threshold → action | Median >20s non-clinical OR >60s clinical → receipt redesign |
| Storage | CSV / research data warehouse (study output) |
| Privacy | Identified, consented (study participants) |
| Retention | Indefinite (research artifact) |

---

## 4. The matrix — F2: First-launch activation (user)

### F2.1 — Sign-up → first receipt time

| Field | Value |
|---|---|
| Signal | Time between sign-up and first receipt arrival (sample, import, or recorded) |
| Owner | Growth PM |
| Review cadence | Weekly |
| Threshold → action | p50 >5 min → empty-state redesign |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F2.2 — 7-day activation rate (PRD §5: 70%)

| Field | Value |
|---|---|
| Signal | % of new sign-ups who upload (or record) within 7 days |
| Owner | Growth PM |
| Review cadence | Weekly |
| Threshold → action | <60% sustained over 4 weeks → trigger F2 redesign (per spec F2 table) |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F2.3 — Sample meeting click rate

| Field | Value |
|---|---|
| Signal | % of new sign-ups who click a sample meeting from the empty home |
| Owner | Growth PM |
| Review cadence | Weekly |
| Threshold → action | <30% click-through → sample-library design or copy iteration |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F2.4 — "Import existing audio" CTA conversion

| Field | Value |
|---|---|
| Signal | % of new sign-ups who click "Import existing audio" + complete an upload |
| Owner | Growth PM |
| Review cadence | Weekly |
| Threshold → action | <10% conversion → reposition CTA OR rewrite copy |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F2.5 — Tab-closer (no first-day action) re-engagement

| Field | Value |
|---|---|
| Signal | Email open rate at 24h + 72h re-engagement; CTR; resulting activation |
| Owner | Growth PM |
| Review cadence | Monthly |
| Threshold → action | <20% open rate sustained 8 weeks → revise email copy (per spec F2 table). <2% activation from tab-closer cohort → de-prioritize re-engagement loop |
| Storage | PostHog (event) + email-platform integration data |
| Privacy | Identified, consented |
| Retention | 13 months |

### F2.6 — Empty-calendar onboarding answer distribution

| Field | Value |
|---|---|
| Signal | Answer to *"What kind of meetings do you typically have?"* — answer becomes org default |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | If >30% pick "general" instead of a vertical → vertical-detection UX needs sharpening |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

---

## 5. The matrix — F2-admin: First-launch (org admin)

### F2-admin.1 — DPA acceptance rate / time-to-accept

| Field | Value |
|---|---|
| Signal | Time between admin sign-up and DPA acceptance; decline rate |
| Owner | Compliance / DPO + Growth PM |
| Review cadence | Monthly |
| Threshold → action | Decline rate >5% → DPA copy or framing revision; legal review |
| Storage | Internal Postgres `audit_logs` + PostHog |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### F2-admin.2 — Region pin selection distribution

| Field | Value |
|---|---|
| Signal | US vs. EU region selection; locked once chosen |
| Owner | Compliance / DPO |
| Review cadence | Quarterly |
| Threshold → action | Used for capacity planning; no specific threshold |
| Storage | Internal Postgres |
| Privacy | Audit-logged |
| Retention | Indefinite (region pin is durable account state) |

### F2-admin.3 — Consent disclosure config completion rate

| Field | Value |
|---|---|
| Signal | Did admin configure custom disclosure copy or accept default? |
| Owner | Compliance / DPO |
| Review cadence | Quarterly |
| Threshold → action | If <30% customize → review default disclosure copy quality |
| Storage | PostHog (event) + internal Postgres |
| Privacy | Audit-logged |
| Retention | Indefinite (durable config) |

### F2-admin.4 — Retention defaults distribution

| Field | Value |
|---|---|
| Signal | Audio retention setting (30d / 90d / indefinite); transcript retention |
| Owner | Compliance / DPO |
| Review cadence | Quarterly |
| Threshold → action | Review for outliers (e.g., 100% admins set indefinite → suggest a default change) |
| Storage | Internal Postgres |
| Privacy | Audit-logged |
| Retention | Indefinite |

### F2-admin.5 — Module enablement distribution

| Field | Value |
|---|---|
| Signal | Which of the 8 verticals does each tenant enable? |
| Owner | Product + Customer Success |
| Review cadence | Quarterly |
| Threshold → action | Used for module-development prioritization |
| Storage | Internal Postgres + PostHog |
| Privacy | Aggregate |
| Retention | Indefinite |

### F2-admin.6 — Integration setup completion

| Field | Value |
|---|---|
| Signal | Which integrations does the admin connect at first launch? (Nylas, Zoom, Teams, Slack, HubSpot, Salesforce, Pipedrive, SSO) |
| Owner | Customer Success |
| Review cadence | Monthly |
| Threshold → action | <40% Nylas connection in first session → onboarding flow revision |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F2-admin.7 — Seat invitation rate

| Field | Value |
|---|---|
| Signal | # users invited at first launch; subsequent invitations over 30 days |
| Owner | Growth PM + Customer Success |
| Review cadence | Monthly |
| Threshold → action | <2 invitations on day 1 → admin-onboarding "invite team" CTA needs strengthening |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

---

## 6. The matrix — F3: Bot auto-join + consent

### F3.1 — Bot join success rate

| Field | Value |
|---|---|
| Signal | % of scheduled bot joins that succeed |
| Owner | Engineering |
| Review cadence | Realtime + Daily |
| Threshold → action | <99% join rate → realtime page; investigation within 1h |
| Storage | Grafana (counter) + Sentry |
| Privacy | Aggregate |
| Retention | 13 months |

### F3.2 — Bot announcement TTS playback completion

| Field | Value |
|---|---|
| Signal | TTS announcement played to completion before recording starts |
| Owner | Compliance / DPO |
| Review cadence | Weekly |
| Threshold → action | <100% must complete before record → engineering bug; consent at risk |
| Storage | Internal Postgres `audit_logs` |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### F3.3 — Per-participant consent timestamps

| Field | Value |
|---|---|
| Signal | Each participant's consent state at meeting time (implicit-stay, explicit-opt-in, opt-out, excluded) |
| Owner | Compliance / DPO |
| Review cadence | Realtime (audit log entry per event) + monthly review |
| Threshold → action | Any opt-out triggers org-policy enforcement (quarantine OR exclusion) |
| Storage | Internal Postgres `consents` table (tenant-scoped, RLS) |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### F3.4 — Bot liveness ping

| Field | Value |
|---|---|
| Signal | 30s liveness ping from bot during meeting |
| Owner | Engineering |
| Review cadence | Realtime |
| Threshold → action | Lost ping >90s → push within 60s + email + banner |
| Storage | Grafana (gauge) |
| Privacy | Pseudonymous |
| Retention | 30 days |

### F3.5 — Quarantine trigger rate

| Field | Value |
|---|---|
| Signal | # of recordings auto-quarantined due to consent decline |
| Owner | Compliance / DPO + Customer Success |
| Review cadence | Monthly |
| Threshold → action | Per-tenant pattern: >5% quarantine rate → outreach to admin (consent UX or policy mismatch) |
| Storage | Internal Postgres |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

---

## 7. The matrix — F4: Search + RAG chat

### F4.1 — cmd-K open frequency

| Field | Value |
|---|---|
| Signal | # times cmd-K opened per user per day |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | If <1/day in active users → discoverability problem; revisit cmd-K affordance |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.2 — Search query → result-click rate

| Field | Value |
|---|---|
| Signal | % of searches resulting in a click on a result |
| Owner | Product |
| Review cadence | Weekly |
| Threshold → action | <40% click rate → ranking quality investigation |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.3 — RAG retrieval confidence distribution

| Field | Value |
|---|---|
| Signal | Per-query retrieval confidence score; query categorized as high / low / empty / cross-meeting-noise |
| Owner | Product + Engineering |
| Review cadence | Weekly |
| Threshold → action | If "empty" rate >20% sustained 4 weeks → corpus indexing issue OR query patterns need RAG-specific UX. If "low confidence" >40% → embedding model review |
| Storage | Grafana (histogram) + PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.4 — RAG citation click-through

| Field | Value |
|---|---|
| Signal | % of RAG answers where user clicked at least one citation |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | <30% citation engagement → trust UX needs work; users not validating answers |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.5 — "I don't know" response acceptance

| Field | Value |
|---|---|
| Signal | When the system returns "no relevant content," does the user refine the query OR abandon? |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | >50% abandon → refine empty-state copy or retrieval threshold |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.6 — RelationshipBrowser usage

| Field | Value |
|---|---|
| Signal | % of users who use the RelationshipBrowser at least once per month |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | <20% monthly use → RelationshipBrowser discoverability needs work |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F4.7 — Power-user mode (D4) activation

| Field | Value |
|---|---|
| Signal | % of users who toggle D4 search-first home in settings; meeting count at toggle time |
| Owner | Product |
| Review cadence | Quarterly |
| Threshold → action | Informs threshold for proactive D4 suggestion (Step 9 open question — 50 meetings? user opt-in only?) |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

---

## 8. The matrix — F5: Sharing

### F5.1 — Share creation rate

| Field | Value |
|---|---|
| Signal | # shares created per active user per month |
| Owner | Customer Success + Growth PM |
| Review cadence | Monthly |
| Threshold → action | Falling rate quarter-over-quarter → sharing UX investigation |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F5.2 — Share recipient view rate

| Field | Value |
|---|---|
| Signal | % of created shares that get viewed by a recipient |
| Owner | Growth PM |
| Review cadence | Monthly |
| Threshold → action | <50% view rate → email subject / link presentation revision |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F5.3 — Recipient → sign-up conversion

| Field | Value |
|---|---|
| Signal | % of unique share recipients (without account) who sign up within 30 days |
| Owner | Growth PM |
| Review cadence | Monthly |
| Threshold → action | <2% conversion → recipient-view CTA strategy revision |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F5.4 — Cross-org share blocked rate

| Field | Value |
|---|---|
| Signal | # of cross-org shares blocked at recipient side per month |
| Owner | Customer Success |
| Review cadence | Monthly |
| Threshold → action | High block rate per tenant → outreach explaining cross-org policy options |
| Storage | Internal Postgres `audit_logs` |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### F5.5 — Share revocation events

| Field | Value |
|---|---|
| Signal | User revokes a share (admin or owner action) |
| Owner | Compliance / DPO |
| Review cadence | Monthly |
| Threshold → action | Audit signal; pattern detection for tenant security review |
| Storage | Internal Postgres `audit_logs` |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### F5.6 — Push-to-CRM success rate (F5-CRM sub-flow)

| Field | Value |
|---|---|
| Signal | % of "Push to CRM" actions that succeed end-to-end |
| Owner | Engineering + Customer Success |
| Review cadence | Weekly |
| Threshold → action | <95% success → CRM integration health investigation |
| Storage | Grafana (counter) + Sentry (failure events) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### F5.7 — CRM deal-mapping resolution path

| Field | Value |
|---|---|
| Signal | When CRM has multiple matching deals, did user pick from list, create new, or cancel? |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | High cancel rate → ranking improvement OR unified lookup |
| Storage | PostHog (funnel) |
| Privacy | Pseudonymous |
| Retention | 13 months |

---

## 9. Cross-cutting signals (not tied to a specific F flow)

### X.1 — Density-mode usage distribution

| Field | Value |
|---|---|
| Signal | % users on `dense` / `relaxed` / `accessible` (split by auto-applied vs. user-chosen) |
| Owner | Design |
| Review cadence | Quarterly |
| Threshold → action | Informs default-density review; if `accessible` user-chosen >10% → consider it as default |
| Storage | PostHog (user property) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.2 — Motion-mode preference distribution

| Field | Value |
|---|---|
| Signal | % users with `default` / `gentle` / `reduced` motion |
| Owner | Design |
| Review cadence | Quarterly |
| Threshold → action | Validates Step 8 reduced-motion audit prioritization |
| Storage | PostHog (user property) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.3 — Theme-mode distribution

| Field | Value |
|---|---|
| Signal | % users on system / light / dark |
| Owner | Design |
| Review cadence | Quarterly |
| Threshold → action | None — informational only |
| Storage | PostHog (user property) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.4 — Locale distribution (EN / FR + future)

| Field | Value |
|---|---|
| Signal | % users on EN / FR / future locales |
| Owner | Product |
| Review cadence | Quarterly |
| Threshold → action | Informs translation prioritization |
| Storage | PostHog (user property) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.5 — Single-user vs. org mode distribution

| Field | Value |
|---|---|
| Signal | % users in `AppShell.Cards` (D3 single-user) vs. `AppShell.Inbox` (D1 org) |
| Owner | Product |
| Review cadence | Monthly |
| Threshold → action | Informs prioritization for single-user-mode polish |
| Storage | PostHog (user property) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.6 — Voice/dictation usage

| Field | Value |
|---|---|
| Signal | # of voice-input events per user per month (mobile) |
| Owner | Product + Design |
| Review cadence | Quarterly |
| Threshold → action | If <5% of mobile users use voice/dictation monthly → discoverability OR quality issue investigation |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

### X.7 — Accessibility audit completeness

| Field | Value |
|---|---|
| Signal | % of components passing axe-core in CI |
| Owner | Design + Engineering |
| Review cadence | Realtime (CI gate) + Quarterly (regression review) |
| Threshold → action | <100% → block merge |
| Storage | CI artifacts |
| Privacy | Aggregate |
| Retention | Indefinite (CI history) |

### X.8 — DSAR queue processing time

| Field | Value |
|---|---|
| Signal | Time from DSAR submission (admin queue OR public portal) to resolution |
| Owner | Compliance / DPO |
| Review cadence | Monthly |
| Threshold → action | p95 >25 days (within GDPR 30-day window) → admin staffing or process review |
| Storage | Internal Postgres |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### X.9 — Public DSAR portal submissions

| Field | Value |
|---|---|
| Signal | # public DSAR submissions per month |
| Owner | Compliance / DPO |
| Review cadence | Monthly |
| Threshold → action | Trend tracking; informs portal scaling and identity-verification UX |
| Storage | Internal Postgres |
| Privacy | Audit-logged |
| Retention | Per region: US 7 years; EU 6 years |

### X.10 — Audit log query patterns (admin behavior)

| Field | Value |
|---|---|
| Signal | What filters / queries do admins run on the audit log? |
| Owner | Customer Success + Compliance |
| Review cadence | Quarterly |
| Threshold → action | Common query patterns → consider as saved-filter defaults |
| Storage | PostHog (event) |
| Privacy | Pseudonymous |
| Retention | 13 months |

---

## 10. Privacy / retention rules — global

### What we never collect

- Raw audio (only hash of session ID for telemetry purposes)
- Full transcript text (only meeting ID for telemetry)
- Free-text user content beyond explicitly consented feedback
- IP addresses beyond 24-hour rolling window for security purposes
- Browser fingerprints or cross-site tracking identifiers
- PHI in any analytics surface (clinical telemetry stays in
  tenant-region database only)

### What we collect with explicit consent

- Free-text feedback (mental-model question, thumbs prompt context)
- Customer-development interview content (separate consent flow)
- Card-sort and study results (separate consent flow)

### Region-aware retention

- **US tenants:** PostHog data retained 13 months; audit-logged
  data 7 years (HIPAA tenants); Sentry 90 days
- **EU tenants:** PostHog data retained 13 months; audit-logged
  data 6 years; Sentry 30 days; data residency in eu-west-1
- **Clinical tenants:** elevated restrictions; PHI never leaves
  tenant-region DB; analytics on aggregate counts only

### Right to deletion

- DSAR-deletion requests propagate to PostHog via batch deletion
  API (per-user UUID erasure)
- Audit-logged data is exempt where retention is legally required
  (HIPAA, GDPR ancillary records)
- Deletion confirmation provided to requester within
  regulation-mandated window

---

## 11. Quarterly review cadence

Once per quarter, this matrix gets a structured review:

1. **Owner audit** — every signal has a named, current owner
2. **Threshold audit** — thresholds still match product reality
3. **Storage audit** — signals not used in 6 months → candidates
   for deletion
4. **Privacy audit** — retention compliant with current regulation
5. **New-signal pipeline** — any signal added without a row in this
   matrix gets retroactively documented OR removed
6. **Threshold-action verification** — for each signal that crossed
   threshold in the prior quarter, was the prescribed action taken?

Outcomes from quarterly review:

- This file gets edited (it's a living document)
- Stale signals get pruned
- New signals get rows
- Owners get reassigned if responsibilities shifted

---

## 12. Adding a new signal

Process for a new telemetry signal (must precede instrumentation):

1. **Propose** in PR — add a row to this matrix with all columns
   filled
2. **Privacy review** — Compliance / DPO signs off on privacy class +
   retention
3. **Owner agreement** — named owner accepts the review cadence and
   threshold-action mapping
4. **Storage path defined** — appropriate location chosen
5. **Merge** — instrumentation lands in the same PR or follow-up
6. **Verify** — first telemetry events arrive at the correct
   storage location; threshold-action triggered if relevant

A signal not following this process is an orphan signal and is
removed at the next quarterly review. The matrix is the single
source of truth.
