# ADR 0005: Per-participant consent model with diarization-aware exclusion

## Status

`ACCEPTED`

## Date

2026-04-29 (proposed) → 2026-05-05 (accepted; Phase 1 second cut +
`packages/consent` runtime first-implementation validates)

## Context

The UX spec § F3 splits bot-meeting consent two ways: implicit
(non-EU / legitimate-interest) vs. explicit (EU / explicit-consent),
with a 60-second opt-in window and per-participant exclusion via
diarization. The architecture document mentions consent at a high
level (cross-cutting concerns, consent-check plugin) but does not
specify the legal-basis model, per-participant tracking, or how
diarization-aware exclusion threads through the transcription
pipeline. Without explicit specification, F3's compliance behavior
is undefined.

## Decision

We will introduce two tables: `meeting_participants` (one row per
person in a meeting, with detected region + diarization speaker ID)
and `consents` (one row per consent decision, with legal_basis,
consent_shape, decision, and evidence JSONB). Tenant default
consent legal basis is captured in `tenant_settings.consent_legal_basis`
(introduced in ADR-0004). Per-participant override applies: any EU
participant under any tenant default triggers explicit-consent path
for that participant. `packages/consent/region-detect.ts` resolves
participant region from meeting metadata. `apps/bot` orchestrates the
60s opt-in window for the explicit-consent path. The transcribe
handler reads consents post-diarization and suppresses transcript
content for speakers without a `granted` decision. Excluded audio
segments remain in the source artifact (legal hold) but never reach
the LLM gateway.

## Consequences

### Positive

- GDPR-compliant default for EU participants regardless of tenant
  default.
- Per-participant audit trail (what each person was asked, what they
  decided, when).
- Clean separation of artifacts: audio retention vs. transcript
  suppression — different lifecycle, different queries.
- Diarization-driven exclusion reuses the Pyannote pass already
  needed for whisper-api transcription (architecture § D1).

### Negative

- Two new tables under RLS; one more migration to maintain.
- Bot-service complexity grows — consent-orchestrator manages 60s
  windows, chat-command parsing, and per-participant state.
- Diarization speaker-to-participant mapping is heuristic; conflicts
  fall to conservative defaults, which can result in over-suppression
  for ambiguous cases (acceptable trade-off vs. under-suppression).

### Neutral

- Consent shape is captured as a string enum-ish value rather than a
  separate FK to a shapes table. Keeps schema simple.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Single `consents` row per meeting (consent-as-binary) | Doesn't model per-participant decisions; can't support EU explicit-consent. |
| Block recording entirely if any EU participant detected without explicit opt-in | Over-conservative; UX spec specifies per-participant exclusion as the default. |
| Suppress in audio (zero out segments) rather than transcript-only | Destroys evidence; conflicts with legal-hold. |
| Tenant-only consent policy (no per-participant override) | Fails GDPR — EU participant in US-default tenant must still get explicit-consent path. |

## Related

- Architecture sections: `docs/architecture.md` § Cross-Cutting
  Concerns (Consent + recording disclosure), § Compliance posture
  routing, § Gap E1 (EU embeddings — same EU-tenant context)
- UX spec § F3
- Addendum source: `_bmad-output/planning-artifacts/arch-addendums.md` § 7
- ADR-0004 (tenant_settings introduces consent_legal_basis field)
- Implementation: `packages/consent/` + `consent-check` Fastify plugin (Phase 1 second cut)

## Notes

"EU" includes EU member states + EEA (Iceland, Norway,
Liechtenstein) + UK. Per-region interpretation is settled in the
`region-detect.ts` constants table (versioned with the package).
