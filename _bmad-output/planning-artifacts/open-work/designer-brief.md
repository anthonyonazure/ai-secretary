# Designer Brief — AI Secretary

**Status:** Open work, parallel to engineering build-out
**Owner (internal):** Anthony
**Audience:** External visual / illustration designer or visual-design contractor
**Source spec:** [`../ux-design-specification.md`](../ux-design-specification.md) — Steps 8 & 9

---

## 1. Project context (the half-page version)

AI Secretary is a Meeting Intelligence & Decision Platform — captures
meetings, transcribes them, runs vertical-specific AI analysis (sales,
HR, education, medical, support, PM, psychology, general), exposes
everything through searchable, RAG-chattable knowledge. Multi-tenant
SaaS, B2B prosumer audience, Day-1 personas are **sales reps** and
**therapists**; org admins and team leads are cross-cutting peer
audiences.

**Aesthetic register:** *calm competence* — Linear / Stripe Dashboard /
Things 3 territory. Pro-tool dense, monochrome restraint, one accent
(indigo), Geist typeface. **Not** consumer / playful / illustrated-startup
register; **not** trust-seal / corporate / "we care about your data"
register either.

The product launched without a distinctive visual identity reads as
"another Linear-ish SaaS." Three deliberately invested surfaces
distinguish it. **All three are this brief.**

---

## 2. The three illustration deliverables

### Deliverable A — Sample-meeting library illustrations (×3)

**Where it appears:** First-launch empty state on the home screen.
The user has just signed up and has no meetings. Three sample
"meetings" sit on the home screen as cards the user can click to
experience a streaming receipt without recording anything.

**Content scope:**

- **Illustration 1: Sales discovery call** — represents a sales
  conversation between a rep and a prospect. Should evoke
  "discovery," not "closing the deal." Tone: focused, attentive.
- **Illustration 2: Clinical / therapy session** — represents a
  therapist and client in conversation. Tone: reflective, calm,
  respectful. *Critical:* must not feel medicalized / cold; must
  not feel performatively warm either. Reference: how Headspace
  and Calm illustrate "session" without leaning sentimental.
- **Illustration 3: Internal team meeting** — represents a small
  group conversation (3–5 people) — a project sync, retro, or
  planning meeting. Tone: collaborative, working.

**Style constraints:**

- Consistent illustration system across all three (same character
  treatment, same line weight, same color discipline)
- Single-color palette + ink. Indigo accent (`#4f46e5` light /
  `#818cf8` dark) used sparingly as a highlight, never as fill
- Monochrome elsewhere — neutrals from the design token surface
  (`#15151a` / `#6e6e76` / `#e6e6ea`)
- Faces: stylized, non-photographic, ambiguous-enough to read across
  ages, ethnicities, genders. *No* "diverse cast of cartoon
  professionals" stock-photo aesthetic.
- No props that lock to a single industry (no stethoscope on the
  clinical illustration; no chart-line on the sales illustration).
  The illustrations represent *attention and conversation*, not
  *job artifacts.*

**Format:**
- SVG, optimized, viewBox-clean
- Light-mode and dark-mode variants (accent and neutral hex shifts;
  see token table in spec Step 8)
- Exported at 320×240 base; should remain crisp at 2× and 3×

---

### Deliverable B — Streaming-receipt skeleton motion illustrations (×2)

**Where it appears:** During the first three receipts a user sees
(per Step 7 first-receipt-polish), the streaming-stage skeletons get
extra illustrative treatment. After the third receipt, the experience
dials to calm default.

**Content scope:**

- **Motion 1: "Generating summary..."** — a skeleton that suggests
  the act of synthesis without literal AI tropes (no brains, no
  sparkles, no robot, no `✨`). Reference: Granola's receipt
  craft — quietly competent, never shouty.
- **Motion 2: "Generating action items..."** — a skeleton that
  suggests *items being collected and sorted* — perhaps a list
  forming itself, perhaps a checklist materializing line-by-line.
  Same restraint.

**Motion constraints:**

- 60fps target, 2–3 seconds per loop, low-amplitude motion
- Must respect three motion modes:
  - `default` (150–250ms transitions, snappy)
  - `gentle` (250–400ms, softer easing — used on clinical surfaces)
  - `reduced` (motion suppressed; static skeleton + text label only —
    deliver static SVG fallback explicitly)
- Lottie OR Rive OR pure-SVG animation acceptable; SMIL acceptable
  if it survives the reduced-motion fallback
