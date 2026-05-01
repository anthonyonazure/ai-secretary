import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { NotificationRequest } from '@aisecretary/notifications';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { createAnalysisCompletedNotifyHandler } from './analysis-completed-notify.js';

const buildFakeDb = (): Db =>
  ({
    transaction: vi.fn(async (cb: (tx: { execute: () => Promise<void> }) => Promise<unknown>) =>
      cb({ execute: async () => undefined }),
    ),
  }) as unknown as Db;

describe('createAnalysisCompletedNotifyHandler', () => {
  it('rejects an invalid payload', async () => {
    const handler = createAnalysisCompletedNotifyHandler({
      db: buildFakeDb(),
      logger: pino({ level: 'silent' }),
      enqueueNotification: async () => {},
    });
    await expect(handler({ data: { tenantId: 'no', meetingId: 'no' } as never })).rejects.toThrow(
      /invalid payload/,
    );
  });

  it('enqueues a push notification for the owner', async () => {
    const enqueued: NotificationRequest[] = [];
    const handler = createAnalysisCompletedNotifyHandler({
      db: buildFakeDb(),
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => new Date('2026-04-30T12:00:00Z'),
    });
    await handler({
      data: {
        tenantId: randomUUID(),
        meetingId: randomUUID(),
        ownerUserId: randomUUID(),
        region: 'us',
        hubAppKinds: [],
      },
    });
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.kind).toBe('analysis-completed');
    expect(enqueued[0]?.recipient.channel).toBe('push');
  });

  it('fans out hub-app dispatches when configured', async () => {
    const enqueued: NotificationRequest[] = [];
    const handler = createAnalysisCompletedNotifyHandler({
      db: buildFakeDb(),
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => new Date('2026-04-30T12:00:00Z'),
    });
    await handler({
      data: {
        tenantId: randomUUID(),
        meetingId: randomUUID(),
        ownerUserId: randomUUID(),
        region: 'us',
        hubAppKinds: ['meeting-receipt-slack', 'meeting-receipt-teams'],
      },
    });
    expect(enqueued).toHaveLength(3); // 1 push + 2 hub
    expect(enqueued.map((e) => e.kind).sort()).toEqual([
      'analysis-completed',
      'meeting-receipt-slack',
      'meeting-receipt-teams',
    ]);
  });

  it('uses the supplied meetingUrl when provided', async () => {
    const enqueued: NotificationRequest[] = [];
    const handler = createAnalysisCompletedNotifyHandler({
      db: buildFakeDb(),
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => new Date('2026-04-30T12:00:00Z'),
    });
    const meetingId = randomUUID();
    const customUrl = `https://app.aisecretary.app/meetings/${meetingId}`;
    await handler({
      data: {
        tenantId: randomUUID(),
        meetingId,
        ownerUserId: randomUUID(),
        region: 'us',
        hubAppKinds: ['meeting-receipt-slack'],
        meetingUrl: customUrl,
      },
    });
    const slack = enqueued.find((e) => e.kind === 'meeting-receipt-slack');
    if (!slack) throw new Error('expected slack dispatch');
    const ctx = (slack.payload as { context?: { meetingUrl?: string } }).context;
    expect(ctx?.meetingUrl).toBe(customUrl);
  });

  it('honors a custom resolveMeetingUrl', async () => {
    const enqueued: NotificationRequest[] = [];
    const handler = createAnalysisCompletedNotifyHandler({
      db: buildFakeDb(),
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      resolveMeetingUrl: async () => 'https://example.com/custom-resolved',
      now: () => new Date('2026-04-30T12:00:00Z'),
    });
    await handler({
      data: {
        tenantId: randomUUID(),
        meetingId: randomUUID(),
        ownerUserId: randomUUID(),
        region: 'us',
        hubAppKinds: ['meeting-receipt-slack'],
      },
    });
    const slack = enqueued.find((e) => e.kind === 'meeting-receipt-slack');
    if (!slack) throw new Error('expected slack dispatch');
    const ctx = (slack.payload as { context?: { meetingUrl?: string } }).context;
    expect(ctx?.meetingUrl).toBe('https://example.com/custom-resolved');
  });
});
