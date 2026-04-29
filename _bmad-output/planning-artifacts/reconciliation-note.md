---
title: Reconciliation Note — Three-Agent Cross-Read
date: 2026-04-29
status: draft (pending Anthony sign-off)
inputs:
  - _bmad-output/planning-artifacts/epics.md (Agent A — revised in place)
  - _bmad-output/planning-artifacts/arch-addendums.md (Agent B — new)
  - _bmad-output/planning-artifacts/open-work/*.md (Agent C — 5 files)
purpose: Surface contradictions, gaps, and naming drift across the three parallel agent outputs before Phase 0 implementation begins.
---

# Reconciliation Note — Three-Agent Cross-Read

## TL;DR

Three agents produced 5,294 lines in isolation. **Eight issues found.** Three are real gaps that would bite during implementation; five are naming-drift / detail-pickup items that get fixed at sprint-planning sharpening time, not now.

**Phase 0 is not blocked.** The three real gaps all live in Epics 4 / 8 / 9 / 12 / 15 — none in the Phase 0 component-build path (Storybook + token pipeline + `RecordingStatusPill` V2 + `AnalysisCard` contract).

---

## P0 — Real gaps (need a decision before sprint planning lands)

### G1 — Cross-tenant audit-log writes are unspecified

**Where it shows up:**
- Agent A — [epics.md](epics.md): FR74 ("share appears as inbound in receiving tenant's audit log"); Story 8.4 AC ("Receiving-tenant audit-log entry written"); Epic 8 + Epic 12 split.
- Agent B — [arch-addendums.md](arch-addendums.md): no addendum on cross-org sharing. `audit_logs` is tenant-scoped via RLS (`current_setting('app.current_tenant_id')`). Writing to a *different* tenant's audit log requires either (a) a privileged service-role path that bypasses RLS, (b) an `inbound_shares` table on the receiving tenant that the audit-logger plugin treats as in-tenant, or (c) a third "platform" audit table that records cross-tenant events.

**Why it matters:** Story 8.4 says the entry is written; Story 12.7 says receiving-org admin views the policy and view-time blocks. Without an architectural decision on the *write path*, sprint planning will stall on Story 8.4 acceptance criteria (or worse, a dev hand-rolls a bypass-RLS path that diverges from `audit-logger` plugin discipline).

**Recommended resolution:** **Add §8 to `arch-addendums.md`** spec'ing cross-tenant audit-write as an `inbound_shares` table on the receiving tenant. Sender-tenant audit row records the outbound share; receiving-tenant `inbound_shares` table records the inbound share with view-time enforcement metadata. Both are in-tenant rows; no RLS bypass needed. Likely rates an ADR-0006 (cross-org sharing model).

**Owner of fix:** Agent B (continue via `agentId: a7d30c0f9369f6fe6` with §8 addendum brief).

---

### G2 — Story 9.5 missing per-participant EU override semantics

**Where it shows up:**
- Agent A — [epics.md](epics.md) Story 9.5 AC: *"Default conservative (EU=explicit, US=legitimate-interest); admin overrides in Epic 12."*
- Agent B — ADR-0005: *"When tenant has US default but EU participant joins, EU participant is treated as explicit-consent (per-participant override). The most-protective applicable rule wins."*

**The drift:** Agent A's wording reads as if admin policy is the only override knob. Agent B is explicit that *participant-level region detection forces the explicit-consent path even for a US-default tenant*. This is a GDPR-driven hard rule, not an admin preference.

**Why it matters:** If sprint planning takes Story 9.5 at face value, devs will implement tenant-policy-only branching and miss the per-participant override. That's a GDPR compliance regression on a meeting where any EU participant is present in a US-tenant org.

**Recommended resolution:** Edit Story 9.5 AC in [epics.md](epics.md) to add: *"Per-participant region detection (`packages/consent/region-detect.ts`) forces explicit-consent path for any EU participant regardless of tenant default — most-protective rule wins per ADR-0005."*

**Owner of fix:** I (Anthony's main session) make this edit directly — one-line AC addition.

---

### G3 — Story 12.1 acceptance criteria don't consume the `tenant_state` FSM

**Where it shows up:**
- Agent A — Story 12.1 AC: prose ("DPA acceptance blocks proceed", "Region pin locked at provision", "Each step audit-logged").
- Agent B — ADR-0004: defines `tenant_state` enum (`draft → dpa_required → dpa_accepted → region_pinning → provisioning → active → ...`) + DB-trigger region immutability + `tenant-state-check` plugin.

**The drift:** Agent A's prose is correct but doesn't reference the canonical state machine values. When the story is sharpened for sprint planning, the AC needs to consume the enum verbatim or implementation will diverge from ADR-0004.

**Why it matters:** Lower-stakes than G1/G2 (sprint-planning catch likely) but worth a pre-emptive fix so the story file matches the architecture contract.

**Recommended resolution:** Edit Story 12.1 AC to explicitly reference enum transitions (`tenants.state` flips through `dpa_required → dpa_accepted → region_pinning → provisioning → active`) and the `tenant-state-check` plugin gate. Also: Story 12.1 should reference the `tenant_settings` table for disclosure / retention / consent-legal-basis fields per ADR-0004.

**Owner of fix:** Edit in main session (one-pass story sharpening, not architectural).

---

## P1 — Naming-drift / detail-pickup (fix at story-sharpening time, not blocking)

### N1 — `recording-watchdog` job name not in Story 4.4

Story 4.4 says "Server detects lost ping >90s → fires push within 60s" without naming the canonical pg-boss job. Agent B §5 names it `recording-watchdog` (every 15s scan, Redis SCAN, etc.). Add to Story 4.4 AC during sprint-planning sharpening.

### N2 — `packages/notifications` not referenced in Story 15.6

Agent B introduces this package (§5 push notification dispatch); Agent A's Story 15.6 says "Expo Push integration" without naming the package boundary. Sprint-planning catch.

### N3 — `packages/consent` not referenced in Story 9.5

Agent B introduces this package (§7 region-detect + consent-orchestrator). Agent A's Story 9.5 doesn't name it. Sprint-planning catch — same fix as G2 above.

### N4 — Story 15.4 audit actions enumerate only one of six

Agent A Story 15.4 names `meeting.pushed-to-crm`. Agent B §3 lists six new audit actions: `meeting.pushed-to-crm`, `meeting.crm-push-failed`, `crm.deal-auto-created`, `crm.contact-auto-created`, `crm.oauth-connected`, `crm.oauth-revoked`. Story 15.4 AC should reference the full set so `apps/api/src/lib/audit-types.ts` lands complete.

### N5 — Speaker-turn-level addressable spans schema not specified anywhere

Agent A Story 2.4 AC says *"Transcript persistence schema includes speaker turns; turns are queryable + addressable"* but doesn't define the addressing scheme. Agent B doesn't spec it. The CitationChip's deep-link contract depends on this (turn ID format, e.g. `(meetingId, spanStartMs, spanEndMs, speaker)`). Recommend the contract gets nailed down in Story 2.4's tech-spec at sprint planning, not deferred to Story 3.5 — otherwise FR78 substrate is brittle.

---

## P2 — Cross-Agent C confirmations (no action needed, just verifying)

### C1 — Agent C's telemetry-ownership-matrix.md aligns with Agent B addendums

- F1.2 heartbeat liveness signal matches Agent B §5 protocol ✓
- F2-admin.1–7 signals match Agent A FR72 + Agent B ADR-0004 step set ✓
- F3.4 bot liveness ping matches Agent B §5 bot heartbeat ✓
- F5.7 CRM deal-mapping resolution path matches Agent A FR73 + Agent B §3 ranking algorithm ✓

### C2 — Agent C's reduced-motion-audit-checklist.md aligns with locked component names

`RecordingStatusPill`, `ReceiptStreamLayout`, `CitationChip`, `ModuleConfirmModal`, `ConsentDisclosureCard` all named consistently. Token references (`--motion-base: 0ms`, `--motion-*`) match Agent B's ADR-0002 token taxonomy. ✓

### C3 — Agent C's open-work documents are downstream of Agents A + B and need no edits from this reconciliation

The open-work bundle is briefs / plans / checklists for human owners (designer, researcher, accessibility lead). They consume the locked specs but don't define new contracts that could drift. Living-document quarterly review takes care of staleness.

---

## Action plan to clear reconciliation

In order:

1. **G1 (cross-tenant audit-log writes)** — re-engage Agent B (`agentId: a7d30c0f9369f6fe6`) to add §8 + ADR-0006 to `arch-addendums.md`. Single focused brief, ~30 min.
2. **G2 (Story 9.5 EU override)** — direct edit to `epics.md` Story 9.5 AC. ~5 min.
3. **G3 (Story 12.1 FSM consumption)** — direct edit to `epics.md` Story 12.1 AC. ~5 min.
4. **N1–N5** — flagged here; deferred to per-sprint story sharpening (the `create-story` workflow run at the start of each sprint will pick these up against this reconciliation note as input).
5. **Confirm with Anthony**, then proceed to Phase 0 (Storybook + token pipeline + `RecordingStatusPill` V2 + `AnalysisCard` contract per Step 11 roadmap).

## What this reconciliation does NOT cover

- **Architectural drift between `docs/architecture.md` (locked) and the new addendums** — by design, addendums extend without touching the locked doc. The `arch-addendums.md` summary table catalogs every cross-reference. Promotion of addendums into `architecture.md` happens after first implementation validates the patterns.
- **PRD drift** — the locked PRD (`docs/mini-prd.md`) is upstream of all three agents and is not relitigated here.
- **UX-spec internal consistency** — Agent A absorbed the UX spec; Agent B implemented its patterns; Agent C extracted its open-work. Internal UX-spec consistency was the responsibility of the previous workflow step (`create-ux-design`, locked 2026-04-29).
