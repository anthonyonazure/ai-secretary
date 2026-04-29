# AI Secretary System — Product Spec (locked-in for architecture)

**Status:** LOCKED — 2026-04-29. No phased delivery; architecture must accommodate full scope from Day 1.

---

## 1. Product positioning

**AI Secretary turns any meeting — recorded on phone, laptop, or pulled from Zoom/Teams — into a structured, searchable knowledge asset with vertical-specific analysis (sales, HR, education, medical, customer support, project management, psychology, general), without sending customer audio to model-training pipelines.**

## 2. Non-goals

To prevent scope creep, AI Secretary explicitly does **not** do the following at MVP. Each is a defensible adjacency we cede to existing tools or defer beyond MVP:

- **CRM replacement.** Salesforce, HubSpot, Pipedrive remain systems of record. We hand off summaries and action items; we do not manage pipeline.
- **Project / task management.** Linear, Jira, Asana, Monday remain the source of truth. We surface action items; we do not run them.
- **In-meeting live captioning rendered to participants' screens.** Post-meeting analysis only at MVP.
- **Real-time meeting coaching / interventions during the meeting.**
- **Video / audio editing or production tools.** No clip editor, no post-production.
- **Voice cloning / outbound voice synthesis.**
- **Calendar / meeting scheduling.** We integrate with Nylas; we do not compete with Google Calendar / Outlook / Cal.com.
- **EHR replacement.** Medical module produces note drafts; clinicians import into their EHR of record.
- **E-discovery / legal-review tooling.** Audit logs and DSAR endpoint cover compliance; we do not ship litigation review surfaces.
- **Third-party module marketplace.** All 8 verticals are first-party at MVP. The "module = config" architecture allows future opening, but no marketplace ships at launch.
- **Cross-tenant speaker biometric identification.** Voiceprints (if used) stay within a single tenant.
- **Native iOS/Android apps separate from Expo.** Mobile = Expo (RN) + PWA. Native fork deferred until product-market fit clearly demands it.

## 3. Competitive landscape

| Competitor | Strength | Gap we exploit |
|---|---|---|
| Otter.ai | Cheap transcription | No vertical analysis, weak privacy |
| Fathom / tl;dv | Slick Zoom UX | Zoom-only, no in-person/mobile, no RAG |
| Fireflies.ai | CRM integrations | Sales-only |
| Read.ai | Sentiment + meeting health | Closed analysis, no customer-cloud |
| Upheal *(Kamee uses)* | Excellent clinical | Single vertical, no enterprise admin |
| Granola | Beautiful note UX | No backend search, single-user |

**Wedge:** modular vertical analysis + recording works anywhere + privacy/compliance Day-1 + multi-LLM (incl. local) + customer-cloud option.

## 4. Analysis verticals — full scope

All 8 analysis modules are in scope from the start, implemented as **plugins** against a shared core:

1. **General** — fallback for any meeting type
2. **Sales** — talk-ratio, objections, next-step clarity, deal-risk score, CRM-ready summary
3. **HR / Hiring** — competency rubric scoring, behavioral signals, decision-recommendation
4. **Education** — engagement signals, learning-objective coverage, student participation breakdown
5. **Medical / Behavioral Health** — clinical note draft (SOAP), screening prompts, risk flags. Heavier compliance posture (HIPAA / BAA-ready)
6. **Customer Support** — issue summary, sentiment, resolution status, escalation flag
7. **Project Management** — decisions log, action items with owner+due-date, blockers, risk register entries
8. **Psychology** — therapeutic alliance signals, themes, intervention notes (overlaps with Medical; separate prompt config; HIPAA-eligible posture available when BAA signed)

**Architectural rule:** modules are *data + prompt + output-schema*, not code. Adding the 9th vertical = author one config file, no platform changes.

## 5. User personas

The product serves four primary personas. *Roles & permissions matrix is encoded in `docs/architecture.md` (RBAC: `super_admin`, `org_admin`, `org_member`, `org_viewer` + per-meeting share grants).*

