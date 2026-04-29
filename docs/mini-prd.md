# AI Secretary System — Product Spec (locked-in for architecture)

**Status:** LOCKED — 2026-04-29. No phased delivery; architecture must accommodate full scope from Day 1.
**Note:** Earlier draft used Phase 1/2/3 framing — discarded. AI-assisted development pace makes phasing unnecessary; we architect for completeness and ship features in parallel.

---

## 1. Product positioning

**AI Secretary turns any meeting — recorded on phone, laptop, or pulled from Zoom/Teams — into a structured, searchable knowledge asset with vertical-specific analysis (sales, HR, education, medical, customer support, project management, psychology, general), without sending customer audio to model-training pipelines.**

## 2. Competitive landscape

| Competitor | Strength | Gap we exploit |
|---|---|---|
| Otter.ai | Cheap transcription | No vertical analysis, weak privacy |
| Fathom / tl;dv | Slick Zoom UX | Zoom-only, no in-person/mobile, no RAG |
| Fireflies.ai | CRM integrations | Sales-only |
| Read.ai | Sentiment + meeting health | Closed analysis, no customer-cloud |
| Upheal *(Kamee uses)* | Excellent clinical | Single vertical, no enterprise admin |
| Granola | Beautiful note UX | No backend search, single-user |

**Wedge:** modular vertical analysis + recording works anywhere + privacy/compliance Day-1 + multi-LLM (incl. local) + customer-cloud option.

## 3. Personas / verticals — full scope

All 8 analysis modules are in scope from the start, implemented as **plugins** against a shared core:

1. **General** — fallback for any meeting type
2. **Sales** — talk-ratio, objections, next-step clarity, deal-risk score, CRM-ready summary
3. **HR / Hiring** — competency rubric scoring, behavioral signals, decision-recommendation
4. **Education** — engagement signals, learning-objective coverage, student participation breakdown
5. **Medical / Behavioral Health** — clinical note draft (SOAP), screening prompts, risk flags. Heavier compliance posture (HIPAA/BAA-ready)
6. **Customer Support** — issue summary, sentiment, resolution status, escalation flag
7. **Project Management** — decisions log, action items with owner+due-date, blockers, risk register entries
8. **Psychology** — therapeutic alliance signals, themes, intervention notes (overlaps with Medical; separate prompt config)

**Architectural rule:** modules are *data + prompt + output-schema*, not code. Adding the 9th vertical = author one config file, no platform changes.

## 4. User journeys (representative — full set)

| # | Journey | Acceptance |
|---|---|---|
| **J1** | Record in-person meeting on mobile-web/native, see transcript + summary + actions ≤ 3 min after stop (for ≤30 min audio) | Pipeline p95 ≤ 6× real-time; summary ≤ 60s after transcript |
| **J2** | Upload existing audio/video file ≤ 4hr / ≤ 2GB | Drag-drop on web; chunked upload; resumable |
| **J3** | Connect Zoom/Teams; bot auto-joins scheduled meetings, recording captured to AI Secretary | OAuth flow; bot joins ≤ 30s of meeting start; recording uploaded post-meeting |
| **J4** | Connect calendar (Nylas), see upcoming meetings, opt-in auto-record per meeting | Calendar sync ≤ 5 min lag; per-meeting record toggle persists |
| **J5** | Search "objections about pricing" across corpus, get ranked snippets with timestamps | p95 < 2s on 100K-meeting corpus; deep-link to transcript anchor |
| **J6** | Generate vertical-specific analysis report on a meeting (e.g. Sales report) | ≤ 90s; output validates against module schema; cites transcript spans |
| **J7** | Chat with the corpus ("show me deals where the buyer mentioned competitor X") | Grounded answers with citations; refuses ungrounded claims |
| **J8** | Share a meeting/clip with a teammate; teammate sees only what was shared | Tenant + share-scope isolation; audit-logged |
| **J9** | LMS instructor uses LTI 1.3 launch to embed AI Secretary in course; grade book sync | LTI 1.3 deep-linking; AGS grade passback |
| **J10** | EU customer onboards; data stays in EU region; tenant-level region pin | Tenant `data_region` field enforced at storage + LLM-call layer |
| **J11** | Org admin configures retention policy (e.g. delete audio after 30 days, transcripts after 1yr) | Scheduled job enforces; audit-logged |
| **J12** | Org admin enables module-based pricing (only Sales + General modules accessible) | Per-module entitlement check at API layer |
| **J13** | Customer requests data export (GDPR DSAR) | Self-service export endpoint produces zip ≤ 24hr |

## 5. Success metrics

