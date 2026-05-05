# Empty-State Illustrations Brief — AI Secretary
**Date:** 2026-05-05
**Status:** Locked spec for portfolio reference; extends the open-work designer brief
**Source docs:** `_bmad-output/planning-artifacts/open-work/designer-brief.md`, UX Design Specification Steps 7–9, Epic 1 (Stories 1.3, 1.7), FR5, FR11, FR76
**Audience:** Visual / illustration designer or portfolio reviewer; engineering consuming assets

---

## Preamble: Aesthetic Register

All six assets share one aesthetic contract: **calm competence**. The product register is Linear / Stripe Dashboard / Things 3 — pro-tool dense, monochrome restraint, one accent (indigo `#4f46e5` light / `#818cf8` dark), Geist typeface. No mascots, no sparkles, no "AI" iconography, no consumer warmth, no clinical coldness.

**What the illustrations must NOT feel like:**
- Notion's playful doodles
- Slack's bright illustrated scenes
- Any illustration with a ✨, brain, or robot in it
- Stock-art-diverse-professionals

**What they should feel like:**
- Granola's receipt screen — quietly crafted, confident, never shouting
- GOV.UK's restraint on consent surfaces (for the search-no-results case)
- Linear's motion-as-confirmation, never motion-as-delight

**Token reference (use these, do not invent palette):**

| Token | Purpose | Light value | Dark value |
|-------|---------|------------|-----------|
| `--color-bg` | Page background | `#fafafa` | `#0b0b0d` |
| `--color-surface` | Card / panel background | `#ffffff` | `#15151a` |
| `--color-fg` | Primary text / illustration ink | `#09090b` | `#fafafa` |
| `--color-muted` | Secondary / supporting elements | `#6e6e76` | `#a0a0ab` |
| `--color-accent` | Indigo highlight — use sparingly | `#4f46e5` | `#818cf8` |
| `--color-accent-fg` | Text on accent backgrounds | `#ffffff` | `#ffffff` |
| `--color-border` | Structural lines | `#e6e6ea` | `#27272a` |

Illustrations use `--color-fg` as primary ink, `--color-muted` as mid-tone, `--color-border` as light structural elements, and `--color-accent` as a single focal highlight per composition. No other hues.

---

## Asset 1 — inbox-no-meetings (F1 First Launch)

### Surface

`apps/web/src/components/feature/meetings/EmptyStateRecipient.tsx` — rendered in `AppShell.Inbox` (D1 default) when a new user's meeting list is empty. This is the first thing a new user sees after completing signup. It appears co-equal with the sample-meeting library cards and the "import existing audio" CTA.

### Emotional Register

**Curious + oriented.** The user has just signed up with some intent — they were sold on the idea of the product before they arrived. They are not confused; they are waiting. The empty state should not feel apologetic ("nothing here yet!") or pushy ("get started now!"). It should feel like the product is **ready** — organized, settled, waiting for them to bring their first meeting. The feeling is closer to "an empty desk that is clearly someone's workspace" than "a blank canvas."

Not infantilizing. Not alarming. Not salesy.

### Visual Anchor

A composed desktop surface seen from a slight oblique angle — a closed notebook with a single ribbon mark at roughly one-third from the top, a small ceramic mug, and a mechanical pencil resting beside the notebook. No screen, no phone, no person. The ribbon mark on the notebook is the focal indigo accent. The objects are rendered in flat, refined linework — not 3D, not photographic, not cartoonish. The composition suggests: this is where work lands. It is ready.

The notebook is the dominant element. Mug and pencil are supporting. The indigo ribbon should draw the eye without competing with anything.

**What this image says without words:** your meetings are handled here. The space is prepared. Bring your first one.

### Color Tokens

- Primary linework: `--color-fg`
- Mid-tone fills / shadows: `--color-muted` at 20–30% opacity
- Surface / paper fill: `--color-surface`
- Indigo ribbon accent: `--color-accent`
- Background (if illustrated): `--color-bg`

Dark-mode variant: swap values per the token table above. The ribbon reads as `#818cf8` against the dark surface. Ensure the linework remains crisp — do not thin strokes below 1.5px at the 320x240 base viewport.

### Acceptance Criteria

