# Compliance

This directory documents how AI Secretary's architecture maps to the
controls required by HIPAA, GDPR, and SOC 2. The goal is twofold:

1. **For tenants:** show prospective customers (and their auditors) the
   technical controls they can rely on when evaluating AI Secretary
   for regulated workloads.
2. **For us:** keep the controls inside the codebase — every claim
   here links to a file or migration that implements it. Drift is
   immediately visible.

## Contents

- [HIPAA controls](./hipaa.md) — Administrative + technical safeguards
  for medical-vertical tenants. Includes the BAA-eligible compliance
  posture routing matrix.
- [GDPR controls](./gdpr.md) — Lawful-basis model, Article 32 technical
  measures, DPIA outline, sub-processor list, and data-subject-rights
  workflow.
- [SOC 2 controls](./soc2.md) — Trust Services Criteria mapping
  (Security, Availability, Confidentiality, Privacy) plus the evidence
  artifacts each control produces.
- [Threat model](./threat-model.md) — STRIDE-based threat model for the
  capture → transcribe → analyze → share pipeline.
- [DPA template](./dpa-template.md) — Standard contract terms for
  customer Data Processing Addenda.

## Status

This is a **portfolio scaffold**. The controls described here are
implemented in code; the compliance program (policies, training,
auditor engagement, penetration test) is **not** in scope for the
portfolio repository.

## Where the controls actually live

| Control | Implementation |
|---|---|
| Multi-tenant isolation (RLS) | [`packages/db/rls/`](../../packages/db/rls/) — every tenant-scoped table has an enforced row-level security policy |
| Region pinning | [`packages/db/migrations/202604301901_add_tenant_state_fsm.sql`](../../packages/db/migrations/202604301901_add_tenant_state_fsm.sql) — `enforce_region_lock` trigger |
| Audit trail | [`apps/api/src/plugins/audit-logger.ts`](../../apps/api/src/plugins/audit-logger.ts) + [`packages/db/src/schema/audit-logs.ts`](../../packages/db/src/schema/audit-logs.ts) — append-only ledger; SQL-level REVOKE on UPDATE/DELETE |
| Encryption at rest (CRM tokens, secrets) | [`packages/db/src/lib/envelope-encryption.ts`](../../packages/db/src/lib/envelope-encryption.ts) — KMS-style envelope encryption with rotatable KEK |
| Provider compliance routing | [`packages/llm-gateway/src/selector.ts`](../../packages/llm-gateway/src/selector.ts) — HIPAA tenants route to AWS Bedrock; EU tenants route to Bedrock-EU |
| Consent capture (per-participant, EU explicit) | [`packages/consent/`](../../packages/consent/) + [`docs/decisions/0005-consent-legal-basis-and-diarization-exclusion.md`](../decisions/0005-consent-legal-basis-and-diarization-exclusion.md) |
| Right to erasure cascade | [`apps/api/src/lib/erasure-cascade.ts`](../../apps/api/src/lib/erasure-cascade.ts) — every tenant-scoped table registered with its erasure strategy; DSAR worker walks the registry |
| DSAR self-service | [`apps/api/src/routes/dsar.ts`](../../apps/api/src/routes/dsar.ts) + [`apps/api/src/routes/dsar-portal.ts`](../../apps/api/src/routes/dsar-portal.ts) (public) |
| Tenant lifecycle FSM + DPA gate | [`docs/decisions/0004-tenant-lifecycle-fsm-and-dpa-gate.md`](../decisions/0004-tenant-lifecycle-fsm-and-dpa-gate.md) + [`apps/api/src/plugins/tenant-state-check.ts`](../../apps/api/src/plugins/tenant-state-check.ts) |
| Cross-tenant audit (no RLS bypass) | [`docs/decisions/0006-cross-tenant-audit-via-inbound-shares.md`](../decisions/0006-cross-tenant-audit-via-inbound-shares.md) |
