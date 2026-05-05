# ADR 0004: Tenant lifecycle state machine + blocking DPA / region pin

## Status

`PROPOSED`

> Partially validated. Trial-fields extension (FR81) is shipped;
> `packages/db/migrations/202604301015_extend_tenants_trial.sql`
> exists; `tenant.trial-*` audit actions are wired. The full
> `tenant_state` enum + `tenant-state-check` plugin + tenants/me
> routes are NOT yet shipped — promote to `ACCEPTED` after the
> F2-admin onboarding flow lands.

## Date

2026-04-29

## Context

The UX spec § F2-admin describes a blocking onboarding sequence
(DPA → region → disclosure → retention → modules → integrations →
SSO → invite). The architecture document mentions tenants and
entitlements but does not specify a state machine, the field set
recording acceptance, or the gating mechanism that prevents
recording-pipeline use before DPA acceptance + region pin. Without
both fields and gates, admins could enqueue meetings before
compliance preconditions are met.

## Decision

We will model tenant lifecycle as a Postgres enum
(`tenant_state`) with values: `draft`, `dpa_required`, `dpa_accepted`,
`region_pinning`, `provisioning`, `active`, `suspended`, `exporting`,
`closing`, `closed`. The `tenants` table gains `state`, `data_region`,
`region_locked_at`, `dpa_version`, `dpa_accepted_at`,
`dpa_accepted_by_user_id`. A trigger enforces region immutability
once `region_locked_at` is set. A new `tenant_settings` table
captures disclosure text, retention defaults, consent legal basis
(per-region default), and policy flags. A new
`tenant-state-check` Fastify plugin rejects mutating recording-
pipeline routes when state is not in `{active, provisioning}`.
Capability unlocks progressively as provisioning steps complete.
State `active` is reached automatically when disclosure is set,
retention is set, and ≥1 module is enabled.

### Trial-fields extension (added 2026-04-29 per readiness review Gap-EC2 / FR81)

Trial state is **orthogonal** to the lifecycle FSM. We use separate
`trial_*` fields on `tenants` rather than enum-bloating `tenant_state`
— a tenant in `provisioning` or `active` can also be in a trial
sub-state. Trial-end transitions:

| Trial kind | Card on file | Action |
|---|---|---|
| `pro` | true | Stripe auto-converts; `trial_kind` → null; tenant continues `active` |
| `pro` | false | `trial_expired_at = now()`; recording-pipeline mutations 402; read + DSAR + admin retained |
| `business` | n/a | Sales-assisted; admin sees "talk to sales" CTA |
| `enterprise_pilot` | n/a | Custom expiration; `trial_extended_until` manual override |

Audit actions: `tenant.trial-started`, `tenant.trial-reminder-sent`,
`tenant.trial-converted`, `tenant.trial-expired`,
`tenant.trial-extended`.

## Consequences

### Positive

- Compliance preconditions (DPA + region) cannot be skipped.
- Audit log captures the full provisioning trail.
- Region-immutability is enforced in the DB, not just at the API
  layer (defense in depth).
- Onboarding UX has a single source of truth for "what's next?"
  via `GET /v1/tenants/me/state`.

### Negative

- One more enum to migrate when adding states (e.g. trial-expired).
- Region-change requires support intervention + dedicated tenant-
  migration job (acceptable given GDPR pinning).
- Tenant-state plugin adds one more middleware hop on every mutating
  request.

### Neutral

- `tenant_entitlements` (existing) is not folded into
  `tenant_settings` — entitlements are billing-driven; settings are
  admin-driven. Different write paths.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Boolean flags (dpa_accepted, region_set, etc.) | Doesn't capture order; doesn't gate capability; doesn't model suspension/export/close. State machine is the right shape. |
| Application-layer state only | DB-level enum + trigger ensures region immutability survives a buggy admin route. Defense in depth. |
| Defer state machine until enterprise customer | Per UX spec, admin onboarding is Day-1; DPA gate is non-negotiable. |
| Fold trial state into `tenant_state` enum | Loses orthogonality — a tenant transitioning `trialing` → `active` can't be distinguished from `provisioning` → `active`, and trial-state would be lost during state changes. |

## Related

- Architecture sections: `docs/architecture.md` § Authentication &
  Security, § Authorization, § Cross-Cutting Concerns (Tenant +
  region context, Audit logging)
- UX spec § F2-admin
- Addendum source: `_bmad-output/planning-artifacts/arch-addendums.md` § 4
- ADR-0005 (consent legal basis; lives in tenant_settings)
- ADR-0006 (cross-tenant audit; reads `tenant_settings.cross_org_share_policy`)

## Notes

DPA versioning lets us track acceptance of new contract terms. When
legal updates the DPA, all tenants flip to a banner state requiring
re-acceptance for new mutations (read-only otherwise).
