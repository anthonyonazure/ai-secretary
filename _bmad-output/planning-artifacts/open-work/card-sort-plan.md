# Card Sort Plan — Validating the "Receipt" Anchor Word

**Status:** Open work, pre-launch
**Owner (internal):** Anthony or designated researcher
**Audience:** Internal researcher (or Anthony) running the study
**Source spec:** [`../ux-design-specification.md`](../ux-design-specification.md) — Step 7 mental-model anchor

---

## 1. Why this study exists

The defining experience is *Capture → Receipt*. The product positions
the post-meeting artifact as a **receipt** — completed, structured,
actionable. Word choice is provisional.

Per the spec (Step 7):

> *"Receipt"* carries a slight proof-of-payment association in English
> (and *reçu* in French) that may fight the intended completed-and-
> actionable framing. Before launch, run a 5-person card sort on
> whole-phrase usage.

This is the cheapest pre-launch validation we can run. Five participants,
two languages, ~45 minutes per participant, results in a single
keep-or-replace decision.

---

## 2. What we're testing

### The whole-phrase usage test

Participants react to the same sentence with different anchor words
substituted in. We are testing **how the word lands inside a real
sentence in their professional voice**, not how the word feels in
isolation.

**The test sentence (English):**

> *"I'll have my [WORD] in three minutes."*

**The test sentence (French):**

> *"Mon [MOT] sera prêt dans trois minutes."*
>
> (Lit. *"My [word] will be ready in three minutes"* — preserves the
> short-time-to-arrival framing of the English sentence.)

### Candidates to evaluate

Per the spec Step 7:

| English | French (provisional) | Register notes |
|---|---|---|
| **receipt** | reçu | Provisional anchor — proof-of-payment association |
| **brief** | note / synthèse | Legal / intelligence register; "to brief someone" |
| **debrief** | débrief / compte rendu | Post-action register |
| **dossier** | dossier | Loans cleanly to French; close to the framing |
| **wrap** | (no clean FR equivalent — try *résumé* or *bilan*) | Casual; production register ("wrap a film") |
| **recap** | récap | Casual; education-friendly |
| **summary** | résumé | Generic baseline; what competitors use |
| **session note** | compte rendu de séance | Clinical-only candidate |

Eight English candidates × two-to-three French equivalents per word.

### Per-vertical wording exploration

Clinical surfaces may legitimately use a different word from the rest
of the product:

- **Clinical (medical / psychology):** *session note* / *compte rendu*
  is industry-standard. Test whether clinicians would even use the
  general anchor word, or whether they'd reach for the clinical term
  by reflex.
- **Education:** *recap* / *récap* is casually used by instructors.
- **Sales / PM / support / general:** likely converge on a single
  word; the card sort identifies which.

The spec explicitly allows per-vertical wording. The card sort
*expects* clinical to diverge and is designed to confirm or refute
that.

---

## 3. Participant recruitment

### Target: 5 participants, 2 languages

We need representation across:

- **Sales rep / AE** — Day-1 primary persona
- **Therapist / clinician** — Day-1 primary persona
- **Org admin OR team lead** — cross-cutting persona; either is fine
- **Instructor or PM** — secondary persona; either is fine
- **Solo professional / freelance consultant** — single-user mode persona

5 participants is enough for a card-sort signal at this stage; the goal
is **detecting strong divergence**, not statistical inference. If two
participants gravitate strongly to the same alternative, that's a
signal worth acting on.

### Language split

- **Minimum: 3 English-native, 2 French-native**
- French-native participants must use the product's professional voice
  in French (i.e., not just speak French — *work* in French in their
  professional role)
- One participant ideally bilingual EN/FR to test whether they
  spontaneously translate or stay in one language

### Recruitment criteria

| Criterion | Detail |
|---|---|
| Currently in role | Has held the role for ≥ 6 months |
| Uses similar tools | Has tried Otter, Fathom, Granola, Upheal, Fireflies, or equivalent |
| Mixed seniority | Don't recruit five managers; mix IC and lead |
| Mixed company size | At least one solo / freelancer; at least one enterprise (>500) |
| Compensation | $50–$100 USD per session, or local equivalent — modest but respectful |
| Recruitment channels | LinkedIn outreach, UserInterviews.com panel, personal network referrals |

### What we screen out

- Participants who currently work for a direct competitor
- Participants who are not in their role's daily flow (e.g., a
  "former therapist now consulting") — we want present-tense voice
- Participants who only speak the test language as a second language
  (we want professional fluency)

---

## 4. Method

### Format

- **45-minute remote video session**, recorded with permission
- Tool: any standard call recorder (Zoom, Loom, Riverside)
- One researcher, one participant
- French sessions run in French by a French-speaking facilitator OR
  by Anthony with light translation prep

### Materials

1. **Card deck** — physical-style digital cards (Miro / FigJam /
   printed if in-person). Each card carries one candidate word in
   the participant's language. ~8 cards per language.
2. **Test sentence template** — printed/displayed; participant reads
   each word into the sentence aloud.
3. **Brief product context** — 60-second verbal description of the
   product, *avoiding* the candidate words. Sample script in §6.
4. **Recording consent** — standard research consent form, signed
   before session start. Anonymized in synthesis.

### Session structure

