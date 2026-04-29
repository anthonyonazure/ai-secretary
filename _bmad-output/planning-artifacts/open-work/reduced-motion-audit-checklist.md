# Reduced-Motion Audit Checklist

**Status:** Living document; pre-launch sign-off required
**Owners:** Engineering (build) + Design (review) + Accessibility lead (sign-off)
**Source spec:** [`../ux-design-specification.md`](../ux-design-specification.md) — Step 8 commitment

---

## 1. Why this audit exists

Per the spec (Step 8):

> **Pre-launch reduced-motion audit:** every animated component
> verified to respect `--motion-base: 0ms` in `accessible` mode.
> Tailwind transitions sometimes hardcode duration; CI lint flags
> any transition declaration that doesn't reference the motion-mode
> variable.

`prefers-reduced-motion: reduce` is a hard accessibility commitment.
Users who set this preference at the OS level have a clinical or
neurological reason — vestibular disorders, motion sensitivity,
photosensitive epilepsy, attention-related conditions. Failing to
honor it is a WCAG 2.2 violation **and** a real harm.

The product's auto-detection chain:

1. OS `prefers-reduced-motion: reduce` → auto-applies `accessible`
   mode (which sets `--motion-base: 0ms`) UNLESS user has explicitly
   chosen a different mode in settings (per Step 8 accessibility
   precedence rule).
2. `accessible` motion mode → all transitions referencing
   `--motion-*` tokens collapse to 0ms; animated illustrations swap
   to static fallbacks.

This audit verifies that chain holds across every animated surface.

---

## 2. Scope of the audit

### What "every animated component" means

Every component that:

- Uses CSS `transition` or `animation` properties
- Uses Framer Motion / Reanimated / Lottie / Rive
- Triggers state changes that produce visual movement (e.g., toast
  slide-in, dropdown reveal, sheet slide-up)
- Streams content into placeholders with motion-based reveals
- Renders an animated illustration (e.g., receipt skeleton motion
  illustrations from the designer brief)

### What's in scope, surface by surface

| Surface | Audit scope |
|---|---|
| `RecordingStatusPill` | Inline waveform animation; reduced-motion freeze state |
| `ReceiptStreamLayout` | All streaming-stage skeleton → content reveals; first-receipt-polish pop-in animations; expected-arrival-time indicator updates |
| `CitationChip` | Click-flash; hover preview transitions |
| `TranscriptSeekPlayer` | Waveform scrubber animation; play/pause transitions |
| `AuditLogTable` | Filter chip animations; row-expand transitions |
| `EntitlementGrid` | Toggle animations |
| `EmptyStateRecipient` | Sample meeting card hover / focus motion; first-launch hero animation if any |
| `LiveNoteEditor` | Cursor blink (browser default — N/A); save-confirmation animation |
| `ModuleConfirmModal`, `ConsentDisclosureCard` | Modal slide-in / scale-in; backdrop fade |
| `AppShell.Inbox` / `AppShell.Cards` / `AppShell.Search` | Sidebar reveal/collapse; route transitions |
| `RelationshipBrowser` (cmd-K) | Palette open/close; result list expand |
| RAG chat surface | Streaming reply animation; citation reveal |
| `ShareRecipientView` | Token-URL load transition; transcript playback animations |
| `VoiceInputSurface` | Dictation-state visual feedback; mic-active pulse |
| `EmptyStateRecipient` illustrations (designer Deliverable B) | Lottie / animated SVG reduced-motion fallback |
| Toast (Sonner) | Slide-in; auto-dismiss countdown animation if visible |
| Banners | Slide-down on appearance |
| Mobile sheets | Bottom-sheet slide-up; swipe-to-dismiss gesture animation |
| Mobile bottom-tab nav | Tab-change indicator transition |
| Mobile haptics | *Not visual motion — out of scope for THIS audit, but documented separately for haptic preferences* |

---

## 3. Per-component audit checklist

For **every component listed above**, verify:

### Token usage

- [ ] All `transition-duration` declarations reference `--motion-fast`,
      `--motion-base`, or `--motion-slow`
- [ ] No hardcoded `transition: ... 200ms ...` or `animation-duration:
      300ms` values
- [ ] All easing curves reference `--easing-default`,
      `--easing-gentle`, or `--easing-reduced`
- [ ] No hardcoded `cubic-bezier(...)` or `ease-in-out` values
- [ ] Tailwind utility classes use the `motion-` plugin variants where
      applicable, not raw `duration-200` / `ease-in-out`

### Reduced-motion behavior

- [ ] When `--motion-base: 0ms` is in effect, all transitions complete
      instantly (no perceptible animation)
