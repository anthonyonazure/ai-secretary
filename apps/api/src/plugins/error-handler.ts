import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { HttpError, ValidationError } from '../lib/http-error.js';

/**
 * Converts thrown errors into RFC 7807 Problem Details JSON responses.
 *
 * - `HttpError` subclasses → use their declared status/title/type.
 * - `ZodError` → 422 Validation Failed with structured `errors` extension.
 * - Anything else → 500 with a safe `Internal server error` body. Full
 *   detail goes to the structured logger (with `requestId`) only.
 *
 * Every response carries `requestId` so support tickets are traceable.
 */
const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler(async (error, request, reply) => {
    const requestId = request.requestId ?? 'unknown';
    const instance = request.url;

    if (error instanceof ZodError) {
      const validation = new ValidationError(error.issues[0]?.message ?? 'Invalid input', {
        extensions: {
          errors: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        },
      });
      request.log.info({ err: error, requestId }, 'validation-error');
      return reply
        .status(validation.status)
        .type('application/problem+json')
        .send({
          type: validation.type,
          title: validation.title,
          status: validation.status,
          detail: validation.message,
          instance,
          requestId,
          ...validation.extensions,
        });
    }

    if (error instanceof HttpError) {
      const level = error.status >= 500 ? 'error' : 'info';
      request.log[level]({ err: error, requestId, status: error.status }, 'http-error');
      return reply
        .status(error.status)
        .type('application/problem+json')
        .send({
          type: error.type,
          title: error.title,
          status: error.status,
          detail: error.message,
          instance,
          requestId,
          ...error.extensions,
        });
    }

    // Fastify's own validation errors (when route schemas reject input).
    const fastifyErr = error as { statusCode?: number; message?: string; name?: string };
    if (
      typeof fastifyErr.statusCode === 'number' &&
      fastifyErr.statusCode >= 400 &&
      fastifyErr.statusCode < 500
    ) {
      request.log.info({ err: error, requestId }, 'fastify-4xx');
      return reply
        .status(fastifyErr.statusCode)
        .type('application/problem+json')
        .send({
          type: 'about:blank',
          title: fastifyErr.name || 'Bad Request',
          status: fastifyErr.statusCode,
          detail: fastifyErr.message ?? 'Bad Request',
          instance,
          requestId,
        });
    }

    request.log.error({ err: error, requestId }, 'unhandled-error');
    return reply.status(500).type('application/problem+json').send({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Internal server error',
      instance,
      requestId,
    });
  });
};

export const errorHandlerPlugin = fp(plugin, {
  name: 'error-handler',
});
