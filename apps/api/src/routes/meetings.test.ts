import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import type {
  MultipartCompleteResult,
  MultipartUploadInit,
  ObjectMetadata,
  PresignedPutOptions,
  PresignedUrl,
  StorageProvider,
} from '@aisecretary/storage';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';
import {
  InMemoryMeetingsRepository,
  type MeetingSummaryRow,
  type MeetingsRepository,
  type SpeakerTurnRow,
} from './meetings-repository.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  LOG_LEVEL: 'error',
};

class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, AuthUserRow>();
  public readonly tenants = new Map<string, AuthTenantRow>();

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    for (const u of this.users.values()) if (u.email === email.toLowerCase()) return u;
    return null;
  }
  async findUserById(userId: string): Promise<AuthUserRow | null> {
    return this.users.get(userId) ?? null;
  }
  async findTenantById(tenantId: string): Promise<AuthTenantRow | null> {
    return this.tenants.get(tenantId) ?? null;
  }
  async createTenant(input: CreateTenantInput): Promise<AuthTenantRow> {
    const row: AuthTenantRow = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      region: input.region,
    };
    this.tenants.set(row.id, row);
    return row;
  }
  async createUser(input: CreateUserInput): Promise<AuthUserRow> {
    const row: AuthUserRow = {
      id: randomUUID(),
      tenantId: input.tenantId,
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      isMfaEnabled: false,
    };
    this.users.set(row.id, row);
    return row;
  }
  async touchLastLogin(): Promise<void> {}
}

class FakeStorageProvider implements StorageProvider {
  async presignPut(_key: string, _opts: PresignedPutOptions): Promise<PresignedUrl> {
    return { url: 'https://signed/put', expiresAt: new Date(Date.now() + 60_000) };
  }
  async createMultipartUpload(
    key: string,
    _opts: { contentType: string },
  ): Promise<MultipartUploadInit> {
    return { uploadId: `upload-${randomUUID()}`, key };
  }
  async presignPart(_input: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<PresignedUrl> {
    return { url: 'https://signed/part', expiresAt: new Date(Date.now() + 60_000) };
  }
  async uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Uint8Array;
  }): Promise<{ partNumber: number; etag: string }> {
    return { partNumber: input.partNumber, etag: `etag-${input.partNumber}` };
  }
  async completeMultipartUpload(_input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<MultipartCompleteResult> {
    return { etag: 'final-etag', location: 's3://bucket/key' };
  }
  async abortMultipartUpload(_input: { key: string; uploadId: string }): Promise<void> {}
  async presignGet(_key: string, _opts: { expiresInSeconds: number }): Promise<PresignedUrl> {
    return {
      url: 'https://signed/get?token=abc',
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  async headObject(key: string): Promise<ObjectMetadata> {
    return { key, contentType: 'audio/webm', contentLength: 0, etag: null, lastModified: null };
  }
  async delete(_key: string): Promise<void> {}
}

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const buildApp = async (overrides?: {
  consentChecker?: () => Promise<'ok' | 'missing'>;
  meetingsRepository?: MeetingsRepository;
}) => {
  const authRepo = new InMemoryAuthRepository();
  const meetingsRepo = overrides?.meetingsRepository ?? new InMemoryMeetingsRepository();
  const storage = new FakeStorageProvider();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    meetingsRepository: meetingsRepo,
    storageProvider: storage,
    refreshStore,
    consentChecker: overrides?.consentChecker ?? (async () => 'ok'),
  });
  return { app, meetingsRepo, storage };
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: signupBody,
  });
  const body = res.json();
  return {
    accessToken: body.accessToken as string,
    tenantId: body.user.tenantId as string,
  };
};

