# ADR 0002: Style Dictionary as token build pipeline

## Status

`ACCEPTED`

## Date

2026-04-29 (proposed) → 2026-05-05 (accepted; Phase 0 first-implementation validates)

## Context

The UX spec mandates a single tokens.json source-of-truth fanning out
to three platform-specific artifacts (web CSS vars, Tailwind theme,
typed RN objects), with WCAG AA contrast as a build-step gate. The
locked architecture (`docs/architecture.md`) does not name a token
build tool. Three options were live: (1) Style Dictionary, (2) Tokens
Studio (Figma-side, plugin-driven), (3) hand-rolled Node script.

## Decision

We will use Style Dictionary 4.x in a new `packages/design-tokens`
workspace package. Custom transforms supply `color-mix()` static
fallbacks and typed RN exports. A custom checker enforces WCAG AA
contrast on every defined fg/bg pair as a CI gate. Three artifacts
are emitted: `tokens.css`, `tokens.tailwind.js`, `tokens.native.ts`,
consumed by `apps/web` (Tailwind theme extension), `apps/web`
(global CSS), and `apps/mobile` respectively. Theme × density × motion
modes compose at runtime via class composition on web and object
spread on RN — 27 combinations are NOT pre-baked.

## Consequences

### Positive

- Single source-of-truth survives the platform expansion to RN.
- AA contrast regressions can't reach main.
- `color-mix()` browser/iOS-Safari/iframe-host gaps masked by static
  fallback emitted at build time.
- Plugin model (SD's transform/format API) accommodates future
  additions (e.g. iOS native, Figma round-trip) without rewrite.

### Negative

- One more workspace package to keep typechecked.
- ~15% upstream-tracking tax (matches the shadcn one already accepted).
- SD's TypeScript types are weak; we wrap its output in our own typed
  RN export.

### Neutral

- Build artifacts gitignored — every CI run regenerates.
- Web bootstrap gains a single-line feature test for `.no-color-mix`.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Tokens Studio (Figma plugin) | Designer-side workflow; we want code-side source-of-truth, with Figma read-only consumer when designer onboarded. Reverse-direction sync introduces conflict resolution we don't need. |
| Hand-rolled Node transformer | ~200 lines of boilerplate to replicate SD's reference-resolution and transform pipeline. No upside. |
| Tailwind-only (no fan-out) | Doesn't solve RN. Mobile would have a parallel hand-maintained palette. Drift inevitable. |

## Related

- Architecture section: `docs/architecture.md` § Frontend Architecture
- UX spec § Token Architecture
- Addendum source: `_bmad-output/planning-artifacts/arch-addendums.md` § 1
- Implementation: `packages/design-tokens/` (Phase 0, 2026-04-29)

## Notes

Style Dictionary v4 was chosen over v3 for its native
TypeScript-friendly config and improved transform composition.

`--color-border` is exempt from WCAG 1.4.11 (3:1 non-text floor) as a
decorative-only token; interactive component boundaries land as
`--color-border-strong` when first such surface ships.