- [ ] Renders correctly at 320×240 base; crisp at 2x and 3x (Retina)
- [ ] Light-mode and dark-mode SVG variants delivered separately
- [ ] Illustration carries no module-color hue other than indigo accent
- [ ] No human figures, no device screens, no AI iconography
- [ ] The notebook-ribbon composition reads at a glance without explanatory copy
- [ ] SVG passes SVGO clean pass without visible regression
- [ ] Placed adjacent to a Linear-style screenshot, no stylistic clash

---

## Asset 2 — actions-all-clear (My Actions, Caught Up)

### Surface

`apps/web/src/routes/actions/index.tsx` — rendered in the "My Actions" cross-meeting roll-up view when all action items are checked off or no open actions exist. This can appear for any vertical but is most likely encountered by sales reps and PMs who actively use action items.

### Emotional Register

**Small, earned satisfaction.** This is the "inbox zero" moment of the product — not a celebration, not a confetti moment, but a quiet acknowledgment that the user has cleared their queue. The emotional target is the feeling described in the UX spec as: "good. that's handled." Restrained. Competent. Slightly satisfying.

Do NOT use: checkmarks that celebrate themselves, confetti, stars, animated success states, or any illustration element that communicates "great job!" The achievement belongs to the user, not to the software.

### Visual Anchor

A clean horizontal surface — a desk edge or a table corner — with a single closed folder or a stack of two pages aligned neatly. The pages are squared away; nothing is open, nothing is pending. The folder or pages carry a subtle indigo rule along one edge — a single accent stripe suggesting organization, not decoration. Composition is more minimal than Asset 1: fewer objects, more negative space. The space around the objects carries as much visual weight as the objects themselves.

**What this image says without words:** there is nothing left to do here. The queue is empty. You're current.

Avoid: showing a completed checklist (too obvious, too on-the-nose). The physical object — folder, pages — is more evocative and less didactic.

### Color Tokens

- Primary linework: `--color-fg`
- Paper / folder fills: `--color-surface` with `--color-border` structural lines
- Accent stripe: `--color-accent`
- Negative space: `--color-bg`
- Supporting shadows: `--color-muted` at 15% opacity

### Acceptance Criteria

- [ ] Composition reads as "done / cleared" without explanatory headline copy
- [ ] Minimal — the negative space is intentional design, not laziness
- [ ] No checkmarks, no stars, no celebration elements
- [ ] Indigo accent used as a single stripe or rule, not as fill
- [ ] Light and dark SVG variants delivered
- [ ] Crisp at 2x; viewBox clean; SVGO-passing
- [ ] Consistent illustration system with Asset 1 (same line weight, same construction vocabulary)

---

## Asset 3 — search-no-results

### Surface

`apps/web/src/routes/search.tsx` — rendered when a corpus search returns zero results. Also applies to `apps/web/src/components/feature/chat/ChatEmptyState.tsx` when RAG chat returns the "I don't know" shape. Two surfaces, one illustration, two distinct copy treatments applied by the consuming component.

### Emotional Register

**Informed without alarm.** A search returning nothing is not a failure state; it is an honest answer. The illustration should feel neutral-to-slightly-helpful — not apologetic ("so sorry!"), not clinical ("no results found"), not humorous ("nothing here!"). The tone should communicate: the system searched, the system is confident, there is nothing to show for this query, and here is what to try next.

This is the GOV.UK-adjacent register within the product — plain, clear, helpful, not warm.

Reference: the UX spec calls out "empty state explains the query that ran; offer 'ask the corpus' RAG fallback" as the expected UX response. The illustration supports this with visual tone, not by illustrating the fallback itself.

### Visual Anchor

A magnifying glass set down on a flat surface, lens facing up, handle resting to the side — the search is paused, not broken. The magnifying glass is rendered in linework only; no fill in the lens. A single indigo highlight on the lens rim or handle is the accent. No question marks, no exclamation points, no frowning faces.

The magnifying glass is positioned off-center — slightly to the left of the canvas — suggesting the subject of the search is simply not present in frame, rather than the search having failed. The right side of the composition is open negative space.

**What this image says without words:** we looked. It's not here. That's a complete answer.

### Color Tokens

- Magnifying glass linework: `--color-fg` at 90% opacity (slightly lighter than Asset 1 to read as "paused" rather than "dominant")
- Lens interior: transparent (negative space within the frame)
- Accent highlight on rim: `--color-accent`
- Surface: `--color-bg`

Dark mode: same construction; `--color-fg` brightens against `--color-bg`. Verify the transparent lens still reads correctly — the lens opening must remain visually distinct from the background.