- [ ] State changes are still observable (content arrives; user sees
      it changed) — *the goal is no animation, not no feedback*
- [ ] ARIA live announcements still fire identically (per Step 10 F1
      / F4 — reduced-motion does not silence accessibility
      announcements)
- [ ] Skeleton-to-content reveals collapse to discrete swap, not a
      cross-fade

### Component-specific checks

#### `RecordingStatusPill`

- [ ] Waveform bars freeze at *varied static heights* (not all-tall,
      not flat) per designer spec
- [ ] Recording state still reads as "active" via:
  - Static label "Recording"
  - Mono timer continues to update (text changes are not animation)
  - Subtle non-animated background or border treatment if needed
- [ ] No pulse, no shimmer, no rotation in `accessible` mode

#### `ReceiptStreamLayout`

- [ ] Each streaming stage swaps from skeleton to content via
      discrete content swap (no fade, no slide, no pop-in)
- [ ] Stage labels ("Transcript ready," "Summary ready") fire via
      ARIA live region as-normal
- [ ] First-receipt-polish animations (gentle pop-ins for first 3
      receipts) suppressed entirely in `accessible` mode
- [ ] Expected-arrival-time indicator updates via text change only

#### `CitationChip`

- [ ] Click-flash suppressed; visual confirmation via focus ring +
      brief background change (no animation)
- [ ] Hover preview appears instantly (no fade-in transition) in
      `accessible` mode
- [ ] Visited state shift happens immediately, not via transition

#### Streaming RAG chat

- [ ] Streaming reply text appears in larger discrete chunks rather
      than character-by-character cursor effect
- [ ] Citation arrival is a discrete content swap
- [ ] ARIA live announcements unchanged

#### Modals / Dialogs / Sheets

- [ ] Modal appears instantly, no scale-in, no fade-in
- [ ] Backdrop appears instantly
- [ ] Mobile sheets snap to position rather than slide
- [ ] Swipe-to-dismiss still functional (gesture, not animation)

#### Toasts / Banners

- [ ] Toasts appear instantly in their final position
- [ ] No slide-in, no slide-out
- [ ] Auto-dismiss happens silently (no countdown animation)
- [ ] Banner appears instantly; manual dismiss is instant

#### Animated illustrations (Lottie / SVG / Rive)

- [ ] Static SVG fallback delivered for every animated illustration
      (per designer brief Deliverable B)
- [ ] When `prefers-reduced-motion: reduce`, the static SVG renders
      instead of the animated version
- [ ] Detection happens at the component level via React `useReducedMotion`
      hook (Framer Motion / Reanimated equivalents) — not just CSS
      media query

#### Custom CSS animations

- [ ] Any `@keyframes` rule is wrapped in
      `@media (prefers-reduced-motion: no-preference) { ... }` OR
      the animation duration variable collapses to 0ms in
      `accessible` mode
- [ ] No infinite-loop animations active in `accessible` mode

#### React Spring / Framer Motion / Reanimated usage

- [ ] All animation primitives consume motion tokens via the React
      hook layer (not hardcoded numbers)
- [ ] `useReducedMotion()` (or platform equivalent) is honored in
      every motion-bearing component
- [ ] Spring physics (mass / tension / friction) collapse to instant
      transitions in `accessible` mode

---

## 4. Lint rule for hardcoded transition durations

### What the rule enforces

Custom Biome rule (or ESLint plugin) that flags:

- `transition: ... <number>ms ...` in CSS / Tailwind utilities
- `animation: ... <number>ms ...`
- `duration={<number>}` props on Framer Motion / Reanimated components
  that aren't consuming `--motion-*` tokens
- Direct `setTimeout(..., <number>)` used for visual transition
  pacing (animation work disguised as setTimeout)

### Implementation notes

- Rule lives in `packages/eslint-config-aisecretary/` (or Biome
  equivalent under `tools/`)
- Allowed exceptions: a token-build-generated file emits `tokens.css`
  with hardcoded values — `**/tokens.css` is allow-listed
- Tailwind's `duration-*` and `transition-*` utilities — only the
  `motion-` plugin variants are allowed; bare `duration-200` is
  flagged

### Acceptance

- [ ] Rule lives in `packages/eslint-config-aisecretary/` or `biome.json`
- [ ] Rule flags violations in PR CI checks
- [ ] Existing codebase passes the rule before launch
- [ ] Documentation in repo `CONTRIBUTING.md` explains the rule
      with examples of the right way to author transitions

---

## 5. Test methodology

Three test paths, all required for each component sign-off.

### A. OS preference toggle

