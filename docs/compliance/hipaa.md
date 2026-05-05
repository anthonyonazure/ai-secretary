# HIPAA Controls

This document maps AI Secretary's architecture to the HIPAA Security
Rule's technical and administrative safeguards (45 CFR § 164.308–318).
It assumes a covered-entity tenant has signed our Business Associate
Agreement (BAA); without a BAA, healthcare meeting content must not
flow through the system.

## Scope

AI Secretary handles Protected Health Information (PHI) when a tenant
in the medical, behavioral-health, or psychology verticals captures
sessions with patients or clients. PHI may appear in:

- Audio recordings (`recordings.storage_key` → S3 object)
- Transcripts (`speaker_turns.text`)
- AI-generated summaries + action items (`module_outputs.body`)
- Citations + RAG-chat answers
- Audit metadata (`audit_logs.metadata` — name, email, action)

PHI does **not** appear in:

- Tenant configuration (`tenants`, `tenant_settings`, `tenant_entitlements`)
- Authentication tokens (JWT claims carry user ID + tenant ID + region only)
- Aggregated metrics (no patient-level data leaves the data plane)

## Compliance posture routing

A tenant whose `tenant_settings.compliance_posture = 'hipaa'` triggers
a different provider matrix throughout the LLM/transcription/storage
pipeline:

