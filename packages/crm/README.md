# @aisecretary/crm

Provider abstraction for HubSpot, Salesforce, and Pipedrive. Owns OAuth token storage/refresh, attendee→contact matching (`matcher.ts`), deal ranking (`ranking.ts`), and the unified `gateway.pushActivity(...)` surface consumed by the `crm.push` queue handler. Provider SDKs are imported here and **only** here — enforced by Biome rule.

Introduced post-architecture in `_bmad-output/planning-artifacts/arch-addendums.md` § 3 (F5-CRM mechanics). See ADR-0004 (PROPOSED) in the same doc.
