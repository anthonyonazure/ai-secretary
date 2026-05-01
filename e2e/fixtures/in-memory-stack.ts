import { randomUUID } from 'node:crypto';
import {
  type ActionItemListRow,
  InMemoryActionItemsRepository,
} from '@aisecretary/api/routes/action-items-repository';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
  MfaEnrollmentInput,
  UserMfaState,
} from '@aisecretary/api/routes/auth-repository';
import {
  InMemoryMeetingsRepository,
  type MeetingRecordingRow,
  type MeetingSummaryRow,
  type SpeakerTurnRow,
} from '@aisecretary/api/routes/meetings-repository';
import { buildServer } from '@aisecretary/api/server';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import type {
  MultipartCompleteResult,
  MultipartUploadInit,
  ObjectMetadata,
  PresignedPutOptions,
  PresignedUrl,
  StorageProvider,
} from '@aisecretary/storage';
import type { FastifyInstance } from 'fastify';

interface MfaInternals {
  mfaPending: boolean;
  mfaSecretEncrypted: string | null;
  recoveryCodeHashes: string[];
}

export class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, AuthUserRow>();
  public readonly tenants = new Map<string, AuthTenantRow>();
  public readonly mfa = new Map<string, MfaInternals>();

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    for (const u of this.users.values()) {
      if (u.email === email.toLowerCase()) return u;
    }
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
      mfaRequired: false,
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
    this.mfa.set(row.id, {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    });
    return row;
  }
  async touchLastLogin(): Promise<void> {}
  async findUserByIdForMfa(userId: string, tenantId: string): Promise<UserMfaState | null> {
    const user = this.users.get(userId);
    if (!user || user.tenantId !== tenantId) return null;
    const mfa = this.mfa.get(userId) ?? {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    };
    const tenant = this.tenants.get(tenantId);
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      region: tenant?.region ?? 'us',
      passwordHash: user.passwordHash,
      isMfaEnabled: user.isMfaEnabled,
      mfaPending: mfa.mfaPending,
      mfaSecretEncrypted: mfa.mfaSecretEncrypted,
      recoveryCodeHashes: mfa.recoveryCodeHashes,
    };
  }
  async setMfaEnrollment(
    userId: string,
    _tenantId: string,
    input: MfaEnrollmentInput,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = false;
    this.mfa.set(userId, {
      mfaPending: true,
      mfaSecretEncrypted: input.encryptedSecret,
      recoveryCodeHashes: [...input.recoveryCodeHashes],
    });
  }
  async confirmMfaEnrollment(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = true;
    const mfa = this.mfa.get(userId);
    if (mfa) mfa.mfaPending = false;
  }
  async disableMfa(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = false;
    this.mfa.set(userId, {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    });
  }
  async consumeRecoveryCode(userId: string, _tenantId: string, codeHash: string): Promise<boolean> {
    const mfa = this.mfa.get(userId);
    if (!mfa) return false;
    const idx = mfa.recoveryCodeHashes.indexOf(codeHash);
    if (idx === -1) return false;
    mfa.recoveryCodeHashes.splice(idx, 1);
    return true;
  }
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
  async completeMultipartUpload(_input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<MultipartCompleteResult> {
    return { etag: 'final-etag', location: 's3://bucket/key' };
  }
  async abortMultipartUpload(_input: { key: string; uploadId: string }): Promise<void> {}
  async presignGet(_key: string, _opts: { expiresInSeconds: number }): Promise<PresignedUrl> {
    return { url: 'https://signed/get?token=abc', expiresAt: new Date(Date.now() + 60_000) };
  }
  async headObject(key: string): Promise<ObjectMetadata> {
    return { key, contentType: 'audio/webm', contentLength: 0, etag: null, lastModified: null };
  }
  async delete(_key: string): Promise<void> {}
}

export interface SeedFixture {
  tenant: { id: string; name: string; slug: string; region: 'us' };
  admin: { id: string; email: string; password: string; name: string };
  meeting: { id: string; title: string; speakerTurns: SpeakerTurnRow[] };
  secondaryMeeting: { id: string; title: string };
  actionItems: Array<{ id: string; meetingId: string; text: string; status: string }>;
}

export interface StackHandle {
  app: FastifyInstance;
  apiUrl: string;
  authRepo: InMemoryAuthRepository;
  meetingsRepo: InMemoryMeetingsRepository;
  actionItemsRepo: InMemoryActionItemsRepository;
  seed: SeedFixture;
  close: () => Promise<void>;
}

const TEST_MFA_KEY = 'a'.repeat(64);

interface StartOptions {
  apiPort?: number;
}

export const startInMemoryStack = async (options: StartOptions = {}): Promise<StackHandle> => {
  const port = options.apiPort ?? 0;
  const authRepo = new InMemoryAuthRepository();
  const meetingsRepo = new InMemoryMeetingsRepository();
  const actionItemsRepo = new InMemoryActionItemsRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const storage = new FakeStorageProvider();

  const app = await buildServer({
    env: {
      NODE_ENV: 'test',
      PORT: port,
      HOST: '127.0.0.1',
      REGION: 'us',
      DATABASE_URL: 'postgres://localhost:5432/aisecretary_e2e',
      JWT_SECRET: 'e2e-jwt-secret-must-be-at-least-32-chars-long',
      JWT_MFA_CHALLENGE_SECRET: 'e2e-mfa-challenge-secret-32-chars-min-please',
      MFA_SECRET_ENCRYPTION_KEY: TEST_MFA_KEY,
      OAUTH_REDIRECT_BASE_URL: 'http://127.0.0.1:3001',
      LOG_LEVEL: 'error',
    },
    authRepository: authRepo,
    meetingsRepository: meetingsRepo,
    actionItemsRepository: actionItemsRepo,
    refreshStore,
    storageProvider: storage,
    consentChecker: async () => 'ok',
  });

  const address = await app.listen({ port, host: '127.0.0.1' });
  const apiUrl =
    typeof address === 'string' && address.startsWith('http') ? address : `http://${address}`;

  const seed = await seedFixture({ apiUrl, authRepo, meetingsRepo, actionItemsRepo });

  return {
    app,
    apiUrl,
    authRepo,
    meetingsRepo,
    actionItemsRepo,
    seed,
    close: async () => {
      await app.close();
    },
  };
};

