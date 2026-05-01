/**
 * `@aisecretary/bot` — meeting-bot provider abstraction.
 *
 * Producer-side counterpart to the receive-side substrate already
 * shipped in `apps/workers/src/handlers/bot-watchdog.ts` (heartbeat
 * loss detection) and `packages/notifications` (`bot-join-failed`
 * notification kind). When `apps/bot` consumes a `bot.join` queue job,
 * the loop:
 *   1. Calls `selectBotProviderKind({ source, mode })` for the kind.
 *   2. Calls `createBotProvider({ kind, zoom?, teams?, mock? })` for the
 *      concrete instance.
 *   3. Drives `BotSession` through the FSM (`applyEvent`) on each
 *      transition; persists the row + emits the audit action +
 *      republishes a heartbeat to Redis every `BOT_HEARTBEAT_INTERVAL_MS`.
 *
 * Provider-isolation discipline (CLAUDE.md): the Zoom Meeting SDK and
 * Microsoft Graph Communications SDK imports stay inside this package.
 * `scripts/check-isolation.ts` is the CI gate.
 */

export const PACKAGE_NAME = '@aisecretary/bot';

export * from './types.js';
export * from './errors.js';
export * from './fsm.js';
export * from './selector.js';
export * from './factory.js';
export { MockBotProvider } from './providers/mock.js';
export type { MockBotProviderOptions, MockJoinFailure } from './providers/mock.js';
export { ZoomBotProvider } from './providers/zoom.js';
export type { ZoomBotProviderConfig } from './providers/zoom.js';
export { TeamsBotProvider } from './providers/teams.js';
export type { TeamsBotProviderConfig } from './providers/teams.js';
