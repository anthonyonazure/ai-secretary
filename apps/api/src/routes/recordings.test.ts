import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore, signAccessToken } from '@aisecretary/auth';
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
import { InMemoryTranscribeEnqueuer } from '../lib/transcribe-enqueue.js';
import { InMemoryHeartbeatStore } from '../plugins/redis.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';
import type {
  CreateRecordingInput,
  RecordingRow,
  RecordingsRepository,
} from './recordings-repository.js';
import { InMemoryNotificationEnqueuer } from './recordings.js';

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

class InMemoryRecordingsRepository implements RecordingsRepository {
  public readonly rows = new Map<string, RecordingRow>();

  async create(input: CreateRecordingInput): Promise<RecordingRow> {
    const row: RecordingRow = {
      id: input.id ?? randomUUID(),
      tenantId: input.tenantId,
      meetingId: input.meetingId ?? null,
      ownerUserId: input.ownerUserId,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes ?? null,
      status: 'uploading',
      s3UploadId: input.s3UploadId,
      startedAt: new Date(),
      uploadedAt: null,
      transcribedAt: null,
      failureReason: null,
    };
    this.rows.set(row.id, row);
    return row;
  }
  async findById(recordingId: string, tenantId: string): Promise<RecordingRow | null> {
    const row = this.rows.get(recordingId);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }
  async markUploaded(input: { recordingId: string; tenantId: string }): Promise<RecordingRow> {
    const row = this.rows.get(input.recordingId);
    if (!row) throw new Error('not found');
    const updated: RecordingRow = { ...row, status: 'uploaded', uploadedAt: new Date() };
    this.rows.set(updated.id, updated);
    return updated;
  }
  async markTranscribing(input: {
    recordingId: string;
    tenantId: string;
  }): Promise<RecordingRow> {
    const row = this.rows.get(input.recordingId);
    if (!row) throw new Error('not found');
    const updated: RecordingRow = { ...row, status: 'transcribing' };
    this.rows.set(updated.id, updated);
    return updated;
  }
  async markCompleted(input: { recordingId: string; tenantId: string }): Promise<RecordingRow> {
    const row = this.rows.get(input.recordingId);
    if (!row) throw new Error('not found');
    const updated: RecordingRow = { ...row, status: 'completed', transcribedAt: new Date() };
    this.rows.set(updated.id, updated);
    return updated;
  }
  async markFailed(input: {
    recordingId: string;
    tenantId: string;
    reason: string;
  }): Promise<RecordingRow> {
    const row = this.rows.get(input.recordingId);
    if (!row) throw new Error('not found');
    const updated: RecordingRow = { ...row, status: 'failed', failureReason: input.reason };
    this.rows.set(updated.id, updated);
    return updated;
  }
}

class FakeStorageProvider implements StorageProvider {
  public readonly multiparts = new Map<string, { key: string; aborted: boolean }>();
  public readonly completed: Array<{ key: string; uploadId: string; partsCount: number }> = [];

  async presignPut(_key: string, _opts: PresignedPutOptions): Promise<PresignedUrl> {
    return { url: 'https://signed/put', expiresAt: new Date(Date.now() + 60_000) };
  }
  async createMultipartUpload(
    key: string,
    _opts: { contentType: string },
  ): Promise<MultipartUploadInit> {
    const uploadId = `upload-${randomUUID()}`;
    this.multiparts.set(uploadId, { key, aborted: false });
    return { uploadId, key };
  }
  async presignPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<PresignedUrl> {
    return {
      url: `https://signed/${input.uploadId}/part-${input.partNumber}`,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  async uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Uint8Array;
  }): Promise<{ partNumber: number; etag: string }> {
    return {
      partNumber: input.partNumber,
      etag: `etag-${input.partNumber}-${input.body.byteLength}`,
    };
  }
  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<MultipartCompleteResult> {
    this.completed.push({
      key: input.key,
      uploadId: input.uploadId,
      partsCount: input.parts.length,
    });
    return { etag: 'final-etag', location: `s3://bucket/${input.key}` };
  }
  async abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void> {
    const entry = this.multiparts.get(input.uploadId);
    if (entry) {
      entry.aborted = true;
    }
  }
  async presignGet(_key: string, _opts: { expiresInSeconds: number }): Promise<PresignedUrl> {
    return { url: 'https://signed/get', expiresAt: new Date(Date.now() + 60_000) };
  }
  async headObject(key: string): Promise<ObjectMetadata> {
    return { key, contentType: 'audio/webm', contentLength: 0, etag: null, lastModified: null };
  }
  async delete(_key: string): Promise<void> {}
}