- 70% of new accounts upload a meeting within 7 days
- 50% activated accounts return W2
- ≥ 80% summary "useful?" thumbs-up
- p95 transcription latency ≤ 6× real-time
- 99.5% pipeline success rate
- LLM+transcription cost < $0.40 per 30-min meeting

## 6. Non-functional / SLAs

| Concern | Target |
|---|---|
| Concurrency | 50 simultaneous transcription jobs without queue starvation; horizontally scalable |
| Storage retention | Configurable per-org; defaults: audio 90d, transcripts indefinite |
| Availability | 99.5% per region |
| **Multi-region** | **US + EU from launch.** Tenant pinned to region; storage and LLM calls region-aware |
| **GDPR** | DPA template, DSAR endpoint, consent records, right-to-erasure honored within 30d |
| **HIPAA** | BAA available for Medical/Behavioral-Health tenants. Region pin + provider-eligible chain (Anthropic via Bedrock or Azure OpenAI w/ HIPAA + AWS+BAA storage) |
| Auth | Email/password + Google SSO + Microsoft SSO at launch; SAML for enterprise |
| **No-training constraint** | **Hard.** Provider chain documented; Anthropic API (no training default), OpenAI **only** with Zero-Data-Retention agreement, Azure OpenAI by default. Local LLMs (Ollama/llama.cpp) for fully-offline tenants |
| Encryption | TLS 1.3 in transit; AES-256 at rest. Customer-managed keys (KMS) supported |
| Audit log | Every view, share, export, delete logged. Immutable append-only with tenant scoping |
| Consent | Recording UI displays disclosure pre-mic-activation; per-org configurable consent statement; participants must acknowledge for bot-joined meetings |

## 7. Integrations — full scope

- **Calendar:** Nylas (covers Google + Microsoft + Exchange + iCloud)
- **Meeting tools:** Zoom (via Zoom Meeting SDK or Marketplace bot), Microsoft Teams (via Graph + meeting bot)
- **LMS:** LTI 1.3 (deep linking + AGS grade passback)
- **Email:** SMTP / Postmark / SES — module-pluggable
- **CRM (post-launch but architected for):** HubSpot, Salesforce, Pipedrive — webhook-based
- **Storage:** AWS S3 default; Azure Blob + GCP GCS supported via storage abstraction (enables customer-owned cloud)

## 8. Deployment topologies

All three supported by the architecture; SaaS launches first by virtue of being least gated:

1. **SaaS** — managed multi-tenant on Railway (control plane) + AWS (data plane regions: us-east-1, eu-west-1)
2. **Customer-owned cloud** — same containers, customer's AWS/Azure/GCP account; orchestrated via Terraform module + onboarding script
3. **On-premise** — Docker Compose / Helm chart; required components: Postgres, Redis, S3-compatible storage (MinIO acceptable), local Whisper, optional local LLM (Ollama)

## 9. Hard architectural constraints (non-negotiable)

- **LLM provider abstraction Day 1.** No direct SDK calls outside the gateway.
- **Transcription engine abstraction Day 1.** No direct Whisper-API calls outside the engine.
- **Storage abstraction Day 1.** No direct S3 SDK calls outside the storage layer.
- **Module = config, not code.** New vertical = no platform deploy.
- **Tenant region pin enforced at every data path.** No cross-region leakage.
- **No customer audio/transcripts in any training pipeline.** Provider contract verified per-tenant.

## 10. External calendar gates (non-engineering — flagged for awareness)

- Zoom Marketplace approval (~2–6w)
- Microsoft Teams app publish (~1–4w)
- Apple App Store review (days, rejection cycles possible)
- GDPR DPAs with EU customers (legal cycle)
- HIPAA BAA chains with Anthropic/AWS/Azure (paperwork, days–weeks)

These don't gate development but should be initiated in parallel with build-out.

## 11. Locked-in tech defaults (subject to architectural validation in next steps)

- **API runtime:** Node.js + Fastify + TypeScript (matches Helmpoint365, GrantOwl, CyberPulse precedents)
- **DB:** PostgreSQL 16 + Drizzle ORM
- **Queue:** pg-boss (PostgreSQL-native, simplifies infra)
- **Storage:** S3 (with abstraction)
- **Frontend (web):** React 19 + Vite + shadcn/ui
- **Mobile:** start with PWA; native React Native added in parallel work-stream
- **Hosting:** Railway (control plane) initially; AWS for data-plane regions
- **LLM gateway:** custom thin abstraction (Anthropic + OpenAI + Azure OAI + Ollama)
- **Transcription:** OpenAI Whisper API + self-hosted faster-whisper (engine abstraction)
- **Vector store for RAG:** pgvector (PostgreSQL extension — keeps infra count low)
- **Auth:** Lucia or hand-rolled bcrypt+JWT (matching Helmpoint365 pattern)
