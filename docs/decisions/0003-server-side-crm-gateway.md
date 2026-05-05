# ADR 0003: Server-side CRM gateway; Chrome extension is presentation only

## Status

`PROPOSED`

> Not yet validated by first-implementation. `packages/crm` package
> exists as a placeholder; the Chrome extension surface and server-
> side push pipeline are still to be built. Promote to `ACCEPTED` once
> Story F5-CRM ships.

## Date

2026-04-29

## Context

UX spec § F5-CRM specifies push-to-CRM from both the in-app receipt
screen AND a Chrome extension overlay on HubSpot/Salesforce/Pipedrive.
Two architectural shapes were possible: (1) extension holds the CRM
auth and calls CRM APIs directly; (2) extension is a thin overlay
that calls our backend, which holds auth and brokers all CRM calls.

The architecture document (§ Provider abstraction discipline) requires
that "LLM SDKs imported only inside packages/llm-gateway" etc. The
spirit of that rule is that integration credentials and API surfaces
are server-side, behind abstraction packages. CRM integrations should
follow the same discipline.

## Decision

We will introduce `packages/crm` (HubSpot, Salesforce, Pipedrive
SDK-importing package) and `apps/api/routes/crm.ts` as the only
surface for CRM operations. The Chrome extension is a presentation
overlay that authenticates to **our** backend (existing JWT) and calls
our REST endpoints. The extension never holds CRM tokens. All CRM
API calls happen server-side through `packages/crm`. CRM OAuth
tokens are stored in `tenant_integrations.encrypted_token` with
KMS-backed envelope encryption. Pushes are queued via pg-boss
(`crm.push` job, 5-minute wall-clock retry budget). Audit log captures
every push attempt and outcome.

## Consequences

### Positive

- Single place to revoke CRM access.
- Audit log is complete (extension can't bypass it).
- Per-tenant compliance posture (can disable CRM provider per-tenant
  via `tenant_entitlements`).
- Extension shipping cadence decouples from CRM API changes (server
  ships separately).

### Negative

- Extension cannot work offline against CRM.
- Roundtrip latency adds ~200-400ms vs. direct extension → CRM call.
- We hold CRM tokens — additional encryption-at-rest obligation.

### Neutral

- Salesforce sandbox vs. prod requires per-tenant provider config
  field; not a deviation, just additional schema.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Extension holds CRM auth | Bypasses audit log; parallel security surface; user-installed extension is harder to revoke; violates provider-abstraction discipline. |
| Direct browser → CRM via CORS proxy | CRM APIs don't permit; would require intermediary anyway; same as decision. |
| Webhook-only (CRM pulls from us) | Reverses control; doesn't satisfy F5-CRM "click push to CRM on receipt" UX. |

## Related

- Architecture sections: `docs/architecture.md` § Provider abstraction
  discipline, § Authentication & Security, § Integration Points
- UX spec § F5-CRM
- Addendum source: `_bmad-output/planning-artifacts/arch-addendums.md` § 3
- ADR-0002 (token build pipeline; same package-discipline pattern)

## Notes

The extension's manifest v3 service worker bursts can hit our
rate-limit; per-tenant rate-limit middleware applies.