- No bouncing, no spring physics, no decorative flourish

**Format:**
- Lottie (.json) preferred; Rive (.riv) or animated SVG acceptable
- Static SVG fallback for reduced-motion mode (mandatory)
- Light + dark mode variants

---

### Deliverable C — First-launch hero illustration (×1)

**Where it appears:** The empty home state on first-ever launch,
above the sample-meeting library and import-existing-audio CTA.

**Content scope:**

- A single hero illustration that represents *"your meetings,
  handled"* — the calm-competence anchor emotion (Step 4).
- Should read as: this product carries weight for you. Not: this
  product is exciting.
- Concrete suggestion (designer free to depart): a quiet desk, a
  closed laptop, a mug — the *aftermath* of work, not the
  performance of work. The product is what made the desk quiet.
- *Not:* people using a phone, a laptop showing dashboards, AI
  iconography, brain shapes, sparkles.

**Style constraints:**

- Same illustration system as Deliverable A
- Larger canvas — should hold attention for 3–5 seconds without
  becoming busy
- Indigo used as a focal accent, sparingly

**Format:**
- SVG, optimized, viewBox-clean
- Light + dark variants
- Exported at 1200×800 base; remains crisp on retina

---

## 3. Visual signature follow-ups (engineering will spec; you advise)

Two custom components in the spec have placeholder visual treatments
that need a designer's hand to finalize. The components themselves
are engineering's build; the visual finishing is the ask here.

### `RecordingStatusPill` V2 — inline-waveform refinement

**Current state:** 5-bar waveform animation lives inside the pill;
recording state IS the waveform. Voice-Memos-evocative.

**What's needed from you:**

- **Animation refinement.** Current animation is functional but
  generic. Tighten the timing, the rhythm, the bar amplitudes so
  it reads as *AI Secretary's recording animation*, not "any
  waveform animation." Goal: recognizable in screenshots from
  10 feet away.
- **Reduced-motion fallback.** When `prefers-reduced-motion` is on,
  the bars must freeze at *varied static heights* (not a flat
  line, not all-tall). The frozen state must still read as
  "recording is active" — supplement with the `Recording` label
  + mono timer. Specify the static heights.
- Deliver: animated reference (Lottie / video) + static SVG for
  reduced-motion + spec sheet (timing curves, bar count, amplitude
  envelope).

**Constraint:** must render legibly at three sizes — mobile lock
screen (~24px tall), browser tab pill (~16px tall), web header
chrome (~32px tall). The pill scales; the bars-and-timer scale
with it.

### `CitationChip` V2 — iconic glyph design

**Current state:** Pill-shaped token, speaker / quote glyph paired
with a timestamp. Click → seek transcript + play 5s pre-roll.
Glyph is a placeholder.

**What's needed from you:**

- **Final glyph design.** The glyph signals listenability — *click
  to hear this quote*. Should distinguish citation chips from
  module badges (which use lucide icons). Should not require copy
  to teach the affordance.
- Avoid the obvious: speech bubble (too generic), play triangle
  (overloaded with video-player meaning), quote-marks (too
  literary).
- Suggest 3 directions; we pick one in review.
- Deliver: glyph as SVG path, inline at 12px / 14px / 16px with
  matching mono timestamp (Geist Mono).

**Constraint:** glyph must remain legible at 12px. Hit area
extends to ≥44px (AAA touch target) but the *visual* may be ~24px.

---

## 4. Style references (read these before sketching)

### North Star

