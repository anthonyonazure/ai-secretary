import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * pino logger factory for `apps/api`.
 *
 * Redaction list per CLAUDE.md "Never log:" rule + architecture.md §
 * Logging. Children are bound per-request via the `request-id` plugin
 * with `requestId`, `tenantId`, `userId`.
 */
const REDACT_PATHS = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'authorization',
  'headers.authorization',
  'headers.cookie',
  'cookie',
  'jwt',
  '*.jwt',
  'apiKey',
  '*.apiKey',
  'mfaSecretEncrypted',
  '*.mfaSecretEncrypted',
];

export const createLogger = (overrides: LoggerOptions = {}): Logger => {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: REDACT_PATHS,
      remove: true,
    },
    base: {
      service: '@aisecretary/api',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...overrides,
  });
};

export type AppLogger = Logger;
