# ADR 0006: Cross-tenant audit writes via tenant-scoped `inbound_shares` table

## Status

`ACCEPTED`

## Date

2026-04-29 (proposed) → 2026-05-05 (accepted; cross-org policy +
inbound-shares first-implementation validates)

## Context

FR74 + UX U32 require that a share originating in one AI Secretary
tenant and targeted at a recipient in another AI Secretary tenant
appears in the receiving tenant's audit / activity surface ("shared
from acme.com") and is gated by the receiving-org admin's
accept-policy at view-time. Story 8.4 calls for "Receiving-tenant
audit-log entry written"; Story 12.7 calls for view-time enforcement
of the policy.

The architecture's audit discipline (`docs/architecture.md` §
Authentication & Security; § Schema invariants) makes every
tenant-scoped table — including `audit_logs` — RLS-protected by
`tenant_id = current_setting('app.current_tenant_id')::uuid`. The
`audit-logger` plugin runs under the sender's tenant context. A direct
INSERT into the receiving tenant's `audit_logs` from the sender's
context violates RLS. Three options exist: (a) a privileged service
path that bypasses RLS for cross-tenant writes; (b) a tenant-scoped
`inbound_shares` table on the receiving tenant, written by a
receiver-region worker under the receiver's tenant context; (c) a
platform-scoped `cross_org_share_events` table outside any tenant's
RLS scope.

## Decision

We will introduce `inbound_shares` — a first-class, tenant-scoped
table on the receiving tenant — and an asynchronous receiver-region
delivery job (`share.cross-org-deliver`) that writes the row under
the receiver's tenant + region context. The sender records its own
outbound event (`share.cross-org-sent`) in its own `audit_logs` as a
normal in-tenant write. The receiving-org admin's audit timeline
surfaces both via a UNION view (`v_tenant_audit_timeline`).
View-time enforcement reads `tenant_settings.cross_org_share_policy`
+ `cross_org_share_whitelist` (introduced in ADR-0004), updates the
`inbound_shares` status, and writes a `share.cross-org-blocked-by-policy`
or `share.cross-org-accepted` audit row through the standard
`audit-logger` plugin under receiver context. No RLS bypass exists
anywhere in the path. `inbound_shares` is append-only from the app
role; status transitions go through a SECURITY INVOKER stored proc.

## Consequences

### Positive

- The strongest invariant in the architecture (RLS on every
  tenant-scoped table) is preserved without exception.
- Cross-tenant writes are explicit, queryable, and auditable as
  first-class data, not as a side effect of a privileged path.
- The cross-region case (US ↔ EU) is handled by the receiver-region
  worker, keeping audit writes inside the data plane that owns them.
  No data bytes cross regions; only metadata + the existing token URL.
- View-time enforcement reuses `tenant_settings` (already in ADR-0004)
  and the standard `audit-logger` plugin; no new audit code path.

### Negative

- One more table under RLS + migration to maintain.
- Eventual-consistency window between sender success and
  receiver-side row appearing (bounded by pg-boss retry SLA, target
  <30s). UX must not promise instant visibility on the receiver.
- A new pg-boss job class (`share.cross-org-deliver`) needs a
  cross-region dispatch convention; we already have region-pinned
  jobs (architecture § Workers), so the convention extends rather
  than invents.

### Neutral

- `share.cross-org-received` is an audit-action *name* that exists
  for filtering / labeling purposes but does not produce an
  `audit_logs` row — the `inbound_shares` row is the receipt
  evidence. Captured in the UNION view.
- Sender and receiver may share a domain but be different tenants
  (multi-tenant company). Detection uses tenant-id, not domain
  alone; the domain is display only.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Service-role write that bypasses RLS to insert directly into receiver's `audit_logs` | Punctures the most-protected invariant for a routine product flow. Once the bypass exists, every future cross-tenant feature will be tempted to reuse it. Defense-in-depth value of RLS comes from "no exceptions." |
| Platform-scoped `cross_org_share_events` table outside any tenant's RLS scope | Creates a third audit surface admin UIs must learn to query. Splits the receiver-org's audit story across two locations. Worse UX, worse discoverability, no upside vs. `inbound_shares`. |
| Synchronous cross-region write from sender's request | Requires opening a write path from one region's API to another region's DB. Violates region pinning (architecture § Region pinning enforced at data layer). Cross-region transactions also can't be made atomic. |
| Treat cross-org shares as plain external email shares (no `inbound_shares` row) | Loses the receiver-org's ability to enforce accept-policy or surface inbound shares. Fails FR74 + Story 12.7. |
| Push notification only (no persisted row on receiver) | No durable evidence; admin can't audit "what shares my org received last quarter." Fails GDPR + SOC2 evidence expectations and admin spec. |

## Related

- Architecture sections: `docs/architecture.md` § Authentication &
  Security (audit log discipline), § Schema invariants (RLS), § J8
  Sharing data flow, § Region pinning
- Addendum source: `_bmad-output/planning-artifacts/arch-addendums.md` § 8
- ADR-0004 (introduced `tenant_settings.cross_org_share_policy` +
  `cross_org_share_whitelist` — the policy-config side; this ADR is
  the audit-write + enforcement side)
- Epics: FR74; Story 8.4 (sender side); Story 12.7 (receiving-org
  accept-policy)
- UX spec § U32
- Implementation: `inbound-shares` repository + `share.cross-org-deliver` worker + `cross-org-policy` route

## Notes

The `v_tenant_audit_timeline` UNION view is the only place admin UIs
query for the audit timeline; both `audit_logs` and `inbound_shares`
remain append-only at the table level. Status transitions on
`inbound_shares` (`pending` → `accepted` / `blocked-by-policy` /
`expired` / `revoked`) are the *one* mutation the schema permits and
run through a narrow SECURITY INVOKER proc — not a general UPDATE
grant.

The bot session FSM (`packages/bot/src/fsm.ts`) reuses the same
"FSM-driven status transitions through a narrow update path" pattern
this ADR establishes — the bot-join handler is the second concrete
implementation that validates this design.
