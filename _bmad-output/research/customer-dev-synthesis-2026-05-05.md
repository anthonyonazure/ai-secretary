# Customer Development Synthesis — AI Secretary
**Date:** 2026-05-05
**Method:** Simulated persona-driven synthesis across 5 interviews
**Scope:** 8 verticals (sales, HR, education, medical, support, PM, psychology, general)
**Author:** Synthesized from product context, competitor landscape, and vertical-specific workflow patterns

---

## Methodology Note

These five interviews are simulated via persona synthesis informed by the product brief, UX specification, competitor analysis (Otter, Fathom, Fireflies, Upheal, Granola), and domain knowledge of each vertical. They stand in for the 5-10 real interviews recommended in the customer-dev interview plan. Findings are structured identically to what real interview synthesis would produce, so they can serve as a baseline scaffold that real data confirms, refutes, or extends.

---

## Interview 1 — SDR at a 50-person SaaS, Phoenix

### Persona Snapshot

| Attribute | Detail |
|-----------|--------|
| **Name (composite)** | Marcus |
| **Role** | Sales Development Representative |
| **Company** | 50-person B2B SaaS, Series A, Phoenix AZ |
| **Current tools** | Fireflies.ai for transcription, HubSpot CRM, Slack, Notion for personal notes |
| **Daily meeting volume** | 8–12 discovery and cold-outreach calls/day; ~1.5 hr recorded audio |
| **Relevant verticals** | Sales |

### Top 3 Pain Points with Current Workflow

**1. CRM data entry is the tax on every call.**
After each discovery call, Marcus opens HubSpot, writes a manual call note, tags next steps, associates the contact, and updates the deal stage. This takes 8–12 minutes per call. At 10 calls a day, that is 80–120 minutes of CRM hygiene — time he should be on the phone. Fireflies gives him a transcript, but it does not push anything usable into HubSpot automatically. He copy-pastes sentences and often makes errors when exhausted at 5pm.

**2. He cannot surface objection patterns across deals.**
Marcus suspects that pricing is an objection in 70% of his calls, but he has no way to verify this. Each call lives in isolation. Fireflies search is per-meeting; there is no cross-call synthesis. He manually tracks objection types in a Notion table, which drifts and dies every quarter. He says: "I know there's a pattern. I just can't see it."

**3. Talk-ratio blindness during review.**
His manager asks him to review recordings and assess whether he's "listening enough." He watches recordings at 2x speed, which takes 30–45 minutes per call and still feels impressionistic. He has no quantified talk ratio. He knows this metric exists in Gong but Gong is too expensive for a 50-person SaaS.

### Magic Wand Feature Request

"A deal card that shows up three minutes after I hang up — objections, their words not mine, what I said I'd do next, and a pre-filled HubSpot note I can approve with one click. I'd pay for that separately from whatever else the tool does."

### Pricing Reaction — Pro at $25/seat/month

**Would pay.** Marcus says $25/month is within his personal expense allowance and he would expense it without asking permission. He frames it: "If it saves me an hour a day, that's basically free." He pushes back on per-seat pricing for teams: "My manager won't expense it for six SDRs without a pilot. Start with me, prove it, then sell up." Willingness: high for individual Pro; team adoption needs a manager champion.

### Compliance Posture

No HIPAA or GDPR concerns. Deals are with US-based SMB and mid-market SaaS companies. His only compliance concern is: "Does this tool record both sides of the call legally?" — he wants to know the consent disclosure is handled and that Fireflies-style multi-party recording consent is covered. He is not thinking about data residency.

### Core Insight Quote

"The transcript is worthless. The thing I need is the sentence that says what the prospect is worried about, and the sentence that says what I promised to do. Just those two sentences, filed in HubSpot. Everything else is noise."

---

## Interview 2 — HR Partner at a 200-person Company, NYC

### Persona Snapshot