### Acceptance Criteria

- [ ] Magnifying glass reads clearly at the container width used in search results (approximately 480px centered)
- [ ] No human figures, no broken-link iconography, no "oops" visual language
- [ ] The off-center composition communicates "not found" without communicating "error"
- [ ] Light and dark SVG variants
- [ ] SVGO-passing; viewBox clean
- [ ] System is visually consistent with Assets 1 and 2

---

## Asset 4 — recording-status-pill 5-bar waveform (Locked Spec)

### Surface

`apps/web/src/components/feature/recording/RecordingStatusPill.tsx` — embedded in:
- Browser tab pill (~16px tall container)
- Web header chrome (~32px tall container)
- Mobile lock-screen widget (~24px tall container)
- Bot status row in meeting integrations UI (~20px tall container)

This asset is marked "already implemented" in the open-work bundle. This section documents the **locked visual specification** so the implementation can be validated and so the portfolio demonstrates the design decision rationale.

### Locked Animation Specification

**Bar count:** 5 bars, equal width, equal inter-bar gap.

**Bar geometry:**
- Width: 2px per bar (scales proportionally with pill size)
- Gap between bars: 2px (scales proportionally)
- Bar border-radius: 1px (slightly rounded ends; not fully pill-shaped)
- Maximum height: 12px at 32px container; scale proportionally at other sizes
- Minimum height: 3px (no bar collapses to zero — this reads as broken)