| # | Persona | Who | Primary needs | Anti-pattern (what they don't want) |
|---|---|---|---|---|
| **P1** | **Recorder** *(most common path)* | Anyone in a customer org who hits *Record* on mobile/desktop or uploads a file | Fast transcript + accurate summary + correct vertical analysis; minimal friction in capture; confidence the right people will see it | Friction at recording moment; ambiguous consent flow; "where did my recording go?" |
| **P2** | **Recipient / Collaborator** | A teammate who receives a shared meeting, or who searches the corpus | Find the decision / action item / quote; trust grounded answers from chat; clear citation back to source | Hallucinated chat answers; broken share links; can't tell what they have access to |
| **P3** | **Org Admin** | The customer-org buyer / IT / ops lead | Tenant control: billing, seat management, integration setup (Zoom / Teams / Nylas), retention policy, module entitlements, audit log, compliance evidence (DPA, BAA, DSAR) | Hidden costs; opaque audit trail; surprise data egress; can't see who shared what |
| **P4** | **Super Admin** *(AI Secretary internal)* | Platform staff | Multi-tenant ops: usage, cost, compliance posture per tenant, support intervention, region-aware support tooling | Cross-tenant data leakage from tooling; unclear chain of custody for support actions |

**Vertical persona overlays** — flavor on top of P1 / P2 / P3, used to prioritize per-vertical work; not separate auth roles:

- **Sales rep** — wants CRM-ready summaries, deal-risk on demand, low-friction post-call workflow
- **Therapist / behavioral-health clinician** — wants SOAP-formatted note drafts, risk flag surfacing, HIPAA assurance, fast clinician edit-cycle
- **HR hiring manager** — wants competency-rubric scoring, candidate-comparison view, decision-recommendation grounded in transcript
- **Educator / LMS admin** — wants LTI 1.3 launch, gradebook passback, engagement metrics per session, FERPA-aware data handling

## 6. User journeys (representative — full set)

| # | Journey | Persona | Acceptance |
|---|---|---|---|
| **J0** | New org self-serve signup → first user invited → first meeting recorded → activation | P3 → P1 | Signup ≤ 60s; activation (first meeting analyzed) ≤ 7 days for 70% of new orgs |
| **J1** | Record in-person meeting on mobile-web/native, see transcript + summary + actions ≤ 3 min after stop (≤ 30 min audio) | P1 | Pipeline p95 ≤ 6× real-time; summary ≤ 60s after transcript |
| **J2** | Upload existing audio/video file ≤ 4hr / ≤ 2GB | P1 | Drag-drop on web; chunked upload; resumable |
| **J3** | Connect Zoom / Teams; bot auto-joins scheduled meetings, recording captured to AI Secretary | P3 → P1 | OAuth flow; bot joins ≤ 30s of meeting start; live capture supported; recording uploaded post-meeting if live capture unavailable |
| **J4** | Connect calendar (Nylas), see upcoming meetings, opt-in auto-record per meeting | P3 → P1 | Calendar sync ≤ 5 min lag; per-meeting record toggle persists |
| **J5** | Search "objections about pricing" across corpus, get ranked snippets with timestamps | P2 | p95 < 2s on 100K-meeting corpus; deep-link to transcript anchor |
| **J6** | Generate vertical-specific analysis report on a meeting (e.g. Sales report) | P1, P2 | ≤ 90s; output validates against module schema; cites transcript spans |
| **J7** | Chat with the corpus ("show me deals where the buyer mentioned competitor X") | P2 | Grounded answers with citations; refuses ungrounded claims; faithfulness target ≥ 90% on internal eval set |
| **J8** | Share a meeting / clip with a teammate; teammate sees only what was shared | P1 → P2 | Tenant + share-scope isolation; audit-logged |
| **J9** | LMS instructor uses LTI 1.3 launch to embed AI Secretary in course; gradebook sync | P3 (educator) → P1 | LTI 1.3 deep-linking; AGS grade passback |
| **J10** | EU customer onboards; data stays in EU region; tenant-level region pin | P3 | Tenant `data_region` field enforced at storage + LLM-call layer |
| **J11** | Org admin configures retention policy (e.g. delete audio after 30 days, transcripts after 1yr) | P3 | Scheduled job enforces; audit-logged |
| **J12** | Org admin enables module-based pricing (only Sales + General modules accessible) | P3 | Per-module entitlement check at API layer |
| **J13** | Customer requests data export (GDPR DSAR) | P3 | Self-service export endpoint produces zip ≤ 24hr |