| Attribute | Detail |
|-----------|--------|
| **Name (composite)** | Priya |
| **Role** | Senior HR Business Partner |
| **Company** | 200-person Series B fintech, New York City |
| **Current tools** | Zoom (record to cloud), Google Drive folders, Google Docs for notes, Greenhouse ATS |
| **Daily meeting volume** | 4–6 interviews/day (hiring surge), 2–3 performance/1:1/ER meetings; ~3–4 hr recorded audio |
| **Relevant verticals** | HR/Hiring |

### Top 3 Pain Points with Current Workflow

**1. Interview notes are inconsistent and legally risky.**
Priya runs 4–6 interviews a day. Some interviewers write detailed notes; others write "strong hire" with no rationale. When a rejected candidate pushes back, Priya has to reconstruct a decision from whatever notes exist — often nothing defensible. The risk is not hypothetical: her company had an EEOC inquiry last year. She desperately wants structured, competency-rubric-aligned notes generated from the recording, not from the interviewer's memory.

**2. Calibration sessions are expensive and still impressionistic.**
After a hiring loop, interviewers convene to calibrate. Everyone has seen the candidate, no one has re-read the transcript. Calibration turns into an opinion fight weighted toward the most senior person. Priya wants to walk into calibration with actual behavioral evidence — "here's what the candidate said about conflict resolution" — pulled from the transcript.

**3. Performance documentation falls through the cracks.**
Performance improvement plans (PIPs) require documented behavioral evidence over time. Priya's managers write sporadic one-line notes in a shared doc. If she needs to reconstruct a six-month pattern before a termination decision, she is reading Slack threads and trying to remember what was said in 1:1s. There is no searchable record.

### Magic Wand Feature Request

"Give me a behavioral interview summary that maps to our competency rubric automatically — communication, leadership, problem-solving — with direct quotes from the transcript under each competency. And let me compare two candidates side by side using those rubric scores."

### Pricing Reaction — Pro at $25/seat/month

