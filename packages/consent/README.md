# @aisecretary/consent

Region detection + consent orchestrator + server-side consent gate.

Determines whether a participant requires the EU explicit-consent branch
(vs. the standard pre-recording disclosure flow), feeds the
`consent-check` Fastify plugin, and exposes the contract for
per-participant timestamped consent records.

Introduced post-architecture in
`_bmad-output/planning-artifacts/arch-addendums.md` § 7
(Region-aware EU explicit-consent branch). See ADR-0005 (PROPOSED) in
the same doc.

## Public surface

- `detectParticipantRegion(input)` — pure heuristic returning
  `'us' | 'eu' | 'unknown'` from `email | calendarTimezone | ipCountry`.
- `resolveConsentLegalBasis({ policy, participantRegions })` —
  most-protective rule wins (any EU participant or EU-default tenant or
  org-level always-explicit toggle → `'explicit-consent'`).
- `ConsentOrchestrator.surfacesFor({ meetingSource, tenantPolicy, participants })`
  returns the ordered list of consent surfaces a recording must satisfy
  before audio capture proceeds. Story 4.3 covers shape A (always) and
  shape C (in-person QR/URL when org config flags it); the
  `eu-explicit` branch surfaces the per-participant exclusion contract
  consumed downstream by Story 9.5.
- `consentCheck(tenantId, meetingId, db)` — server-side gate; returns
  `'ok' | 'missing'`. Caller must already be inside `withTenantContext`
  so RLS is enforced.
- `getDisclosureCopy({ shape, legalBasis, locale, orgName })` —
  default disclosure copy for the modal renderer.

## Future Fastify plugin path

`consentCheck` is a plain function today. Story 1.4 establishes the
Fastify plugin pattern; once that lands, `consent-check` will become
a Fastify plugin that wraps this function as the `preHandler` for
mutation routes. Code marker: search for
`TODO(Story 1.4 follow-up)` in this package.