## 7. Success metrics

**Activation & engagement (leading):**

- 70% of new accounts complete J0 (upload or record a meeting) within 7 days
- 50% of activated accounts return in week 2

**Quality (output-side):**

- ≥ 80% summary "useful?" thumbs-up across modules (revisit per-vertical post-launch)
- RAG chat faithfulness ≥ 90% on internal eval set (J7)

**Reliability (system-side):**

- p95 transcription latency ≤ 6× real-time
- 99.5% pipeline success rate

**Unit economics (guardrail):**

- LLM + transcription cost < $0.40 per 30-min meeting

## 8. Pricing & packaging

**Strong recommendation — final price points subject to GTM validation. Architecture must support these *axes* regardless of final $ values.**

### Billing model

- **Primary unit:** per-seat (active users in last 30 days)
- **Secondary unit:** meeting-hour overage above tier-included allotment
- **Vertical module access:** per-tenant entitlement (boolean × 8 modules)

### Tiers

| Tier | Target | Price (illustrative) | Modules | Audio limits | Retention | Region | Auth | Topology |
|---|---|---|---|---|---|---|---|---|
| **Free** | Solo trial | $0 | General only | 5 meetings / mo | 30 days | US only | Email + Google / MS OAuth | SaaS |
| **Pro** | Solo / small team | ~$29 / seat / mo annual ($39 monthly) | General + 2 chosen verticals | 50 hr / seat / mo, then $0.50 / hr overage | 1 year | US **or** EU | + Google / MS SSO | SaaS |
| **Business** | Mid-market team | ~$59 / seat / mo annual | All 8 modules | Unlimited (fair-use) | Configurable | US **and** EU multi-region permitted | + SAML, MFA enforced | SaaS |
| **Enterprise** | Regulated / large | Custom | All 8 + roadmap modules | Unlimited | Configurable + legal-hold | All regions | Full SSO + customer IdP | SaaS, customer-owned cloud, **or** on-prem |

### Trial policy

- **Pro:** 14-day free trial, no credit card required
- **Business:** 14-day trial, sales-assisted
- **Enterprise:** scoped pilot, contract-led

### Entitlement axes (encoded in `tenant_entitlements`)

- `modules[]` — which of 8 verticals enabled
- `max_seats` — billed seat ceiling
- `max_meetings_per_month` — Free-tier guard; null on paid
- `max_audio_hours_per_seat_per_month` — overage trigger on Pro
- `retention_days_audio`, `retention_days_transcripts` — per-asset retention
- `regions[]` — which regions tenant data may live in
- `deployment_topology` — `saas` | `customer_cloud` | `on_prem`
- `sso_types[]` — `email` | `google` | `microsoft` | `saml`
- `mfa_enforced` — boolean
- `baa_signed` — boolean (gates Medical / Behavioral-Health module access)
- `custom_kms_key_id` — nullable; enables customer-managed encryption

### Add-ons

- **Bot integration for Zoom / Teams:** included Business+, available as Pro add-on (~$10 / seat / mo)
- **LTI 1.3 (LMS embed):** Business+
- **BAA-eligible Medical / BH module:** Business+ with `baa_signed = true`
- **Custom-managed keys (BYOK):** Enterprise

## 9. Non-functional / SLAs

