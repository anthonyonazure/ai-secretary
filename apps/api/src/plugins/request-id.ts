import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Decorates `request.requestId` and binds a child logger that includes
 * `requestId` in every log line. Echoes the id in the `x-request-id`
 * response header so clients can quote it in support tickets.
 *
 * Order: register FIRST in `server.ts` so subsequent plugins can rely on
 * `request.requestId` and `request.log` already being request-scoped.
 */
const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorateRequest('requestId', '');

  fastify.addHook('onRequest', async (request, reply) => {
    const supplied = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof supplied === 'string' && supplied.length > 0 && supplied.length <= 128
        ? supplied
        : randomUUID();
    request.requestId = requestId;
    reply.header(REQUEST_ID_HEADER, requestId);
    request.log = request.log.child({ requestId });
  });
};

export const requestIdPlugin = fp(plugin, {
  name: 'request-id',
});