- **macOS:** System Settings → Accessibility → Display → "Reduce
  motion" toggle ON
- **iOS:** Settings → Accessibility → Motion → "Reduce Motion" ON
- **Windows:** Settings → Accessibility → Visual effects →
  "Animation effects" OFF
- **Android:** Settings → Accessibility → Visibility enhancements →
  "Remove animations" ON

For each component:

1. Toggle OS preference ON
2. Reload application (Storybook, dev server, native build)
3. Trigger every interaction that causes motion in default mode
4. Verify no perceptible animation occurs
5. Verify ARIA announcements still fire

### B. DevTools simulation

- **Chrome / Edge / Firefox DevTools:** Rendering tab → "Emulate
  CSS media feature `prefers-reduced-motion`" → "reduce"

For each component:

1. Open Storybook story for the component
2. Enable DevTools simulation
3. Trigger all interactive states
4. Inspect element styles to confirm `--motion-base` resolves to `0ms`
5. Capture screenshot for visual-regression baseline

### C. Storybook stories with motion-mode toggle

Every component has Storybook stories rendered with each motion mode:

- `MotionMode/Default`
- `MotionMode/Gentle`
- `MotionMode/Reduced`

In Storybook UI:

1. Component renders with Storybook control to toggle motion-mode
2. Each variant captured as a regression baseline
3. axe-core a11y addon runs in each variant to confirm ARIA
   integrity preserved

For animated illustrations specifically:

- A "Reduced motion" Storybook story is rendered showing the static
  fallback
- Baseline screenshot captured
- Visual regression suite catches drift

---

## 6. CI integration

Required CI gates before merge:

- [ ] Biome reduced-motion lint rule passes
- [ ] Storybook a11y addon (axe-core) passes for every component in
      every motion-mode variant
- [ ] Visual-regression suite passes (no unexpected diff in
      reduced-motion baseline screenshots)
- [ ] Token-build CI passes (motion tokens build without error)

Additional pre-launch gate:

- [ ] Manual reduced-motion test pass on web (Chrome + Safari +
      Firefox) and mobile (iOS Simulator + Android emulator)
- [ ] Manual reduced-motion test pass on real device (one iOS, one
      Android)

---

## 7. Sign-off owners

| Stage | Owner |
|---|---|
| Implementation per component | Component author (engineering) |
| Per-component review | Design lead |
| Lint rule authored + enforced | Tooling / Frontend infra lead |
| Pre-launch audit pass | Accessibility lead (named role) |
| **Final sign-off** | Accessibility lead, with countersign by Anthony |

The accessibility-lead role is named, not assumed. If the role is
vacant at audit time, the audit cannot complete.

---

## 8. Living-document responsibilities

This document is **owned by engineering and product jointly** post-launch.

### When to revisit

- New custom component added → add row to §2 + §3 checklist; verify
  before merge
- New animated illustration added → static fallback is part of
  acceptance
- Motion-token changes → re-verify all components against new tokens
- WCAG version update or new accessibility regulation → re-audit scope
- Bug report citing motion accessibility → triage + revisit affected
  component

### Quarterly review

Every quarter, accessibility lead runs a sampling audit:

- Pick 3 components at random
- Re-run §5 test methodology end-to-end
- Document any drift in this file
- File issues for any regression

---

## 9. Acceptance criteria for pre-launch sign-off

Sign-off is granted when:

1. Every component in §2 has a checked-off row in §3
2. The lint rule from §4 is enforced in CI
3. All three test paths from §5 have been run for every component
4. CI gates from §6 are green
5. Accessibility lead and Anthony have countersigned

Sign-off lands ≥ 1 week before public launch so any regressions
caught in final QA can be fixed without missing the launch window.

---

## 10. Failure modes and remediation

| Failure | Remediation |
|---|---|
| Component has hardcoded transition duration | Refactor to consume `--motion-*` token; CI re-runs |
| Component renders animation in `accessible` mode | Wrap motion in `useReducedMotion` hook (or CSS media query); re-test |
| Lottie illustration has no static fallback | Block until designer delivers fallback (per Deliverable B contract) |
| ARIA announcement silenced when motion suppressed | Decouple announcement from motion trigger; announcement fires on state change, not on animation start |
| Spring-physics animation visibly bouncy in reduced mode | Replace spring config with `if (reducedMotion) { duration: 0 }` short-circuit |
| Toast still slides in | Replace with instant-render + opacity-0 to opacity-1 only when `motion: no-preference`; instant in reduced |
| Mobile sheet still slides | Use platform-default reduced-motion behavior (iOS: instant present; Android: instant slide) — verify on device |