**Animation rhythm:**
- Each bar animates independently on its own loop with a phase offset
- Bar 1 (leftmost): phase 0ms, amplitude cycle 0px → 10px → 2px → 8px → 0px
- Bar 2: phase offset +80ms, amplitude cycle 0px → 6px → 10px → 4px → 0px
- Bar 3 (center): phase offset +160ms, amplitude cycle 2px → 12px → 2px → 10px → 2px — center bar has highest peak amplitude
- Bar 4: phase offset +240ms, amplitude cycle 0px → 8px → 3px → 10px → 0px
- Bar 5 (rightmost): phase offset +320ms, amplitude cycle 0px → 5px → 9px → 2px → 0px
- Loop duration: 1,800ms per full cycle
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` — snappy default motion mode; `cubic-bezier(0.25, 0.1, 0.25, 1)` for gentle clinical mode

**Color:** `--color-accent` (indigo) for bars. Pill background: `--color-surface` at 90% opacity. The pill carries a `--color-border` outline at 1px.

**Timing values reference the `--motion-base` token (150–250ms at default; 250–400ms at gentle; 0ms at reduced).** The 1,800ms loop duration is not tied to the motion token; only easing is. The loop runs regardless of motion preference — only the reduced-motion fallback disables it.

### Reduced-Motion Fallback

When `prefers-reduced-motion: reduce` is active (or when the user has explicitly set `reduced` motion mode in settings), the waveform animation is suppressed completely. The bars freeze at **varied static heights** to preserve the "recording is active" read:

**Frozen bar heights (expressed as % of maximum bar height):**
- Bar 1: 45%
- Bar 2: 80%
- Bar 3: 100% (center bar is tallest in the frozen state as well)
- Bar 4: 65%
- Bar 5: 30%

The bars are not equal-height in the frozen state. A flat line or all-equal-height bars would read as stopped / inactive, which is wrong — recording is still in progress. The varied heights signal "live but still."

**ARIA fallback (mandatory alongside the visual fallback):** The pill's `aria-label` must read `"Recording in progress — [elapsed time]"` regardless of motion mode. The timer text is always present in the pill alongside the bars; in reduced-motion mode it carries extra semantic weight as the primary "is it recording?" signal.

**Static SVG fallback:** Deliver a static SVG of the 5-bar frozen state (heights above) for use in contexts where CSS animation is unavailable (email, embedded views, PDF exports). Named `recording-status-pill-static.light.svg` and `recording-status-pill-static.dark.svg`.

### Acceptance Criteria

- [ ] Waveform reads legibly at all three sizes (16px / 20px / 24px / 32px container heights)
- [ ] Center bar (bar 3) is consistently the highest-amplitude bar across the animation cycle
- [ ] Phase offsets create a natural, organic waveform rhythm — not robotic, not random
- [ ] Reduced-motion fallback: bars freeze at the specified varied heights (not a flat line)
- [ ] `aria-label` updates every second with elapsed time regardless of motion mode
- [ ] Pill renders correctly in `--color-surface` background, both light and dark theme
- [ ] Static SVG fallback delivered for reduced-motion and embedded contexts

---

## Asset 5 — receipt-arrival celebration (Story 1.7 first-3-receipts polish)

### Surface

`apps/web/src/components/feature/meetings/ReceiptStreamLayout.tsx` — triggered on the first three receipts a user receives (tracked in `user_preferences.receipts_received_count`). After the third receipt, the extra polish is suppressed and the experience returns to the calm default. The celebration is a layer on top of the normal receipt streaming — it does not replace the content, it accompanies the arrival moment.

This asset is classified as a motion illustration, not a persistent illustration. It plays once on receipt arrival and does not loop.

### Emotional Register

**Small, earned satisfaction — not celebration.** The UX spec is explicit: "something closer to 'good. that's handled.'" not "wow" or "delight." This is a first-impression moment — the user sees their first real receipt (or their first three). The motion must feel like a quiet endorsement, not a party. It plays for 1.5–2 seconds and then the receipt is simply there.

**What is forbidden:** confetti, fireworks, bouncing elements, color bursts, star ratings appearing, mascots waving, any element that requires the user to wait for it to finish before they can read the receipt.

**What is allowed:** a gentle fade-and-settle, a soft emergence from the top of the receipt container, a single brief pulse of the indigo accent that confirms "this is your receipt" and then disappears.

### Visual Anchor

A single horizontal indigo line — 1px, full receipt width — that pulses once at the top of the `ReceiptStreamLayout` container as the receipt transitions from "loading" to "ready." The line appears at zero opacity, transitions to `--color-accent` at full opacity over 200ms, holds for 400ms, then fades to zero opacity over 400ms. Total animation duration: 1,000ms. The receipt content beneath it has already begun streaming; the line is a parenthetical confirmation, not a gate.

Simultaneously, each stage label ("Transcript ready", "Summary", "Action items") on first arrival gets a `scale(1.0) → scale(1.02) → scale(1.0)` micro-pulse over 150ms — barely perceptible, just enough to signal "this just arrived."

No background color changes. No confetti. No element sizes changing by more than 2%. The receipt is readable throughout.

### Reduced-Motion Fallback

In `reduced` motion mode: the indigo line is suppressed entirely. The stage labels receive no scale pulse. The receipt appears exactly as it does in the steady state — no animation at all. The ARIA live region (`role="status"`, `aria-live="polite"`) announces each stage arrival with text: "Transcript ready", "Summary added", "Action items extracted". This is the only signal in reduced-motion mode. It is sufficient.

### Lottie / Animation Format

Deliver as a CSS animation (keyframes) authored inside the component, not as a Lottie file. The animation is sufficiently simple that an external animation file adds tooling complexity without benefit. The reduced-motion suppression uses the standard `@media (prefers-reduced-motion: reduce)` query, which is already handled by the `--easing-reduced` token in the motion system.

### Acceptance Criteria

- [ ] Animation runs on receipt arrival for user's first 3 receipts; does not run on receipt 4+
- [ ] Total animation duration is 1,000ms or less — receipt is fully readable within 500ms of arrival
- [ ] No element change exceeds 2% of its steady-state size
- [ ] Indigo line is the only color element; no additional hues introduced
- [ ] Reduced-motion: animation fully suppressed; ARIA live region announces each stage
- [ ] After the 3rd receipt, the `receipts_received_count` flag suppresses all polish; no regression to celebration state
- [ ] Visual result feels like "confirmation" not "congratulation"

---

## Asset 6 — marketing landing-page hero illustration

### Surface

Marketing site at `aisecretary.app` — above-the-fold hero section. This illustration sits beneath the headline and above the first feature description. Viewport width at desktop breakpoint; approximately 1200px wide × 600px usable height above fold. The illustration must hold attention for 3–5 seconds on first visit, then recede as the user scrolls.

**This is the only marketing asset in this brief.** The product illustrations (Assets 1–3) are designed for the app interior. This illustration must serve a different job: it must communicate what the product is to someone who has never heard of it, in 3 seconds, without reading any copy. The interior assets assume the user already understands the product; this one does not.

### Emotional Register

**Trustworthy + serious.** The marketing page target emotion per the UX spec is "restrained design, no growth-hacker tropes." The visitor arrives from a referral, a LinkedIn post, or search — they are evaluating whether this product is worth 30 seconds more of their attention. The illustration must communicate: this is a professional tool for serious work. Not: this product is exciting. Not: this company is friendly. Not: AI will save your meetings.

The secondary register is **"your meetings, handled"** — the aftermath of work, not the performance of work. The product is what made it possible to stop worrying.

### Visual Anchor

A slightly wider, more expansive version of the Asset 1 notebook-and-desk composition — same visual vocabulary, larger canvas, more breathing room. The key addition for the hero: a single open document or printed page on the desk beside the closed notebook. The page is partially visible — enough to suggest structure (paragraph breaks, a small table of rows) but not enough to read any content. This document is the receipt — the output of the product — but it is shown as artifact, not interface. It does not look like a software UI; it looks like a completed document that arrived.

The indigo ribbon on the closed notebook is still the primary accent. The partially-visible document uses `--color-fg` ink on `--color-surface` paper. The overall composition has more horizontal negative space than Asset 1, appropriate for the wider canvas.

**What this image says without words:** the meeting happened. The document is here. The notebook is closed. There is nothing left to do.

**Concrete departure from the open-work designer brief's suggestion:** the brief suggested "a quiet desk, a closed laptop." We specify a closed notebook (not a laptop) because a laptop has screen-and-keyboard associations that evoke "software UI" rather than "completed work." A notebook reads as captured knowledge. The closed notebook with the ribbon mark beside the document is the stronger pair.

### Color Tokens

- All illustration linework: `--color-fg`
- Paper fills: `--color-surface`
- Desk/surface: `--color-bg` with `--color-border` as subtle structural line
- Indigo ribbon: `--color-accent` (same role as Asset 1)
- Mid-tone fills/shadows: `--color-muted` at 20% opacity max
- No other hues

### Format

- SVG, optimized, viewBox-clean
- Base export: 1200×800 px
- Must remain crisp at 2× (Retina / high-DPI monitors)
- Light-mode and dark-mode variants
- Named: `hero-landing.light.svg` and `hero-landing.dark.svg`

### Acceptance Criteria

- [ ] Composition reads as "professional work completed" within 3 seconds of first view
- [ ] No human figures, no device screens, no AI iconography, no sparkles
- [ ] Consistent illustration system with Assets 1–3 (same line weight, same construction, same palette discipline)
- [ ] The partially-visible document reads as a structured artifact without being legible as copy
- [ ] Indigo accent is the single non-neutral element in the composition
- [ ] Delivered at 1200×800 base; crisp at 2×
- [ ] Light and dark SVG variants
- [ ] SVGO-passing; viewBox clean
- [ ] When placed on the marketing site above a Geist-set headline, the illustration does not compete with the type — it recedes and supports

---

## Delivery Checklist

| Asset | Format | Variants | Status |
|-------|--------|---------|--------|
| 1. inbox-no-meetings | SVG | Light + dark | Needed |
| 2. actions-all-clear | SVG | Light + dark | Needed |
| 3. search-no-results | SVG | Light + dark | Needed |
| 4. recording-status-pill | CSS animation + static SVG fallback | Light + dark + reduced-motion static | Implemented (locked spec documented here) |
| 5. receipt-arrival celebration | CSS animation (in-component) | Light + dark; reduced-motion: no animation | Needed |
| 6. marketing hero | SVG | Light + dark | Needed |

**Naming convention (per designer brief):**
`kebab-case-descriptor.{light|dark}.{ext}` — e.g.:
- `empty-state-inbox.light.svg`
- `empty-state-actions-clear.dark.svg`
- `empty-state-search-no-results.light.svg`
- `recording-status-pill-static.dark.svg`
- `hero-landing.light.svg`

**Source file:** Figma file with all artwork organized by asset, layers named, color tokens linked to the design-token palette. Delivered alongside exported SVGs.

---

## Hard Constraints (Non-Negotiable, Inherited from Designer Brief)

1. No module color-coding. Indigo is the single accent. No green, no blue, no purple for any vertical.
2. Monochrome restraint. The token palette is the entire palette.
3. Faces and identity: absent from all six assets. Objects only.
4. No emoji, no sparkles, no AI iconography anywhere.
5. Reduced-motion fallbacks are mandatory for both animated assets (Assets 4 and 5).
6. SVGO pass is mandatory before any SVG is committed to the repo.
7. All assets must render correctly in both light and dark mode, verified against the token surface.
