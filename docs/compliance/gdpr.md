# GDPR Controls

This document maps AI Secretary's architecture to the General Data
Protection Regulation (Regulation 2016/679), applied to EU-resident
data subjects whose meeting content lands in the platform.

AI Secretary acts as a **processor** with respect to tenant data and
as a **controller** with respect to its own service-tenant
relationships (billing, login telemetry).

## Article 5 — Principles

| Principle | How we honor it |
|---|---|
| Lawfulness, fairness, transparency (Art. 5(1)(a)) | Consent capture before recording; pre-recording disclosure modal; `tenant_settings.disclosure_text_*` editable per-tenant + per-locale |
| Purpose limitation (Art. 5(1)(b)) | Each meeting carries a vertical-specific module; LLM gateway prompts are scoped; data is not used for training |
| Data minimization (Art. 5(1)(c)) | Diarization-aware exclusion: speakers without granted consent have their text suppressed before reaching the LLM gateway |
| Accuracy (Art. 5(1)(d)) | Tenants can edit transcripts (Story TBD); audit log captures every edit |
| Storage limitation (Art. 5(1)(e)) | Per-tenant retention policy in `tenant_settings.retention_*`; expiry job sweeps the recordings + transcripts tables |
| Integrity + confidentiality (Art. 5(1)(f)) | TLS 1.3 in transit; AES-256-GCM at rest for secrets; row-level security at tenant boundary |
| Accountability (Art. 5(2)) | Audit log is append-only at the SQL level; DSAR pipeline produces a verifiable export of all rows for any user |

## Article 6 — Lawful basis for processing

AI Secretary supports two lawful-basis models per ADR-0005:

| Model | When | Article 6 basis |
|---|---|---|
| `legitimate-interest` | US/non-EU tenants without EU participants | Art. 6(1)(f) — legitimate interests of the controller |
| `explicit-consent` | EU tenants OR any meeting with an EU participant | Art. 6(1)(a) — consent + Art. 7 (form) |

