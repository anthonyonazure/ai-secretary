# SOC 2 Controls

This document maps AI Secretary's architecture to the AICPA Trust
Services Criteria (TSC 2017, with 2022 points of focus). Scope:
**Security**, **Availability**, **Confidentiality**, and **Privacy**.
**Processing Integrity** is in scope but not yet documented.

## Common Criteria (CC)

### CC1 — Control Environment

| Point of focus | Implementation |
|---|---|
| CC1.1 — Integrity + ethical values | Code-of-conduct in [`docs/policies/code-of-conduct.md`](../policies/) (TODO) |
| CC1.2 — Board oversight | Out of scope (operational) |
| CC1.3 — Org structure | Out of scope (operational) |
| CC1.4 — Commitment to competence | New-hire onboarding includes security training (TODO) |
| CC1.5 — Accountability | Audit log captures every state-changing action with `actor_user_id` |

### CC2 — Communication and Information

| Point of focus | Implementation |
|---|---|
| CC2.1 — Internal communication | `_bmad-output/planning-artifacts/` is the source of truth for product + architecture decisions |
| CC2.2 — Internal communication of policies | Slack + GitHub `CODEOWNERS`; security policy lives in this repo |
| CC2.3 — External communication | Status page + tenant admin email for incidents |

### CC3 — Risk Assessment

| Point of focus | Implementation |
|---|---|
| CC3.1 — Specifies objectives | Architecture document section "Compliance posture routing" |
| CC3.2 — Identifies risks | [Threat model](./threat-model.md) (STRIDE) |
| CC3.3 — Considers fraud | Audit log + anomaly detection on `auth.failed-login` |
| CC3.4 — Identifies + assesses change | ADR process: every architectural change is recorded in `docs/decisions/` |

### CC4 — Monitoring Activities

| Point of focus | Implementation |
|---|---|
| CC4.1 — Selects, develops, performs | pino → Grafana Cloud (Loki + Tempo + Mimir); Sentry for errors |
| CC4.2 — Evaluates + communicates | On-call rotation receives alerts; weekly review of `audit-export` |

### CC5 — Control Activities

| Point of focus | Implementation |
|---|---|
| CC5.1 — Selects + develops control activities | This document; ADR process |
| CC5.2 — Selects + develops technology controls | RLS, TLS 1.3, envelope encryption, audit log immutability |
| CC5.3 — Deploys through policies + procedures | Runbooks in [`docs/runbook/`](../runbook/) |

### CC6 — Logical and Physical Access

| Point of focus | Implementation |
|---|---|
| CC6.1 — Logical access | JWT + Argon2id passwords + optional MFA TOTP |
| CC6.2 — User identification + auth | UUID `users.id`; OAuth (Google + Microsoft) optional |
| CC6.3 — User access provisioning | Tenant admin invites via Story 1.5d; org-admin role separation |
| CC6.4 — Restricts physical access | Inherited from Railway / AWS / Azure |
| CC6.5 — Manages additions, removals | Deactivation flow flips `users.role`; refresh tokens revoked |
| CC6.6 — Restricts external access | TLS 1.3; CORS allowlist; rate-limit middleware |
| CC6.7 — Restricts unauthorized + unauthorized data | RLS enforced on every tenant-scoped table |
| CC6.8 — Prevents + detects unauthorized software | OS-level (managed PaaS); CSP on web |

### CC7 — System Operations

| Point of focus | Implementation |
|---|---|
| CC7.1 — Detects + monitors changes | GitHub branch protection; required CI gates (typecheck + lint + tests + provider isolation) |
| CC7.2 — Monitors performance + capacity | Grafana Mimir; Postgres connection pool metrics |
| CC7.3 — Detects + responds to security events | Sentry alerts on `recording.at-risk`; on-call rotation |
| CC7.4 — Responds to identified incidents | [Incident response runbook](../runbook/incident-response.md) (TODO) |
| CC7.5 — Recovers from incidents | Postgres PITR; S3 versioning |

### CC8 — Change Management

| Point of focus | Implementation |
|---|---|
| CC8.1 — Authorizes, designs, develops, tests, approves, implements | PR review required; ADR process for architectural changes; CI must pass |

### CC9 — Risk Mitigation

| Point of focus | Implementation |
|---|---|
| CC9.1 — Mitigates risks | Compensating controls documented in threat model |
| CC9.2 — Risks of business partners | Sub-processor list + DPA review |

## Availability (A)

| Criterion | Implementation |
|---|---|
| A1.1 — Capacity | Auto-scale workers via Railway; pg-boss queue depth alerts |
| A1.2 — Backup + recovery | Postgres PITR (Railway); S3 versioning |
| A1.3 — Recovery procedures | [DR runbook](../runbook/disaster-recovery.md) (TODO); RPO 5 min, RTO 1 hour |

## Confidentiality (C)

| Criterion | Implementation |
|---|---|
| C1.1 — Identifies + maintains confidential info | Tenant data classified at the row level; PII fields tagged in DSAR cascade |
| C1.2 — Disposes of confidential info | Erasure cascade strategies: cascade / soft-delete / shred / redact |

## Privacy (P)

The Privacy criteria substantially overlap with GDPR. See [GDPR
controls](./gdpr.md) for the implementation; SOC 2 Privacy maps as
follows:

| Criterion | GDPR equivalent |
|---|---|
| P1 — Notice + communication | Art. 13 + 14 — disclosure modal + privacy policy |
| P2 — Choice + consent | Art. 6 + 7 — per-participant consent FSM |
| P3 — Collection | Art. 5(1)(c) — diarization-aware exclusion |
| P4 — Use, retention, disposal | Art. 5(1)(e) + Art. 17 — retention policy + erasure cascade |
| P5 — Access | Art. 15 — DSAR access export |
| P6 — Disclosure to 3rd parties | Art. 28 — sub-processor list + DPA |
| P7 — Quality | Art. 5(1)(d) — transcript editing |
| P8 — Monitoring + enforcement | Audit log + DSAR portal verifications |

## Evidence artifacts

A SOC 2 audit needs evidence. Each control above produces verifiable
output:

| Control | Evidence |
|---|---|
| CC5.2 — Provider isolation | CI run logs from `pnpm --filter @aisecretary/llm-gateway check:isolation` (etc.) |
| CC6.1 — Logical access | `audit_logs` filtered by `action LIKE 'auth.%'` |
| CC6.6 — External access restriction | Cloudflare/Railway TLS report; CORS allowlist diff in `apps/api/src/server.ts` |
| CC6.7 — Unauthorized data | `packages/db/rls/*.sql` files + the `enforce_region_lock` trigger |
| CC7.1 — Change monitoring | GitHub PR review + CI logs; required-checks settings dump |
| CC7.3 — Security event detection | Sentry export + Grafana dashboards |
| C1.2 — Disposal | DSAR worker logs + `audit_logs` filtered by `action LIKE 'dsar.%'` |

## Mapping to portfolio scope

For the portfolio, the **technical controls are real and verifiable in
code**. The **operational controls** (training, on-call rotation,
auditor engagement, penetration test, business continuity exercise)
are explicitly out of scope for the portfolio repository — they're
where a real engineering org would invest the next 6 months of time
on top of this codebase.