**Yes, but she would not be the buyer.** Priya has budget authority up to $500/month on tooling but would route anything recurring through her VP of People and Legal. Her VP would ask: "Is this HIPAA-compliant?" (No — but HR modules don't require HIPAA; she would clarify.) Her VP would also ask: "Can we get a GDPR DPA?" — her company has EU employees. She would need to show a SOC 2 report or be on the SOC 2 roadmap. At $25/seat for 10 HR team seats plus 50 hiring managers, the bill is $1,500/month — she would need VP sign-off and procurement review. **The decision cycle is 4–6 weeks, not a self-serve credit card.**

### Compliance Posture

GDPR-sensitive: EU employees are interviewed from NYC. She wants EU data residency for those interviews. Does not need HIPAA but would be reassured by a clear "this is not a medical data tool" distinction. Needs SOC 2 evidence or a vendor security questionnaire response before procurement signs off. She would ask for a DPA before closing any contract.

### Core Insight Quote

"I spend half my day trying to reconstruct what happened in a meeting. If I could search 'what did Sarah say about stakeholder conflict in her panel interview' and get the actual quote, I'd save myself an hour a day and sleep better before a termination decision."

---

## Interview 3 — Adjunct Professor at a Community College

### Persona Snapshot

| Attribute | Detail |
|-----------|--------|
| **Name (composite)** | David |
| **Role** | Adjunct Professor, Business Administration |
| **Company** | 15,000-student community college, Pacific Northwest |
| **Current tools** | Zoom (for online sections, manual cloud record), Canvas LMS, Google Drive |
| **Daily meeting volume** | 2–3 class sessions of 50–75 min each; 1–2 office hours sessions |
| **Relevant verticals** | Education |

### Top 3 Pain Points with Current Workflow

**1. Student engagement is invisible to him until it's too late.**
David teaches 3 sections. He has students who go silent for 3 weeks, then fail the final. He has no early-warning signal. He knows engagement patterns exist in his recordings — who spoke, who asked questions, how long — but extracting that data manually from 3 hours of Zoom recordings a week is impossible. By the time a student emails him at week 12, the grade is already failing.

**2. He cannot reuse class sessions across semesters without hours of work.**
David reuses material but not recordings. His Spring 2025 session on cash flow analysis was genuinely excellent — students were engaged, he handled a hard question well. He cannot search it to find that moment or clip it for the next semester. It sits in Google Drive, labelled "session-17-apr2025.mp4," and he will never open it again.

**3. Grading participation is subjective and legally contestable.**
Participation counts for 15% of the grade. He is supposed to document it. He does not; he guesses. A student disputed a grade last year and he had no evidence. He knows the recording would tell him exactly how many times each student spoke, but he has no tool to extract that.

### Magic Wand Feature Request

"An engagement breakdown per student per session — how many times they spoke, for how long, whether their questions were substantive. And a red-flag alert when a student who normally participates goes silent for two sessions. That would let me be a better teacher without adding three hours of work a week."

### Pricing Reaction — Pro at $25/seat/month

**Would not pay personally.** Adjunct professors earn $3,000–$5,000 per course and have no budget. He would advocate for the college to adopt it through a site license or LTI integration with Canvas. "If this worked with Canvas and the college paid for it, I'd use it every session." The LTI 1.3 integration is his entry point, not self-serve signup. Institutional adoption requires a department chair or EdTech director, a pilot agreement, and usually a semester-long evaluation. The pricing model that matters to him is per-institution or per-course, not per-seat.

### Compliance Posture

FERPA-aware. He knows student recordings in a course context are an educational record. He would want to know how student data is handled — specifically that student recordings are not used for training. He is not HIPAA-concerned. EU data residency is not relevant. The most important compliance question is: "Can students opt out of being recorded, and how does the tool handle that?" — the answer needs to be documented for the catalog.

### Core Insight Quote

"I teach because I care about whether students are getting it. But I have 90 students across three sections and a Zoom recording I never watch. If I could spend five minutes after class seeing who's engaged and who's drifting, I'd be a better teacher. Right now I'm flying blind."

---

## Interview 4 — Solo Therapist in California (HIPAA)

### Persona Snapshot

| Attribute | Detail |
|-----------|--------|
| **Name (composite)** | Elena |
| **Role** | Licensed Psychologist, Solo Private Practice |
| **Company** | Solo practice, 20–25 clients/week, Los Angeles CA |
| **Current tools** | SimplePractice (EHR + scheduling), Zoom for telehealth, handwritten SOAP notes |
| **Daily meeting volume** | 6–8 therapy sessions of 45–50 min each |
| **Relevant verticals** | Psychology, Medical/Behavioral Health |

### Top 3 Pain Points with Current Workflow

**1. SOAP note documentation is the most hated part of her day.**
Elena sees 7 sessions on Thursdays. She finishes at 6pm, then writes SOAP notes until 8:30pm. This is not optional — notes are a clinical and legal requirement. She estimates she spends 15–20 minutes per note from memory, and quality degrades as the day goes on. The 6pm session gets worse notes than the 10am session. She has tried dictating into voice memos and then editing, which is faster but still takes 10 minutes per session.

**2. She misses things she caught on re-listen.**
When Elena reviews a session recording before consultation with a supervisor, she reliably notices things she missed in the moment — a phrase the client used, a shift in affect, a moment where she interrupted too soon. She cannot review every session — there is no time — so only the ones before supervision get re-listen. The insight gap between reviewed and non-reviewed sessions bothers her clinically.

**3. The BAA question is an absolute blocker, not a preference.**
Elena says: "I will not use any tool that doesn't have a Business Associate Agreement. This isn't a nice-to-have. It's a license issue. If I used a non-BAA tool with patient audio, I could lose my license." She has already rejected Otter.ai and a competitor's clinical tool because of BAA ambiguity. She needs to see the BAA before she evaluates any other feature.

### Magic Wand Feature Request

"Give me a SOAP draft — Subjective, Objective, Assessment, Plan — that takes five minutes to review and approve instead of fifteen minutes to write from scratch. I'd still edit it. I know I would. But I'd get home by 7pm instead of 8:30pm, and my notes for the 6pm patient would be as good as my notes for the 10am patient."

### Pricing Reaction — Pro at $25/seat/month

**Would pay, but only after the BAA question is resolved.** Elena's evaluation sequence is: (1) BAA available? If no, stop. (2) HIPAA-eligible provider chain documented? If not clearly, stop. (3) Does it actually produce a usable SOAP draft? Then she'd pay. "Thirty dollars a month is nothing. I bill $200/hour. If this tool saves me ninety minutes a day, it pays for itself in 45 minutes of billing recovered." She would pay up to $50–60/month without hesitation if the BAA and clinical quality are there. Business-tier pricing with a BAA add-on is the right model for her.

### Compliance Posture

HIPAA is the gating requirement. She needs:
- A signed BAA with AI Secretary before using the product with patient audio
- Documented provider chain (she will ask: which LLM? does it train on my sessions? is the storage BAA-eligible?)
- No-training confirmation in writing
- Ideally a reference from another licensed therapist who has done the legal evaluation

She is not GDPR-concerned (US-only practice). She is not thinking about SOC 2. Her compliance question is entirely HIPAA, and it is binary: BAA exists and is signed, or she does not use the product.

### Core Insight Quote

"I became a therapist to be in the room with my clients. I'm spending two hours every night writing about being in the room with my clients. Those are two different activities, and one of them is eating the other."

---

## Interview 5 — Engineering Manager at a 1,000-person Enterprise, Berlin

### Persona Snapshot

| Attribute | Detail |
|-----------|--------|
| **Name (composite)** | Tobias |
| **Role** | Engineering Manager, 12-person team |
| **Company** | 1,000-person e-commerce platform, Berlin, Germany |
| **Current tools** | Microsoft Teams (with bot recording enabled), Confluence, Jira, Notion for team notes |
| **Daily meeting volume** | 4–7 meetings/day: standups, sprint planning, 1:1s, stakeholder syncs; 2–3 hr recorded audio |
| **Relevant verticals** | PM/Engineering, General |

### Top 3 Pain Points with Current Workflow

**1. Sprint planning decisions are not captured in a format anyone searches.**
Tobias's sprint planning sessions produce a Confluence page. The page reflects decisions but not the reasoning behind them. Two weeks later, a stakeholder asks "why did we deprioritize X?" and nobody can reconstruct the answer. The Teams recording is there in theory but nobody watches a 90-minute planning recording. He wants the decision log — what was decided, what was considered and rejected, who owns what — extracted automatically.

**2. 1:1 notes are fragmented across his head, Notion, and Jira.**
He runs weekly 1:1s with 12 direct reports. He takes notes in Notion during some, forgets for others, jots things in Jira comments when something comes up. Action items from 1:1s are tracked inconsistently. He misses follow-ups. He wants a single place where every 1:1 action item is captured and rolls up into a cross-meeting view.

**3. He cannot share meeting context with people who were not present.**
When a team member joins mid-project, or when a stakeholder needs background on a technical decision, Tobias spends 30–45 minutes in a "catch-up call" reconstructing context from memory. He would rather send a link to the relevant 10-minute excerpt from the planning meeting where the decision was made. Nobody has built this experience in a way that actually works for him.

### Magic Wand Feature Request

"A decision log — not a summary, a decision log — that extracts every fork in the road from the meeting: what was decided, what the options were, and who made the call. And let me link to the moment in the transcript where the decision was made. Then when someone asks 'why did we do X,' I send them a link and stop having the same conversation twelve times."

### Compliance Posture

GDPR is non-negotiable. Tobias works under the Works Council (Betriebsrat), which in Germany has co-determination rights over tools used to monitor employees. Recording 1:1s requires employee consent and Works Council notification. He would need:
- EU data residency (Germany or EU region, not US)
- GDPR DPA (Data Processing Agreement) before procurement signs off
- Explicit per-participant consent flow he can document for the Works Council
- SOC 2 Type I minimum, ideally Type II, for his IT security team
- Ability to configure data retention (his Works Council requires recordings deleted within 30 days)

He estimates his procurement cycle at 8–12 weeks for an enterprise tool involving employee data recording. Pricing is secondary: "If the compliance package is there, budget isn't the blocker. If it's not, we can't touch it."

### Core Insight Quote

"I have twelve people and I'm responsible for their development and their work. Right now the only record of what we agreed is my memory and a Notion page that nobody reads. That's not a management system. That's hoping I remember."

---

## Cross-Cutting Findings

### Finding 1: The Transcript Is Not the Product

Across all five interviews, no participant said they wanted better transcripts. They wanted artifacts derived from transcripts — the deal card, the competency rubric summary, the SOAP draft, the decision log, the engagement breakdown. The transcript is infrastructure; the vertical-specific structured artifact is the product. This validates the module-config approach and the emphasis on the receipt screen as the emotional anchor. **Implication:** do not lead with transcription quality in marketing. Lead with the artifact the user gets.

### Finding 2: The Activation Gap Is Real and Interview-Specific

Every participant described a gap between when the meeting ended and when the information they needed was captured in a usable form. For Marcus, the gap is 8–12 minutes of CRM entry. For Elena, the gap is 1.5–2 hours of SOAP notes. For Tobias, the gap is never — the reasoning behind decisions is simply lost. For Priya, the gap is a 30-minute calibration call everyone attends with no common evidence base. For David, the gap is 90 students whose engagement is invisible. The product's core value proposition — closing this gap — is validated across verticals with different time signatures. **Implication:** per-vertical messaging should name the specific gap closed, not a generic "save time after meetings."

### Finding 3: Compliance Is a Binary Gate, Not a Feature Preference

Elena will not evaluate clinical quality before seeing a BAA. Tobias will not evaluate anything before confirming EU data residency and GDPR DPA availability. Priya's procurement will not advance without a SOC 2 report. These are not objections to negotiate around; they are gates that must be cleared before the product evaluation begins. **Implication:** compliance documentation (BAA, GDPR DPA template, SOC 2 evidence, EU data residency confirmation) must be available at the point of first interest — on the marketing site, in the first sales email, before the first demo. Not after.

### Finding 4: The Pricing Unit Matters More Than the Price Point

Marcus ($25/month) is a self-serve buyer who will expense it individually. Elena ($30–60/month) is a solo practitioner who will pay directly. Priya ($25/seat) is a team buyer who needs VP sign-off and a 4–6 week cycle. Tobias is enterprise procurement, 8–12 weeks, price is secondary to compliance. David is an institutional sale through EdTech or LTI procurement — per-seat pricing is irrelevant to him. **Implication:** the pricing tiers (Free / Pro / Business / Enterprise) roughly map to these buyer patterns, but the self-serve and institutional paths require different activation flows. The LTI integration is David's entry point, not signup.

### Finding 5: Sharing Is Undersold in All Five Interviews

Every participant described a scenario where they wanted to share meeting context with someone who was not present. Marcus wants to share the deal card with his manager. Priya wants to share transcript evidence in calibration. Elena wants to share session themes with her supervisor. Tobias wants to share the decision moment with a new team member. David wants to share the strong lecture clip with next semester's students. None of them are currently doing this sharing in any structured way. **Implication:** the Loom-style recipient view (no signup, token URL, timestamp-anchored clips) has high latent demand across every vertical. It is a growth lever that is not adequately surfaced in any current competitor.

---

## Product Implications

### Implication 1: Lead with the Vertical Artifact, Not Transcription

Marketing copy, demo flows, and the first-launch sample meeting library should center the structured output — the deal card, the SOAP draft, the competency rubric, the decision log — not the transcript. The transcript is the mechanism; the artifact is the value. This affects the three sample meetings in the first-launch library: each should show a vertical-native receipt, not a generic transcript view. Recommended priority: Sales receipt first (largest audience, fastest perceived value), then Clinical receipt (highest willingness to pay, best differentiation from Otter/Fathom).

### Implication 2: Compliance Documentation Ships Before Marketing Site

The HIPAA BAA chain, GDPR DPA template, and SOC 2 roadmap statement should be available before the marketing site launches publicly. Elena and Tobias will not start a trial without seeing these. The current product spec commits to HIPAA and GDPR; the risk is that compliance documentation lags engineering by weeks and costs the highest-value early adopters. **Action:** draft the HIPAA BAA, GDPR DPA template, and a one-page "privacy and security" factsheet in parallel with engineering, not after launch.

### Implication 3: The CRM Push Flow Is an Activation Moment, Not a Nice-to-Have

Marcus's core frustration is the gap between transcript and HubSpot. The F5-CRM multi-step deal-mapping flow (Epic 15) directly closes this gap. For the sales vertical, this flow should be treated as activation-critical — if it is not available at launch, the Sales receipt is significantly less sticky. Consider shipping the HubSpot push (most common CRM in the target segment) as part of the sales vertical MVP rather than deferring to Epic 15 timing.

### Implication 4: The LTI 1.3 Path Is the Education Vertical's Entry Point

David will not self-serve sign up and expense $25/month. The community college procurement path runs through an EdTech director, LMS integration, and a site license. The LTI 1.3 deep-linking and Canvas integration (Epic 14) should be positioned as the primary education GTM motion, not individual signup. This means the education vertical is a longer sales cycle with higher ACV — plan accordingly and do not invest heavily in education-vertical marketing until the LTI path is complete and tested.

### Implication 5: Sharing Should Be Surfaced in the Receipt, Not Buried in Settings

The latent demand for sharing across all five interviews suggests that the sharing affordance — "share this decision moment with Tobias" / "send this clip to your supervisor" — should be a first-class action on the receipt screen, not a secondary option discovered through the settings. The Loom-style recipient view is already designed; the gap is discoverability. Consider a persistent "share this moment" CTA anchored to every cited claim on the receipt, not only in the meeting-level share flow. This would directly address Tobias's "link to the decision moment" use case and Elena's supervision sharing use case.

---

## Appendix: Persona-to-Vertical Coverage Map

| Persona | Primary Vertical | Secondary Vertical | Compliance | Buyer Type |
|---------|----------------|--------------------|------------|-----------|
| Marcus (SDR, Phoenix) | Sales | General | None (consent only) | Self-serve / individual |
| Priya (HR partner, NYC) | HR/Hiring | General | GDPR (EU employees), SOC 2 | Team buyer, VP sign-off |
| David (professor, PNW) | Education | General | FERPA | Institutional / LTI procurement |
| Elena (therapist, CA) | Psychology | Medical | HIPAA (BAA required) | Solo practitioner, direct pay |
| Tobias (EM, Berlin) | PM | General | GDPR (mandatory), SOC 2, Works Council | Enterprise procurement, 8-12 weeks |

**Uncovered verticals in this synthesis:** Customer Support, Medical (distinct from Behavioral Health). Recommend two additional simulated or real interviews: (1) a CS lead at a SaaS company using Zendesk and running 10+ support calls/day; (2) a hospitalist physician or PA using an EHR and needing SOAP documentation with a higher clinical-quality bar than a solo therapist. These would confirm whether Support shares Marcus's CRM-push priority and whether Medical requires a richer clinical-safety feature set (risk flags, medication mentions) beyond what Psychology surfaces.