describe('GET /api/v1/meetings/:meetingId/speaker-turns', () => {
  it('returns turns sorted by sequence ascending', async () => {
    const { app, meetingsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const meetingId = randomUUID();
    const turns: SpeakerTurnRow[] = [
      {
        turnId: 't-02',
        speaker: 'Bob',
        spanStartMs: 12_000,
        spanEndMs: 18_000,
        text: 'Second turn.',
        confidence: 0.92,
        sequence: 2,
      },
      {
        turnId: 't-01',
        speaker: 'Alice',
        spanStartMs: 0,
        spanEndMs: 8_000,
        text: 'First turn.',
        confidence: null,
        sequence: 1,
      },
    ];
    if (meetingsRepo instanceof InMemoryMeetingsRepository) {
      meetingsRepo.setSpeakerTurns(tenantId, meetingId, turns);
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/speaker-turns`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meetingId).toBe(meetingId);
    expect(body.turns).toHaveLength(2);
    expect(body.turns[0].turnId).toBe('t-01');
    expect(body.turns[0].confidence).toBeNull();
    expect(body.turns[1].turnId).toBe('t-02');
    expect(body.turns[1].confidence).toBe(0.92);
    await app.close();
  });

  it('returns an empty list when no turns exist for the meeting', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/speaker-turns`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meetingId).toBe(meetingId);
    expect(body.turns).toEqual([]);
    await app.close();
  });

  it('returns 403 when consent is missing for the meeting', async () => {
    const { app } = await buildApp({ consentChecker: async () => 'missing' });
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/speaker-turns`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const meetingId = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/speaker-turns`,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /api/v1/meetings/:meetingId/playback-url', () => {
  it('returns the presigned URL for the latest completed recording', async () => {
    const { app, meetingsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const meetingId = randomUUID();
    const recordingId = randomUUID();
    if (meetingsRepo instanceof InMemoryMeetingsRepository) {
      meetingsRepo.setRecordings(tenantId, meetingId, [
        {
          id: recordingId,
          storageKey: `tenants/${tenantId}/recordings/${recordingId}.bin`,
          contentType: 'audio/webm',
        },
      ]);
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/playback-url`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recordingId).toBe(recordingId);
    expect(body.url).toBe('https://signed/get?token=abc');
    expect(typeof body.expiresAt).toBe('string');
    expect(body.contentType).toBe('audio/webm');
    await app.close();
  });

  it('returns 404 when no completed recording exists for the meeting', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/playback-url`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns 403 when consent is missing for the meeting', async () => {
    const { app } = await buildApp({ consentChecker: async () => 'missing' });
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/playback-url`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('GET /api/v1/meetings (list)', () => {
  it('returns an empty list when the tenant has no meetings', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
    expect(body.totalCount).toBe(0);
    await app.close();
  });

  it('returns paginated meetings sorted by createdAt DESC', async () => {
    const { app, meetingsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);

    const now = Date.now();
    const rows: MeetingSummaryRow[] = Array.from({ length: 3 }).map((_, i) => ({
      id: randomUUID(),
      title: `Meeting ${i + 1}`,
      source: 'web_recording',
      status: 'analyzed',
      durationSeconds: 1800,
      startedAt: new Date(now - (3 - i) * 60_000),
      endedAt: new Date(now - (3 - i) * 60_000 + 1_800_000),
      createdAt: new Date(now - (3 - i) * 60_000),
    }));
    if (meetingsRepo instanceof InMemoryMeetingsRepository) {
      meetingsRepo.setMeetings(tenantId, rows);
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings?limit=2',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    // DESC by createdAt — Meeting 3 is newest.
    expect(body.items[0].title).toBe('Meeting 3');
    expect(body.items[1].title).toBe('Meeting 2');
    expect(body.totalCount).toBe(3);
    expect(body.nextCursor).not.toBeNull();

    const next = await app.inject({
      method: 'GET',
      url: `/api/v1/meetings?limit=2&cursor=${encodeURIComponent(body.nextCursor)}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(next.statusCode).toBe(200);
    const nextBody = next.json();
    expect(nextBody.items).toHaveLength(1);
    expect(nextBody.items[0].title).toBe('Meeting 1');
    expect(nextBody.nextCursor).toBeNull();
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
