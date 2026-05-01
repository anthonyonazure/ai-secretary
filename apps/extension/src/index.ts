/**
 * `@aisecretary/extension` — Chrome extension scaffold (Story 15.3 / FR56).
 *
 * Surfaces AI Secretary meeting receipts inside HubSpot, Salesforce, and
 * Pipedrive. Manifest V3 (service worker + content scripts).
 *
 * Architecture:
 *   - `manifest.json`     — extension declaration
 *   - `src/background.ts` — service worker (auth, message routing)
 *   - `src/content-script.ts` — injects the receipt overlay into CRM pages
 *   - `src/popup.tsx`     — toolbar popup (signed-in state, settings link)
 *   - `src/lib/crm-detector.ts` — sniffs which CRM the user is on
 *   - `src/lib/api-client.ts`   — typed wrapper over the `apps/api` surface
 *
 * The deal-mapping multi-step F5-CRM flow (FR73) lives in the content
 * script's React tree — attendee lookup → contact match → ranked deal
 * list → user picks → optional auto-create → push as activity note +
 * linked transcript. Today we ship the manifest + a thin detector so
 * the scaffold is wired and the F5-CRM flow lands in a follow-up slice.
 */

export const PACKAGE_NAME = '@aisecretary/extension';
export { detectCrmHost } from './lib/crm-detector.js';
export type { CrmHost } from './lib/crm-detector.js';
