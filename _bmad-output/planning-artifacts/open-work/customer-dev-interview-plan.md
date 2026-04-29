# Customer Development Interview Plan — Pre-Launch Validation

**Status:** Open work, recommended (not gating) pre-launch
**Owner (internal):** Anthony or designated researcher
**Audience:** Internal researcher (or Anthony)
**Source spec:** [`../ux-design-specification.md`](../ux-design-specification.md) — Step 7 customer-development recommendation

---

## 1. Why this study exists

Per the spec (Step 7):

> Customer-development interviews recommended pre-launch. 5–10
> interviews per primary persona (sales rep, therapist) and per
> cross-cutting persona (org admin, team lead). Goal: validate the
> receipt's *content shape* matches actual jobs-to-be-done.
> **Recommended, not gating.**

The card sort (separate plan) tests whether the *word* lands. This
study tests whether the *artifact* lands — whether what we plan to
deliver in the receipt matches the actual jobs-to-be-done of our
Day-1 personas.

**Why not gating:** the architecture is committed; the receipt is
shipping. These interviews shape *content* (which fields, which
ordering, which omissions) — refinements, not pivot decisions.
Conducted in parallel with engineering, results inform the first
post-launch iteration as much as the launch itself.

---

## 2. What we're testing

### Validate (we have a hypothesis to confirm or refute)

| Hypothesis | Source |
|---|---|
| Sales reps want a receipt structured as deal-risk + objections + next-steps | Step 6 (vertical-native rendering); PRD §3 |
| Therapists want a SOAP-draft (Subjective, Objective, Assessment, Plan) structure | Step 6; PRD §3 |
| The receipt's mental-model fit ("a completed artifact, not a transcript") matches what users expect post-meeting | Step 7 anchor word + onboarding mental-model question |
| 15-second scan-to-comprehend (non-clinical) and 60-second scan (clinical SOAP) is the right target | Step 7 success criteria |
| Action items as a first-class space ("My Actions") matches how reps and therapists track follow-up | Step 5 design opportunity |
| Cross-meeting search (RAG chat with citations) earns its complexity for power users at ~50+ meetings | Step 5 design opportunity; PRD §5 |

### Discover (open-ended; no hypothesis yet)

- **Unmet needs** — what does the user *currently do* between meetings
  ending and follow-up that the receipt could absorb?
- **Current workarounds** — what's the current stack? Otter +
  manual notes + CRM? Pen-and-paper? Memory + a frantic email?
- **Frustration patterns** — what makes existing tools (Otter, Fathom,
  Granola, Upheal, Fireflies) annoying enough to switch?
- **Trust thresholds** — what would prevent a user from trusting the
  AI-generated artifact? What would they need to see to act on it
  without re-watching?
- **Sharing patterns** — who do they share with, in what format, with
  what frequency? Where does Slack-vs-email-vs-CRM split?
- **Failure stories** — when has note-taking *failed them* in a way
  that mattered? (Anchor for trust + capture-at-risk UX.)

The discover questions are the more important set. We have hypotheses
about *what the receipt should be*; we have less signal on *what the
gap in their day is that we're filling*.

---

## 3. Personas to recruit

### Day-1 primary (5–10 each)

#### Sales rep / AE

- Currently in role for ≥ 6 months
- Closes / works in deal cycles ≥ 30 days (so meetings have
  longitudinal context — single-call transactional sales doesn't
  produce the corpus value)
- Uses a CRM daily (HubSpot, Salesforce, Pipedrive)
- Mix: SDR, mid-market AE, enterprise AE
- Mix: SaaS, professional services, financial services
- Mix: company size (10-person seed startup → 5,000-person enterprise)

#### Therapist / clinician

- Currently in clinical practice ≥ 1 year
- Mix: psychology / psychotherapy, behavioral health, medical
  consultation
- Mix: solo practice, small group practice, hospital-employed
- Mix: in-office vs. telehealth predominant
- Recruit from licensed practitioner directories; HIPAA-aware
  recruitment language
- *Critical:* explicitly tell candidates we're **not** asking them
  to share patient information — we're asking about their *workflow*
  around session notes

### Cross-cutting (3–5 each)

#### Org admin

- Owner / IT / Operations role at a company that uses ≥ 2 SaaS
  products with org admin responsibilities
