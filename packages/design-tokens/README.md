# @aisecretary/design-tokens

Single source of truth for AI Secretary design tokens. Implements
[ADR-0002](../../_bmad-output/planning-artifacts/arch-addendums.md#1-style-dictionary-token-build-pipeline)
(Style Dictionary as token build pipeline). Status: **PROPOSED** — promotes to
`docs/decisions/0002-*.md` after first-implementation validation.

## What it builds

`pnpm --filter @aisecretary/design-tokens build` emits four artifacts under
`build/` (gitignored — every CI run regenerates):

| Artifact                       | Consumer            | Notes                                                                                                       |
| ------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `tokens.css`                   | `apps/web` global   | `:root`, `.theme-dark`, `.density-*`, `.motion-*` scopes; `@media (prefers-reduced-motion)` auto-applied.    |
| `tokens.tailwind.js`           | `apps/web` Tailwind | CommonJS theme extension keyed off the same CSS vars.                                                       |
| `tokens.native.ts`             | `apps/mobile` (RN)  | Typed object tree. `color-mix()` resolved to its static fallback (RN doesn't support color-mix).             |
| `tokens.contrast-report.json`  | CI gate             | Every defined fg/bg pair across themes; `pnpm contrast-check` fails the PR on any AA regression.            |

## Token taxonomy

Three orthogonal axes compose at runtime — **27 combinations are NOT
pre-baked**:

- **Theme** (`light`, `dark`) → top-level CSS scope (`:root`, `.theme-dark`).
- **Density** (`dense`, `relaxed`, `accessible`) → mode class on `<html>`.
  `accessible` enforces 44px+ touch targets per WCAG 2.5.5 AAA.
- **Motion** (`default`, `gentle`, `reduced`) → mode class on `<html>`.
  `reduced` auto-applies via `@media (prefers-reduced-motion: reduce)`.

Web composes via class-name composition on `<html>`. RN composes via object
spread of `tokens` + relevant entries from `modes`.

## How consumers wire up

### Web (`apps/web`)

```ts
// apps/web/src/main.tsx — once at bootstrap
import '@aisecretary/design-tokens/build/tokens.css';

// Single-line color-mix() feature test → flips .no-color-mix on <html>.
if (!CSS.supports('color', 'color-mix(in oklch, red 50%, blue)')) {
  document.documentElement.classList.add('no-color-mix');
}
```

```ts
// apps/web/tailwind.config.ts
import tokens from '@aisecretary/design-tokens/build/tokens.tailwind.js';

export default {
  theme: { extend: tokens },
  // ...
};
```

### Mobile (`apps/mobile`)

```ts
import { tokens, modes } from '@aisecretary/design-tokens/build/tokens.native';

const theme = { ...tokens, ...modes.theme_dark, ...modes.density_relaxed };
```

## CI gate

`.github/workflows/ci.yml` runs `tokens` upstream of `typecheck` /
`web-build` / `mobile-build`. Any pair below 4.5:1 (body) or 3:1 (large /
non-text) fails the PR. The report is uploaded as a build artifact.

## Adding a token

1. Edit the relevant file under `tokens/`.
2. If color, add or update the contrast pair in
   `style-dictionary.config.js` → `pairsForScope` if it represents a new
   fg/bg surface.
3. Run `pnpm --filter @aisecretary/design-tokens build && pnpm --filter @aisecretary/design-tokens contrast-check`.
4. Commit only `tokens/` changes — `build/` is gitignored.

## Quarterly review

Per UX spec § "Token Architecture": tokens with no consumer get pruned at
the quarterly review. Search the workspace for `--<token-name>` and
`tokens.<path>` before adding new ones.