const buildTestApp = async () => {
  const authRepo = new InMemoryAuthRepository();
  const recRepo = new InMemoryRecordingsRepository();
  const storage = new FakeStorageProvider();
  const enqueuer = new InMemoryTranscribeEnqueuer();
  const refreshStore = new InMemoryRefreshTokenStore();
  const notificationEnqueuer = new InMemoryNotificationEnqueuer();
  const heartbeatStore = new InMemoryHeartbeatStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    recordingsRepository: recRepo,
    storageProvider: storage,
    transcribeEnqueuer: enqueuer,
    refreshStore,
    consentChecker: async () => 'ok',
    notificationEnqueuer,
    heartbeatStore,
  });
  return { app, authRepo, recRepo, storage, enqueuer, notificationEnqueuer, heartbeatStore };
};

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildTestApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: signupBody,
  });
  const body = res.json();
  return {
    accessToken: body.accessToken as string,
    user: body.user,
  };
};

describe('recordings routes', () => {
  it('POST /initiate creates a recording row and returns upload id + key', async () => {
    const { app, recRepo, storage } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.recordingId).toMatch(/^[0-9a-f-]+$/);
    expect(body.uploadId).toMatch(/^upload-/);
    expect(body.key).toContain(`recordings/${body.recordingId}.bin`);
    expect(body.key).toMatch(/^tenants\//);
    expect(recRepo.rows.size).toBe(1);
    expect(storage.multiparts.size).toBe(1);
    await app.close();
  });

  it('POST /initiate returns 401 without auth', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      payload: { contentType: 'audio/webm' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /:id/parts/:n returns a presigned URL', async () => {
    const { app } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId } = init.json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/parts/1`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.partNumber).toBe(1);
    expect(body.url).toContain('part-1');
    expect(typeof body.expiresAt).toBe('string');
    await app.close();
  });

  it('POST /:id/parts/:n returns 400-class for out-of-range part number', async () => {
    const { app } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId } = init.json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/parts/99999`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /:id/complete finalises and enqueues a transcribe job', async () => {
    const { app, recRepo, storage, enqueuer } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId } = init.json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/complete`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        parts: [
          { partNumber: 1, etag: 'etag-1' },
          { partNumber: 2, etag: 'etag-2' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recordingId).toBe(recordingId);
    expect(body.status).toBe('uploaded');
    expect(body.transcribeJobId).toMatch(/^mem-/);
    expect(storage.completed.length).toBe(1);
    expect(storage.completed[0]?.partsCount).toBe(2);
    expect(enqueuer.jobs.length).toBe(1);
    expect(enqueuer.jobs[0]?.payload.recordingId).toBe(recordingId);
    expect(recRepo.rows.get(recordingId)?.status).toBe('uploaded');
    await app.close();
  });

  it('POST /:id/abort marks failed and aborts the multipart upload', async () => {
    const { app, recRepo, storage } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId, uploadId } = init.json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/abort`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'user-cancelled' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('failed');
    expect(storage.multiparts.get(uploadId)?.aborted).toBe(true);
    expect(recRepo.rows.get(recordingId)?.failureReason).toBe('user-cancelled');
    await app.close();
  });

  it('GET /:id returns the recording row', async () => {
    const { app } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId } = init.json();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recordingId).toBe(recordingId);
    expect(body.status).toBe('uploading');
    await app.close();
  });

  it('GET /:id returns 404 for unknown recording', async () => {
    const { app } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns 403 when consent is missing for /parts and /complete', async () => {
    const authRepo = new InMemoryAuthRepository();
    const recRepo = new InMemoryRecordingsRepository();
    const storage = new FakeStorageProvider();
    const enqueuer = new InMemoryTranscribeEnqueuer();
    const refreshStore = new InMemoryRefreshTokenStore();
    const meetingId = randomUUID();
    // Consent checker fails for this meeting.
    const app = await buildServer({
      env: TEST_ENV,
      authRepository: authRepo,
      recordingsRepository: recRepo,
      storageProvider: storage,
      transcribeEnqueuer: enqueuer,
      refreshStore,
      consentChecker: async () => 'missing',
    });
    const signup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signup.json();
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm', meetingId },
    });
    expect(init.statusCode).toBe(201);
    const { recordingId } = init.json();
    const partRes = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/parts/1`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(partRes.statusCode).toBe(403);
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/complete`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { parts: [{ partNumber: 1, etag: 'e1' }] },
    });
    expect(completeRes.statusCode).toBe(403);
    await app.close();
  });

  it('skips the consent gate when the recording has no meetingId', async () => {
    const { app } = await buildTestApp();
    const { accessToken } = await signupAndAuth(app);
    // Initiate without meetingId.
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/initiate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { contentType: 'audio/webm' },
    });
    const { recordingId } = init.json();
    // Even with consentChecker = ok in buildTestApp, the resolver
    // returns null → gate skipped.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/parts/1`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  describe('POST /:id/heartbeat (Story 4.4)', () => {
    it('204s and writes the heartbeat to the store', async () => {
      const { app, recRepo, heartbeatStore } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      // Sanity: heartbeat is missing before the first ping.
      expect(await heartbeatStore.isHeartbeatLost(recordingId)).toBe(true);
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${recordingId}/heartbeat`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(204);
      expect(await heartbeatStore.isHeartbeatLost(recordingId)).toBe(false);
      // Recording row is unchanged.
      expect(recRepo.rows.get(recordingId)?.status).toBe('uploading');
      await app.close();
    });

    it('returns 404 when the recording is in a terminal state', async () => {
      const { app, recRepo } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      const row = recRepo.rows.get(recordingId);
      if (!row) throw new Error('precondition: recording row missing');
      row.status = 'completed';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${recordingId}/heartbeat`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 for unknown recording id', async () => {
      const { app } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${randomUUID()}/heartbeat`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 401 without auth', async () => {
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${randomUUID()}/heartbeat`,
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 403 when consent is missing for a meeting-bound recording', async () => {
      const authRepo = new InMemoryAuthRepository();
      const recRepo = new InMemoryRecordingsRepository();
      const storage = new FakeStorageProvider();
      const enqueuer = new InMemoryTranscribeEnqueuer();
      const refreshStore = new InMemoryRefreshTokenStore();
      const heartbeatStore = new InMemoryHeartbeatStore();
      const meetingId = randomUUID();
      const app = await buildServer({
        env: TEST_ENV,
        authRepository: authRepo,
        recordingsRepository: recRepo,
        storageProvider: storage,
        transcribeEnqueuer: enqueuer,
        refreshStore,
        consentChecker: async () => 'missing',
        heartbeatStore,
      });
      const signup = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: signupBody,
      });
      const { accessToken } = signup.json();
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm', meetingId },
      });
      const { recordingId } = init.json();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${recordingId}/heartbeat`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('POST /:id/abort with reason=upload-retry-exhausted (Story 4.5)', () => {
    it('enqueues push + email escalation when reason is upload-retry-exhausted', async () => {
      const { app, notificationEnqueuer } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${recordingId}/abort`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { reason: 'upload-retry-exhausted' },
      });
      expect(res.statusCode).toBe(200);
      expect(notificationEnqueuer.jobs.length).toBe(2);
      const kinds = notificationEnqueuer.jobs.map((j) => j.payload.kind);
      expect(kinds).toEqual(['upload-retry-exhausted', 'upload-retry-exhausted']);
      const channels = notificationEnqueuer.jobs.map((j) => j.payload.recipient.channel);
      expect(channels.sort()).toEqual(['email', 'push']);
      const dedupKeys = notificationEnqueuer.jobs.map((j) => j.payload.dedupKey);
      expect(dedupKeys[0]).toBe(`upload-retry-exhausted:${recordingId}`);
      expect(dedupKeys[1]).toBe(`upload-retry-exhausted:${recordingId}:email`);
      await app.close();
    });

    it('does NOT enqueue notifications for an unrelated abort reason', async () => {
      const { app, notificationEnqueuer } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/recordings/${recordingId}/abort`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { reason: 'user-cancelled' },
      });
      expect(res.statusCode).toBe(200);
      expect(notificationEnqueuer.jobs.length).toBe(0);
      await app.close();
    });
  });

  describe('GET /:id/play (presigned-GET playback URL)', () => {
    it('returns the playback URL when the recording is completed', async () => {
      const { app, recRepo } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      // Drive the FSM forward: uploading → uploaded → transcribing → completed.
      const row = recRepo.rows.get(recordingId);
      if (!row) throw new Error('precondition: recording row missing');
      row.status = 'completed';
      row.transcribedAt = new Date();

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingId}/play`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.recordingId).toBe(recordingId);
      expect(body.url).toBe('https://signed/get');
      expect(typeof body.expiresAt).toBe('string');
      expect(body.contentType).toBe('audio/webm');
      await app.close();
    });

    it('returns 404 when the recording is not yet completed', async () => {
      const { app } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm' },
      });
      const { recordingId } = init.json();
      // status is still 'uploading' — playback is not allowed.
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingId}/play`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 for unknown recording id', async () => {
      const { app } = await buildTestApp();
      const { accessToken } = await signupAndAuth(app);
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${randomUUID()}/play`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 403 when consent is missing for a meeting-bound recording', async () => {
      const authRepo = new InMemoryAuthRepository();
      const recRepo = new InMemoryRecordingsRepository();
      const storage = new FakeStorageProvider();
      const enqueuer = new InMemoryTranscribeEnqueuer();
      const refreshStore = new InMemoryRefreshTokenStore();
      const meetingId = randomUUID();
      const app = await buildServer({
        env: TEST_ENV,
        authRepository: authRepo,
        recordingsRepository: recRepo,
        storageProvider: storage,
        transcribeEnqueuer: enqueuer,
        refreshStore,
        consentChecker: async () => 'missing',
      });
      const signup = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: signupBody,
      });
      const { accessToken } = signup.json();
      const init = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/initiate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { contentType: 'audio/webm', meetingId },
      });
      const { recordingId } = init.json();
      const row = recRepo.rows.get(recordingId);
      if (!row) throw new Error('precondition: recording row missing');
      row.status = 'completed';
      row.transcribedAt = new Date();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingId}/play`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });
});

// Quiet unused-import warning for signAccessToken (kept for future
// integration tests that bypass /signup).
void signAccessToken;