| Minute | Activity |
|---|---|
| 0–5 | Welcome + consent + recording start |
| 5–10 | Participant introduces their role, current note-taking workflow, pain points (warm-up; gives us baseline vocabulary) |
| 10–15 | Researcher reads product description (sans candidate words). Confirm participant understood the product. |
| 15–35 | Card sort: participant reads each card into the test sentence aloud, says how it lands ("sounds professional," "sounds like an email receipt," "wouldn't say this," "doesn't feel like the artifact I'd expect"). After all words, participant ranks top 3 and bottom 3. |
| 35–42 | Open-question probe: *"If our product gave you exactly what we described, what would you naturally call it when you tell a colleague?"* — captures spontaneous vocabulary outside our candidate list |
| 42–45 | Wrap, thanks, compensation confirmation |

### Probing questions during card sort

For each word, after the participant reads it into the sentence:

- *"Does that sentence sound like something you'd say?"*
- *"Does it set the right expectation for what's about to land?"*
- *"What would you assume is in the [WORD]?"*
- *"Would the word feel different if your manager / patient / client
  saw it?"*

For the bottom 3:

- *"What specifically makes those feel wrong?"*

For the top 3:

- *"If you had to pick one, which?"*

---

## 5. Analysis approach

### Per-participant capture

Per session, capture:

1. **Ranked top 3 words** (their preference order)
2. **Ranked bottom 3 words** (which words felt actively wrong)
3. **Spontaneous-vocabulary word(s)** from the open-question probe
4. **Per-vertical observations** — did the clinical participant
   reach for a different word than the rest? Did the educator?
5. **Quotes** — verbatim reactions to the top picks and the rejections

### Cross-participant synthesis

After all 5 sessions:

1. **Tally the top picks** — does any single word get 3+ first-choice
   votes? Does any word appear in 4+ participants' top 3?
2. **Tally the rejections** — does any word get 3+ explicit
   rejections? (If "receipt" is rejected by 3+ participants for
   proof-of-payment reasons, that's the keep-or-replace signal.)
3. **Identify per-vertical divergence** — does the clinician's top
   3 overlap with the others' top 3, or are they reaching for
   *session note* / *compte rendu* exclusively?
4. **Cross-language consistency** — do French and English
   participants converge on cognate-equivalent words, or does the
   French set behave differently?
5. **Spontaneous vocabulary alignment** — did anyone, unprompted,
   reach for a word *not on our list* that we should consider?

### Reporting

Single-page synthesis document containing:

- The decision (keep "receipt" / replace with *X* / per-vertical split)
- Vote tallies
- Top 3 supporting quotes for the decision
- Top 3 contradicting quotes (steel-man)
- Recommendations for clinical-only / education-only divergence

---

## 6. Sample product description (read to participants verbatim)

> *"AI Secretary records your meetings, transcribes them, and
> organizes the result into a structured artifact you can scan
> in 15 seconds. The artifact has a summary, action items, and
> vertical-specific analysis — for sales reps, that's a deal
> overview; for clinicians, a session note structure; for
> instructors, an engagement breakdown. The artifact arrives
> within about 3 minutes of the meeting ending. You can search
> across past artifacts, share clips, and pull insights from
> the corpus over time. We're trying to figure out what to call
> the artifact itself."*

Note: the description deliberately uses "artifact" (a word *not* on
the candidate list) so participants don't anchor on any candidate
during context-setting.

---

## 7. Threshold for keep-vs-replace decision

### Keep "receipt" if:

- It appears in **≥ 3 of 5 top-3 lists** AND
- It appears in **≤ 1 bottom-3 list** AND
- No alternative word appears in **4+ top-3 lists**
- French equivalent (*reçu*) does not show strong proof-of-payment
  collision in French sessions

### Replace "receipt" if:

- It appears in **≤ 1 top-3 list** OR
- It appears in **≥ 3 bottom-3 lists** OR
- An alternative word appears in **4+ top-3 lists** with consistent
  positive reasoning across participants

### Per-vertical split if:

- Clinicians consistently reach for *session note* / *compte rendu*
  AND non-clinicians converge on a different word
- The clinical / general split is recommended (not blocked) by the
  Step 7 spec; the threshold is lower for accepting a split than
  for replacing the general anchor

### Inconclusive (most likely outcome):

- Mixed signal across all words; no clear winner; no clear loser
- **Default action: keep "receipt"** for launch and instrument the
  mental-model question (Step 7 onboarding telemetry) to gather
  signal at scale during early access
- Revisit the card sort at 100 active users with telemetry data
  driving candidate refinement

---

## 8. Timeline

| Week | Activity |
|---|---|
| Week 1 | Recruit 5 participants; book sessions for week 2 |
| Week 2 | Run 5 sessions (Mon–Wed); start synthesis |
| Week 3 | Synthesis complete; decision documented; circulated to engineering / design |

**Total elapsed time:** 3 weeks. Decision lands ≥ 4 weeks before
public launch so engineering has time to swap copy across translation
files if a replace decision is made.

---

## 9. Deliverables

1. **Decision memo** (1 page) — keep / replace / per-vertical split
   with rationale
2. **Vote-tally chart** — visual showing which words landed where
3. **Quote bank** — top quotes per word, anonymized
4. **Recommendations for instrumented validation** — what to
   measure post-launch via the Step 7 mental-model telemetry
5. **Recordings (with consent)** — archived for future reference;
   not redistributed

Deliverables filed at `_bmad-output/research/card-sort-receipt-anchor/`
when complete.