| Concern | Target |
|---|---|
| Concurrency | 50 simultaneous transcription jobs without queue starvation; horizontally scalable |
| Storage retention | Configurable per-org; defaults: audio 90d, transcripts indefinite |
| Availability | 99.5% per region |
| **Multi-region** | **US + EU from launch.** Tenant pinned to region; storage and LLM calls region-aware |
| **GDPR** | DPA template, DSAR endpoint, consent records, right-to-erasure honored within 30d |
| **HIPAA** | BAA available for Medical / Behavioral-Health tenants. Region pin + provider-eligible chain (Anthropic via Bedrock or Azure OpenAI w/ HIPAA + AWS+BAA storage) |
| **SOC 2** | Type I targeted within 12 months of launch; Type II thereafter |
| **Accessibility** | WCAG 2.1 AA target for web + admin console at launch; mobile WCAG 2.1 AA within 6 months of GA |
| **Languages** | English + French at launch (i18next-driven); architecture supports adding locales without re-deploy |
| Auth | Email / password + Google SSO + Microsoft SSO at launch; SAML deferred to first enterprise customer ask (architecture has plugin slot) |
| **No-training constraint** | **Hard.** Provider chain documented; Anthropic API (no training default), OpenAI **only** with Zero-Data-Retention agreement, Azure OpenAI by default. Local LLMs (Ollama / llama.cpp) for fully-offline tenants |
| Encryption | TLS 1.3 in transit; AES-256 at rest. Customer-managed keys (KMS) supported |
| Audit log | Every view, share, export, delete logged. Immutable append-only with tenant scoping |
| Consent | Recording UI displays disclosure pre-mic-activation; per-org configurable consent statement; participants must acknowledge for bot-joined meetings |

## 10. Integrations — full scope

- **Calendar:** Nylas (covers Google + Microsoft + Exchange + iCloud)
- **Meeting tools:** Zoom (via Zoom Meeting SDK or Marketplace bot), Microsoft Teams (via Graph + meeting bot)
- **LMS:** LTI 1.3 (deep linking + AGS grade passback)
- **Email:** SMTP / Postmark / SES — module-pluggable
- **CRM (post-launch but architected for):** HubSpot, Salesforce, Pipedrive — webhook-based
- **Storage:** AWS S3 default; Azure Blob + GCP GCS supported via storage abstraction (enables customer-owned cloud)

## 11. Deployment topologies

All three supported by the architecture; SaaS launches first by virtue of being least gated:

1. **SaaS** — managed multi-tenant on Railway (control plane) + AWS (data plane regions: us-east-1, eu-west-1)
2. **Customer-owned cloud** — same containers, customer's AWS / Azure / GCP account; orchestrated via Terraform module + onboarding script
3. **On-premise** — Docker Compose / Helm chart; required components: Postgres, Redis, S3-compatible storage (MinIO acceptable), local Whisper, optional local LLM (Ollama)

## 12. Product commitments (non-negotiable)

These are customer-facing promises, durable across releases. The architectural mechanisms enforcing them are documented in [`docs/architecture.md`](./architecture.md).

- **Multi-LLM, no training.** Anthropic by default; OpenAI only via Zero-Data-Retention agreement; Azure OpenAI in no-training config; Ollama / local for fully-offline tenants. **Customer audio and transcripts are never sent to model-training pipelines.** Chain verified per-tenant; documented in DPA.
- **Pluggable transcription.** OpenAI Whisper API + self-hosted faster-whisper. Per-tenant routing.
- **Pluggable storage.** AWS S3 default; Azure Blob, GCS, MinIO supported — enables customer-owned-cloud and on-prem deployments without code changes.
- **Add a vertical without a deploy.** Analysis verticals are config (prompt + output schema + scoring rules), not code. The 9th, 10th, Nth vertical = config PR.
- **Region residency is enforced.** Tenant data — transcripts, audio, embeddings, LLM calls — stays in the tenant's pinned region. No cross-region data movement at any layer.
- **One artifact, three deployments.** SaaS, customer-owned cloud, and on-prem all run from the same Docker images.

## 13. External calendar gates (non-engineering — flagged for awareness)

- Zoom Marketplace approval (~2–6w)
- Microsoft Teams app publish (~1–4w)
- Apple App Store review (days, rejection cycles possible)
- GDPR DPAs with EU customers (legal cycle)
- HIPAA BAA chains with Anthropic / AWS / Azure (paperwork, days–weeks)

These don't gate development but should be initiated in parallel with build-out.

## 14. Tech stack reference

Tech stack, version pins, and architectural decisions live in [`docs/architecture.md`](./architecture.md). The PRD intentionally does **not** duplicate them — when product and architecture diverge, architecture is the source of truth and this PRD must be updated to reflect the product implications.