- Has handled compliance / DPA / SSO / audit work in the past 12 months
- Mix: regulated industry (healthcare, finance, education) and
  non-regulated
- Recruit through LinkedIn or B2B research panels

#### Team lead / supervisor

- Sales managers (AE Director / VP Sales) who currently coach a team
  ≥ 3 reps
- Clinical supervisors who currently oversee ≥ 3 clinicians
- Department chairs / academic leads (education) — optional, lower priority
- Customer-success leads — optional, lower priority

### Total target

**Minimum acceptable:** 5 sales reps + 5 therapists + 3 admins + 3
team leads = **16 interviews**.

**Ideal:** 10 + 10 + 5 + 5 = **30 interviews**.

---

## 4. Discussion guide outline (jobs-to-be-done framework)

Standard JTBD interview shape: situational → motivational → outcome.
60 minutes per session.

### 0–5 min — Welcome + consent

- Reaffirm consent for recording
- Confirm participant role and tenure
- Set expectation: *"There are no wrong answers; we're learning
  about your work."*

### 5–15 min — Situational (the meeting itself)

- *"Walk me through your last meeting yesterday — type, length, what
  you were trying to accomplish."*
- *"What was happening before that meeting? What were you trying to
  set up?"*
- *"What are the three biggest types of meetings you have in a typical
  week? Which one is the most painful to come out of?"*
- *(For clinicians)* *"How do telehealth and in-office sessions
  differ in your post-session workflow?"*
- *(For sales)* *"How does a discovery call differ from a demo from a
  closing call in what you do *after* it ends?"*

### 15–30 min — Motivational (what they're trying to accomplish)

- *"When the meeting ended, what was the first thing you needed to do?
  What's the deadline on it?"*
- *"Walk me through what you do between the meeting ending and the
  end of that day."*
- *"What's currently in your workflow? Notes app, CRM, email, your
  head, your colleague's head?"*
- *"When you have to remember something from a meeting two weeks ago,
  how do you find it now?"*
- *"What have you tried? Otter, Fathom, Granola, voice memos, paper?
  Why did you stop using them, or why are they still in your stack?"*

### 30–45 min — Outcome (what success looks like)

- *"If you could fix one thing about the way you handle meetings,
  what would it be?"*
- *"If a teammate said 'I'll send you my [receipt] in three minutes',
  what would you expect to see when it arrived?"*
- Show a single annotated wireframe (D1 receipt screen — sales OR
  clinical depending on persona)
- *"Walk through this. What's right? What's missing? What's
  there that you wouldn't use?"*
- *"Where would you click first?"*
- *(If they share) "Who would you share this with? In what format?
  In what tool? What context goes with it?"*

### 45–55 min — Sharing, trust, and failure

- *"When have you been burned by a tool that *thought* it captured
  what you needed but actually didn't?"*
- *"What would you need to see to trust this enough to send to a
  client / patient / your manager / your CRM?"*
- *"What's the worst possible failure mode for you?"*
- *(For admins)* *"What would your IT / compliance team need to see
  before approving this for org-wide use?"*

### 55–60 min — Wrap

- Open question: *"What didn't I ask that I should have?"*
- Thank, confirm compensation, request follow-up permission

---

## 5. What success looks like (for the *study*, not the product)

### After all interviews:

- **Validation outcomes** — for each hypothesis, a clear
  confirm / refute / ambiguous signal with quote evidence
- **Discovery outcomes** — at least 3 unmet needs we hadn't identified;
  at least 2 current workarounds we hadn't anticipated; at least 1
  failure mode that should change our UX
- **Receipt-shape recommendations** — per persona, recommended
  ordering / labeling / inclusion-or-omission for the receipt
  fields, grounded in interview language
- **Per-vertical timing recommendations** — confirm or revise the
  3-min target for non-clinical, 30-min for clinical
- **Trust-threshold list** — concrete things users said they'd need
  to see to trust the artifact

---

## 6. Recruiting / scheduling / synthesis cadence

### Recruiting

- **Channels:** LinkedIn outreach, UserInterviews.com panel,
  Respondent.io, personal network referrals, BetaList outreach
- **Compensation:** $100–$200 USD per session; clinician sessions
  at the higher end given billable-hour opportunity cost
- **Screener:** 5-question form filtering for current-role tenure,
  current-tool usage, language fluency
- **Scheduling tool:** Calendly or SavvyCal — block 60 minutes;
  confirm time-zone-aware