interface SeedDeps {
  apiUrl: string;
  authRepo: InMemoryAuthRepository;
  meetingsRepo: InMemoryMeetingsRepository;
  actionItemsRepo: InMemoryActionItemsRepository;
}

const seedFixture = async (deps: SeedDeps): Promise<SeedFixture> => {
  const adminEmail = 'admin@acme.test';
  const adminPassword = 'super-strong-password-1!';

  const signupResponse = await fetch(`${deps.apiUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: 'Acme Inc',
      region: 'us',
      email: adminEmail,
      password: adminPassword,
      name: 'Admin User',
    }),
  });
  if (!signupResponse.ok) {
    const body = await signupResponse.text();
    throw new Error(`Seed signup failed (${signupResponse.status}): ${body}`);
  }
  const signupBody = (await signupResponse.json()) as { user: { id: string; tenantId: string } };
  const tenantId = signupBody.user.tenantId;
  const userId = signupBody.user.id;

  const tenantRow = deps.authRepo.tenants.get(tenantId);
  if (!tenantRow) throw new Error('Seed: tenant row not found post-signup');

  const meetingA = {
    id: randomUUID(),
    title: 'Q3 Planning Sync',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  };
  const meetingB = {
    id: randomUUID(),
    title: 'Customer Discovery — Acme Co',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
  };

  const summaries: MeetingSummaryRow[] = [
    {
      id: meetingA.id,
      title: meetingA.title,
      source: 'web_recording',
      status: 'analyzed',
      durationSeconds: 1800,
      startedAt: meetingA.createdAt,
      endedAt: new Date(meetingA.createdAt.getTime() + 1800_000),
      createdAt: meetingA.createdAt,
    },
    {
      id: meetingB.id,
      title: meetingB.title,
      source: 'mobile_recording',
      status: 'analyzed',
      durationSeconds: 2400,
      startedAt: meetingB.createdAt,
      endedAt: new Date(meetingB.createdAt.getTime() + 2400_000),
      createdAt: meetingB.createdAt,
    },
  ];
  deps.meetingsRepo.setMeetings(tenantId, summaries);

  const turns: SpeakerTurnRow[] = [
    {
      turnId: 'turn-a-1',
      speaker: 'Alice',
      spanStartMs: 0,
      spanEndMs: 6_000,
      text: 'Welcome to the Q3 planning sync. Let us start with priorities.',
      confidence: 0.97,
      sequence: 1,
    },
    {
      turnId: 'turn-a-2',
      speaker: 'Bob',
      spanStartMs: 6_000,
      spanEndMs: 14_000,
      text: 'I will own the migration runbook by next Tuesday.',
      confidence: 0.95,
      sequence: 2,
    },
  ];
  deps.meetingsRepo.setSpeakerTurns(tenantId, meetingA.id, turns);

  const recording: MeetingRecordingRow = {
    id: randomUUID(),
    storageKey: `tenants/${tenantId}/recordings/${meetingA.id}.bin`,
    contentType: 'audio/webm',
  };
  deps.meetingsRepo.setRecordings(tenantId, meetingA.id, [recording]);

  const now = new Date();
  const itemA: ActionItemListRow = {
    id: randomUUID(),
    meetingId: meetingA.id,
    meetingTitle: meetingA.title,
    meetingRecordedAt: meetingA.createdAt,
    text: 'Bob: write Q3 migration runbook',
    ownerName: 'Bob',
    ownerUserId: null,
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending',
    confidence: 0.88,
    citations: [],
    createdAt: now,
    updatedAt: now,
  };
  const itemB: ActionItemListRow = {
    id: randomUUID(),
    meetingId: meetingB.id,
    meetingTitle: meetingB.title,
    meetingRecordedAt: meetingB.createdAt,
    text: 'Send recap email to Acme stakeholders',
    ownerName: 'Admin User',
    ownerUserId: userId,
    dueDate: null,
    status: 'pending',
    confidence: 0.81,
    citations: [],
    createdAt: now,
    updatedAt: now,
  };
  deps.actionItemsRepo.insert(tenantId, itemA);
  deps.actionItemsRepo.insert(tenantId, itemB);

  return {
    tenant: { id: tenantId, name: tenantRow.name, slug: tenantRow.slug, region: 'us' },
    admin: { id: userId, email: adminEmail, password: adminPassword, name: 'Admin User' },
    meeting: { id: meetingA.id, title: meetingA.title, speakerTurns: turns },
    secondaryMeeting: { id: meetingB.id, title: meetingB.title },
    actionItems: [
      { id: itemA.id, meetingId: meetingA.id, text: itemA.text, status: 'pending' },
      { id: itemB.id, meetingId: meetingB.id, text: itemB.text, status: 'pending' },
    ],
  };
};