The selection is per-participant, not per-tenant. A US tenant that
hosts a meeting with an EU participant must obtain explicit consent
from that participant; the diarization handler suppresses any speaker
who has not granted consent (the `consents` row's `decision` column).

## Article 7 — Conditions for consent

| Requirement | Implementation |
|---|---|
| Demonstrable (Art. 7(1)) | `consents` table stores the consent decision + evidence JSONB (UI version, IP address, timestamp, prompt copy hash) |
| Distinguishable (Art. 7(2)) | Pre-recording modal is dedicated to the consent decision; not bundled with TOS acceptance |
| Right to withdraw (Art. 7(3)) | DSAR portal at `/data-rights` accepts `kind = 'withdraw-consent'`; worker walks the `consents` table and flips decisions |
| As easy to withdraw as to give (Art. 7(3)) | Single-form public DSAR portal; no auth required (the request is verified via email) |

## Article 12–22 — Data Subject Rights

Each right has a self-service workflow:

| Article | Right | Workflow |
|---|---|---|
| Art. 15 | Access | DSAR portal `kind = 'access'` → worker assembles ZIP export from the `erasure-cascade` registry |
| Art. 16 | Rectification | In-app edit (transcript correction) OR DSAR portal `kind = 'rectification'` |
| Art. 17 | Erasure | DSAR portal `kind = 'erasure'` → worker walks the cascade strategy table; cascade/redact/shred per row |
| Art. 18 | Restriction | DSAR portal `kind = 'restrict-processing'` → flips `users.processing_restricted = true`; route gates respect this flag |
| Art. 20 | Portability | Same as Art. 15 access export — the ZIP is in machine-readable JSON |
| Art. 21 | Objection | DSAR portal `kind = 'object'` → handled identically to withdraw-consent |
| Art. 22 | Automated decision-making | AI summaries/action items are decision-support only; no decisions about a data subject are made automatically |

The DSAR portal is at [`apps/api/src/routes/dsar-portal.ts`](../../apps/api/src/routes/dsar-portal.ts).
The cascade registry is at [`apps/api/src/lib/erasure-cascade.ts`](../../apps/api/src/lib/erasure-cascade.ts).
The export worker is at [`apps/workers/src/handlers/dsar-export.ts`](../../apps/workers/src/handlers/dsar-export.ts).

## Article 25 — Data protection by design and by default

| Control | Implementation |
|---|---|
| Privacy as the default setting | New tenants land in `dpa_required` state; no recording-pipeline mutations are allowed until DPA accepted + region pinned |
| Pseudonymization | User IDs are UUIDs; logs strip PII (CLAUDE.md anti-pattern: "Never log passwords, JWTs, raw audio, full transcripts") |
| Data minimization at storage | Pre-LLM redaction of speakers without granted consent; transcript text never carries audio bytes |
| Confidentiality | RLS enforced on every tenant-scoped table |

## Article 28 — Processor obligations

AI Secretary's standard DPA (see [`dpa-template.md`](./dpa-template.md))
covers Art. 28(3)(a)–(h):

- (a) Documented instructions only
- (b) Confidentiality commitments from staff
- (c) Article 32 security measures (see below)
- (d) Sub-processor authorization (general written authorization with notice)
- (e) Assistance with data-subject rights
- (f) Assistance with breach notification
- (g) Return or deletion at end of contract
- (h) Audit support

## Article 30 — Records of processing activities (ROPA)

AI Secretary maintains a ROPA covering:

- Categories of data subjects (tenant employees, meeting participants, external recipients of shared content)
- Categories of personal data (audio, transcript, name, email, employer)
- Recipients (tenant admins, designated meeting participants, external recipients with shared receipts)
- Transfers to third countries (US-EU SCC; AWS Bedrock EU for EU tenants)
- Retention periods (per `tenant_settings.retention_*`)
- Article 32 measures (below)

The ROPA is generated automatically by the audit-export job for any
tenant requesting evidence; the tenant can ship it to its supervisory
authority.

## Article 32 — Security of processing

| Measure | Implementation |
|---|---|
| Pseudonymization + encryption | TLS 1.3 in transit; AES-256-GCM at rest for secrets; envelope encryption with rotatable KEK |
| Confidentiality, integrity, availability, resilience | RLS (confidentiality); GCM auth tags + DB constraints (integrity); multi-AZ Postgres + S3 versioning (availability + resilience) |
| Restoration of availability + access | Postgres PITR; documented runbooks |
| Regular testing of effectiveness | Test suite includes 1700+ tests; CI provider-isolation gates; envelope-encryption test ensures roundtrip + tamper-detection |

## Article 33–34 — Breach notification

- 72-hour notice to supervisory authority (Art. 33)
- Without undue delay to data subjects when high risk (Art. 34)

The breach-notification workflow uses the same notifications gateway;
new notification kind: `breach-notification`. Tenants can configure
their authority contact in `tenant_settings.dpo_email`.

## Article 35 — Data Protection Impact Assessment (DPIA)

A DPIA is required when processing is "likely to result in a high risk
to the rights and freedoms of natural persons." AI Secretary's medical
+ HR + psychology verticals trigger this threshold. See
[`docs/compliance/dpia-medical.md`](./dpia-medical.md) (TODO — landing in
Story 12.5).

## Article 44–49 — Cross-border transfers

EU tenants are region-pinned to AWS eu-west-1. The region pin is
enforced both in the application layer (`tenant-state-check` plugin
rejects mutations from EU tenants on US infrastructure) and at the DB
layer (the `enforce_region_lock` trigger raises an exception if anyone
tries to flip `tenants.region` after the lock).

When a cross-region transfer is genuinely required (e.g., a US tenant
with one EU participant), the EU participant's audio is transcribed via
the EU-region service (Bedrock EU + Azure OpenAI EU + Voyage EU) and
then surfaced back to the US tenant's analysis pipeline as a
text-only artifact under SCC.

See ADR-0006 for the cross-tenant audit pattern, which honors the
region pin even when shares cross orgs.

## Sub-processors

| Vendor | Purpose | Region(s) | DPA / SCC |
|---|---|---|---|
| Railway (PaaS) | Hosting + Postgres + Redis | US, EU | DPA signed; SCC for EU |
| Anthropic | LLM (Claude) | US, EU (via Bedrock) | DPA signed |
| AWS (S3, SES, Bedrock) | Object storage, transactional email, regulated LLM | us-east-1, eu-west-1 | DPA + SCC + BAA |
| OpenAI | Embeddings (non-HIPAA) | US | DPA + SCC; ZDR |
| Azure | OpenAI (HIPAA + EU), Speech (HIPAA) | us-east-2, swedencentral | DPA + SCC + BAA |
| Voyage AI | EU embeddings (BYOK) | EU | DPA + SCC |
| Postmark | Transactional email (non-HIPAA) | US | DPA + SCC |
| Stripe | Billing | US | DPA + SCC |
| Sentry | Error tracking | US | DPA + SCC; PII redaction |
| PostHog | Product analytics | EU (cloud) | DPA + SCC |

The list is current as of `2026-05-05`. Tenants are notified 30 days
before a new sub-processor is engaged (Art. 28(2) general written
authorization with reservation).

## What GDPR does not relax

- Even with the DPA in place, AI Secretary cannot accept EU patient
  data into a HIPAA-only tenant. The compliance posture must be
  `hipaa-eu` (BAA + SCC), not just `hipaa`.
- Marketing telemetry (PostHog) excludes meeting content entirely;
  events carry tenant ID + page view only.
