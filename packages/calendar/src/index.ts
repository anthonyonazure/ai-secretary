/**
 * `@aisecretary/calendar` — provider-agnostic calendar abstraction.
 *
 * Public surface (consumers should NOT reach into individual provider
 * files; everything is re-exported from this index for stability):
 *
 *   - Contracts: `CalendarProvider`, `CalendarEvent`,
 *     `ListUpcomingInput`, `CalendarSourceKind`.
 *   - Implementations: `NylasCalendarProvider`, `MockCalendarProvider`.
 *   - Errors: `NylasCalendarError`.
 *
 * Provider-abstraction discipline (CLAUDE.md): the Nylas wire format
 * is imported only inside `nylas.ts`. The grep gate at
 * `apps/api/scripts/check-isolation.ts` (when it exists) fails CI if
 * Nylas-specific imports surface outside `packages/calendar`.
 */

export const PACKAGE_NAME = '@aisecretary/calendar';

export * from './types.js';
export { MockCalendarProvider } from './mock.js';
export {
  NylasCalendarProvider,
  NylasCalendarError,
} from './nylas.js';
export type { NylasCalendarProviderConfig } from './nylas.js';