| Service | Default (US tenant) | HIPAA (BAA covered) |
|---|---|---|
| Chat / summarize / extract action items | Anthropic direct API | Anthropic via **AWS Bedrock** (BAA) |
| Transcription | OpenAI Whisper API | Self-hosted **faster-whisper** in our VPC OR Azure Speech (BAA) |
| Embeddings | `text-embedding-3-small` (OpenAI) | Azure OpenAI embeddings (BAA) OR self-hosted `bge-m3` |
| Storage | AWS S3 us-east-1 | AWS S3 us-east-1 (BAA covered service) |
| Database | Postgres / Railway | Postgres / Railway (BAA covered) |
| Email | Postmark | AWS SES (BAA covered) |
| Push | Expo / FCM | (Disabled — push payloads can't carry PHI) |

The routing is enforced in code:

- [`packages/llm-gateway/src/selector.ts`](../../packages/llm-gateway/src/selector.ts) — selects Bedrock for `compliance_posture = 'hipaa'`
- [`packages/transcription/src/selector.ts`](../../packages/transcription/src/selector.ts) — refuses Whisper API for HIPAA tenants
- [`packages/notifications/src/gateway.ts`](../../packages/notifications/src/gateway.ts) — disables push channel for HIPAA tenants

## § 164.308 — Administrative Safeguards

| Control | Implementation |
|---|---|
| § 164.308(a)(1)(ii)(D) — Information system activity review | Append-only `audit_logs` table; weekly review of `audit-export` reports |
| § 164.308(a)(3)(ii)(B) — Workforce clearance | Out of scope (operational) |
| § 164.308(a)(3)(ii)(C) — Termination procedures | User-deactivation flow (Story 12.x) flips `users.role = 'deactivated'`; refresh tokens revoked at the Redis layer |
| § 164.308(a)(4)(i) — Information access management | Role-based access via `tenant_members.role`; super-admin separation per `users.role = 'super_admin'` |
| § 164.308(a)(5)(ii)(B) — Protection from malicious software | OS-level (Railway-managed); we run unprivileged Node containers |
| § 164.308(a)(5)(ii)(C) — Log-in monitoring | Auth attempts logged via `auth.failed-login` audit action; rate-limit middleware |
| § 164.308(a)(5)(ii)(D) — Password management | Argon2id hashing in [`packages/auth/`](../../packages/auth/); MFA TOTP via Story 1.5c |
| § 164.308(a)(6)(i) — Security incident procedures | See [`docs/runbook/incident-response.md`](../runbook/) (per BAA Appendix B) |
| § 164.308(a)(7)(ii)(A) — Data backup plan | Postgres point-in-time recovery (Railway-managed); S3 versioning enabled |
| § 164.308(a)(7)(ii)(B) — Disaster recovery | Multi-AZ Postgres; S3 cross-region replication for HIPAA-tier tenants |
| § 164.308(b) — Business Associate Contracts | Signed with: Anthropic (Bedrock), Azure (OpenAI + Speech), AWS (S3, SES), Railway |

## § 164.310 — Physical Safeguards

| Control | Implementation |
|---|---|
| § 164.310(a)(1) — Facility access | Inherited from cloud providers (Railway, AWS, Azure SOC 2 / ISO 27001) |
| § 164.310(c) — Workstation security | Out of scope (BYOD/customer responsibility) |
| § 164.310(d)(1) — Device + media controls | S3 object lifecycle policies; encrypted at rest (AES-256) |

## § 164.312 — Technical Safeguards

| Control | Implementation |
|---|---|
| § 164.312(a)(1) — Access control / unique user identification | UUID `users.id`; no shared accounts |
| § 164.312(a)(2)(i) — Unique user identification | Same |
| § 164.312(a)(2)(iii) — Automatic logoff | Access token TTL 15 min; refresh-token rotation |
| § 164.312(a)(2)(iv) — Encryption + decryption | AES-256-GCM envelope encryption for at-rest secrets ([`envelope-encryption.ts`](../../packages/db/src/lib/envelope-encryption.ts)); TLS 1.3 in transit |
| § 164.312(b) — Audit controls | `audit_logs` append-only; immutable at SQL level (REVOKE UPDATE,DELETE FROM app_role) |
| § 164.312(c)(1) — Integrity | GCM auth tags on encrypted fields; database constraints on FK + enum columns |
| § 164.312(d) — Person + entity authentication | JWT (HS256) signed by per-region secret; MFA TOTP optional, can be required at tenant level |
| § 164.312(e)(1) — Transmission security | TLS 1.3 for all traffic; mTLS internal to data plane (Railway private networking) |
| § 164.312(e)(2)(i) — Integrity controls (transmission) | TLS 1.3 with cipher suite restrictions |
| § 164.312(e)(2)(ii) — Encryption (transmission) | TLS 1.3; HSTS preload on `*.aisecretary.app` |

## Patient consent (§ 164.508 alignment)

HIPAA generally permits use + disclosure for treatment, payment, and
operations without explicit authorization. However, **AI Secretary
adopts a stricter consent posture for medical tenants**: per-participant
explicit consent is required for any session that will be transcribed,
and an EU participant's presence triggers GDPR Article 7 explicit
consent regardless of the other participants' US residency.

Consent capture is enforced at multiple layers:

- Pre-recording UI modal (web + mobile) with org-configurable disclosure
- Bot meetings: TTS disclosure on join + chat post + per-participant
  timestamp record in `consents`
- Routes that mutate the recording pipeline call the `consent-check`
  Fastify plugin, which returns 403 when no `consents` row exists for
  the meeting

See [ADR-0005](../decisions/0005-consent-legal-basis-and-diarization-exclusion.md)
for the full per-participant consent FSM.

## Breach notification

If a security incident affects PHI and meets the HIPAA breach-notification
threshold (45 CFR § 164.402), AI Secretary notifies the affected covered
entity within **24 hours** of confirmation (more strict than the
60-day statutory window). The notification flow is the same Story 14.1
DSAR notification pipeline; new notification kind: `breach-notification`.

## What HIPAA does not cover

- AI Secretary's BAA is with the tenant organization, not with individual
  patients. Patient-side rights (access, amendment, accounting of
  disclosures) flow through the covered-entity tenant.
- Sub-processors must each have a BAA with us; the [sub-processor list](./gdpr.md#sub-processors) is maintained in the GDPR doc and applies to HIPAA equally.
