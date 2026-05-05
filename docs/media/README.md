# Media

Visual assets for the README, the standalone portfolio one-pager, and
external references (LinkedIn, UW MSIM portfolio, social previews).

## Diagrams

- [`diagrams/architecture.md`](diagrams/architecture.md) — Mermaid diagrams (system overview, capture→share sequence, multi-tenant isolation, compliance posture routing, bot session FSM, tenant lifecycle FSM). GitHub renders these inline.

## Illustrations

All SVGs use the locked design-token vocabulary (one indigo accent, no mascots, restraint matching the UX spec § Aesthetic Register). Both light and dark modes are in-file via `@media (prefers-color-scheme: dark)`.

| File | Surface | Source |
|---|---|---|
| [`illustrations/inbox-empty.svg`](illustrations/inbox-empty.svg) | F1 first launch — empty inbox | Asset 1 of design brief |
| [`illustrations/actions-clear.svg`](illustrations/actions-clear.svg) | My Actions — caught up | Asset 2 of design brief |
| [`illustrations/search-no-results.svg`](illustrations/search-no-results.svg) | Search — zero results | Asset 3 of design brief |
| [`illustrations/hero.svg`](illustrations/hero.svg) | Marketing hero / README banner | Asset 6 of design brief |
| [`illustrations/og-card.svg`](illustrations/og-card.svg) | 1200×630 social preview card | Open Graph share image |
| [`illustrations/logo.svg`](illustrations/logo.svg) | Wordmark — closed-notebook mark + "AI Secretary" | — |

Source spec: [`_bmad-output/design/empty-state-illustrations-brief-2026-05-05.md`](../../_bmad-output/design/empty-state-illustrations-brief-2026-05-05.md).

## Portfolio one-pager

[`portfolio/index.html`](portfolio/index.html) — standalone, dependency-free HTML page summarizing the project.

To embed in your portfolio:

- **Iframe** the file directly:
  ```html
  <iframe src="https://anthonyonazure.github.io/ai-secretary/docs/media/portfolio/" width="100%" height="900"></iframe>
  ```
- **Or** publish via GitHub Pages (Settings → Pages → Source: `main` branch, root) and link to `https://anthonyonazure.github.io/ai-secretary/docs/media/portfolio/`.
- **Or** screenshot it for static portfolio use.

## Using the OG card

To activate the social preview when the GitHub repo URL is shared:

1. Convert `illustrations/og-card.svg` → 1200×630 PNG (any SVG-to-PNG tool; macOS Preview's "Export As" → PNG works).
2. Upload the PNG to the repo's `Settings → Social preview`.

GitHub doesn't honor SVGs for the social preview slot, but it does render the SVG inline for in-repo viewing.