### Scheduling cadence

| Week | Activity |
|---|---|
| Week 1 | Recruit + screen first batch; goal 8 sessions booked |
| Week 2 | Conduct interviews 1–8 (~2/day, 4 days/week) |
| Week 3 | Conduct interviews 9–16; recruit second batch if expanding to 30 |
| Week 4 | Synthesis: per-persona memo + cross-cutting findings |
| Week 5 | (If expanding) interviews 17–24 |
| Week 6 | (If expanding) interviews 25–30 + final synthesis |

### Synthesis cadence

- After every 4 interviews: 30-minute internal sync to surface
  emerging patterns; adjust questions for remaining sessions if a
  question is consistently not yielding signal
- After all interviews: dedicated 1-week synthesis sprint
- Synthesis tool: Dovetail, Reduct.video, or Airtable + manual
  tagging — code each interview against hypothesis-validation +
  discovery-themes

### Synthesis output structure

1. **Per-persona memo** (1–2 pages each)
   - Receipt content shape recommendations
   - Top 3 unmet needs
   - Top 3 current workarounds
   - Quote bank (5–10 anonymized quotes)
2. **Cross-persona findings** (1 page)
   - Patterns common across personas
   - Patterns specific to one persona
   - Mental-model anchor word reactions (cross-reference card sort)
3. **Receipt-shape annotated wireframe** — actual recommendations
   marked on the D1 receipt screen mock; what to keep, what to add,
   what to demote
4. **Trust-threshold checklist** — concrete items users want to see
5. **Failure-story library** — verbatim accounts to inform
   capture-at-risk and consent UX

---

## 7. Pre-launch timing

### Recommended, not gating

The spec is explicit: customer-development interviews are
**recommended pre-launch**, not blocking.

**Recommended timing:**

- **Start:** ~10 weeks before public launch
- **Synthesis complete:** ~6 weeks before public launch
- **Receipt-shape revisions land:** ~4 weeks before launch

### What "non-gating" means in practice

- Engineering does **not** block on these interviews
- The receipt component contract (`AnalysisCard` + `ReceiptStreamLayout`)
  is built per spec
- Module-config is the layer that absorbs interview findings — content
  ordering, labels, copy register adjustments, vertical-specific
  fields are module-config changes, not component-code changes
  (per Step 5 discipline rule)

### What we'd halt for

- Strong signal (≥ 70% of one persona) that the *mental model* is
  fundamentally wrong — e.g., sales reps don't want the receipt;
  they want the email-to-prospect drafted
- Strong signal that the receipt's *core fields* are misordered or
  omitting something critical — e.g., therapists need a *risk-flag*
  section we don't currently render
- A trust-threshold blocker — something that would prevent
  professional adoption that we hadn't designed for (e.g., signature
  workflow on SOAP notes)

These are unlikely; the spec has been informed by competitor study,
adjacent products, and the original input brief. But explicit
fail-safe criteria keep us honest.

### What we'd absorb post-launch

Most interview findings will be incremental — copy register tweaks,
field-ordering changes, additional optional fields. These ship as
module-config updates in the first 1–2 sprints post-launch. The
research effort isn't wasted because it's late; it shapes the
roadmap from week 2 onward.

---

## 8. Ethical / consent framing

- **Recording consent** — explicit, in writing, before session start
- **Patient information** — clinicians explicitly *not* asked to
  share PHI; questions are about workflow, not patients
- **Anonymization** — synthesis quotes are anonymized; identifying
  details removed
- **Compensation transparency** — paid regardless of session outcome
- **Right to withdraw** — participants can stop at any time without
  losing compensation
- **Data retention** — recordings deleted 90 days after synthesis
  completes unless participant opts in to longer retention
- **Follow-up permission** — separately consented, never assumed

---

## 9. Deliverables

1. **Per-persona JTBD memo** (×4 — sales, therapist, admin, team lead)
2. **Cross-persona findings memo**
3. **Annotated receipt wireframe** with content-shape recommendations
4. **Quote bank** (anonymized, tagged by persona + theme)
5. **Trust-threshold checklist**
6. **Failure-story library** (verbatim with anonymization)
7. **Recommendations memo** — concrete changes to module config,
   copy, content ordering; cross-referenced to the spec

Deliverables filed at `_bmad-output/research/customer-dev-interviews/`
when complete.