- **Linear** ([linear.app](https://linear.app)) — pro-tool dense,
  monochrome restraint, motion as confirmation. The overall register.

### Receipt-screen craft commitment

- **Granola** ([granola.ai](https://granola.ai)) — Step 8 commits
  to *Granola-grade typographic and visual craft* on the receipt
  screen. The streaming-receipt skeleton illustrations (Deliverable
  B) are part of this commitment. Study Granola's note view for
  pacing and restraint.

### Public-facing / consent register

- **GOV.UK Design System** ([design-system.service.gov.uk](https://design-system.service.gov.uk)) —
  plain-language, accessibility-first. Patient consent surfaces and
  the public DSAR portal use this register. Illustration system
  needs to feel *adjacent* to GOV.UK in restraint, even though the
  rest of the product sits in the Linear register.

### Avoid (anti-references)

- Notion's illustrated empty states — *too playful, too cartoon*
- Slack's illustration system — *too marketing-friendly*
- Stripe's illustration system — *too 3D-rendered, too commercial*
- Any "AI product" with sparkles, brains, or robot iconography —
  *the entire category we're differentiating from*

---

## 5. Hard constraints (non-negotiable)

1. **No module color-coding.** The product has 8 verticals. They
   are differentiated by lucide icon + label. **Never by hue.**
   This means: no green for sales, no blue for clinical, no purple
   for education. The illustration system reflects this — accent
   is indigo, period. (Step 5 anti-pattern #7)
2. **Monochrome restraint.** Indigo accent + neutrals only. No
   secondary palettes, no rainbow palettes, no "module-tinted"
   illustrations.
3. **Three density modes** — `dense` / `relaxed` / `accessible`.
   Illustrations don't need three variants, but they must read at
   the type sizes each mode produces (11–30px). Test legibility at
   the smallest case.
4. **Three motion modes** — `default` / `gentle` / `reduced`.
   Animated deliverables must have a static fallback for `reduced`.
   `gentle` is allowed to use the same animation as `default` if
   the easing is naturally soft.
5. **Faces and identity:** ambiguous-by-design, non-photographic,
   non-stereotyped. No "professional in business attire" stock
   visual language. Closer to Refactoring UI's illustration
   restraint than to undraw.co.
6. **No emoji, no sparkles, no `✨` AI iconography, anywhere.**

---

## 6. Deliverable formats

| Item | Format | Variants |
|---|---|---|
| Sample-meeting illustrations (×3) | SVG, optimized, viewBox-clean | Light + dark |
| Receipt skeleton motion (×2) | Lottie .json (preferred) or animated SVG | Light + dark + static reduced-motion fallback |
| First-launch hero (×1) | SVG, optimized | Light + dark |
| `RecordingStatusPill` animation reference | Lottie or recorded video + spec sheet | Animation + static reduced-motion |
| `CitationChip` glyph (final) | SVG path, inline-rendering ready | Light + dark |
| Source files | Figma file (or equivalent) shared back | All deliverables |

**Naming convention:** `kebab-case-descriptor.{light|dark}.{ext}` —
e.g., `sample-meeting-discovery.light.svg`,
`receipt-skeleton-summary.lottie.json`.

**Source file:** Figma file delivered with all artwork organized
by deliverable, layers named, color tokens linked to the design-
token palette.

---

## 7. Timeline ask

**Total elapsed time: 3 weeks from kickoff.**

| Week | Milestone |
|---|---|
| Week 1 | Style direction sketches — 2 directions for the illustration system; review + pick one |
| Week 2 | Deliverables A (sample meetings ×3) + C (hero) finalized; animation directions for B sketched |
| Week 3 | Deliverable B (motion ×2) finalized; visual-signature follow-ups (`RecordingStatusPill` refinement + `CitationChip` glyph) delivered |

**Critical path:** Engineering needs the illustration direction
locked before `EmptyStateRecipient` and `ReceiptStreamLayout`
component build-out begins (Phase 1 in the spec roadmap). Week 1's
direction-pick is the hard gate; everything else can land in
parallel with engineering.

**Review cadence:** end of each week, async; 30-minute live review
at end of week 1 and week 2.

---

## 8. Out of scope (explicit, so we don't expand mid-engagement)

- Marketing site illustrations (separate concern; system stack;
  different aesthetic register)
- Iconography beyond `CitationChip` glyph (we use lucide for icons;
  no custom icon system in this engagement)
- Module badges (lucide icons; no illustration)
- Editorial illustrations for blog / docs (handled separately)
- Animation work on any component other than `RecordingStatusPill`
  and the receipt skeletons listed in Deliverable B
- Brand identity / logo work (separate engagement if needed)

---

## 9. Acceptance criteria

A deliverable is accepted when:

1. It satisfies all hard constraints in §5
2. It renders correctly in light + dark mode (verified against
   token surface)
3. Animation deliverables include a static reduced-motion fallback
4. SVGs pass an SVGO clean pass without visible regression
5. The visual reads as *consistent with the rest of the product*
   when placed adjacent to a Linear-style screenshot — no
   stylistic clash
6. Source Figma file is delivered with named layers and linked
   tokens

---

## 10. Questions / contacts

- Anthony (project owner) for product / scope questions
- Engineering team contact (TBD at kickoff) for token / format
  questions

If anything in this brief reads as ambiguous, raise it before
starting Week 1 sketches. Better to spend an hour on a question
than a day on a deliverable in the wrong direction.
