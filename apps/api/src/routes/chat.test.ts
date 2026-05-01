import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import type { CitationRef } from '@aisecretary/shared';
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
import type { ChatRetriever, ChatStreamer } from './chat.js';
import { InMemorySearchRepository } from './search-repository.js';

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

const adminSignup = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const buildApp = async (
  overrides: {
    retriever?: ChatRetriever;
    streamer?: ChatStreamer;
  } = {},
) => {
  const authRepo = new InMemoryAuthRepository();
  const searchRepo = new InMemorySearchRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    searchRepository: searchRepo,
    refreshStore,
    consentChecker: async () => 'ok',
    ...(overrides.retriever ? { chatRetriever: overrides.retriever } : {}),
    ...(overrides.streamer ? { chatStreamer: overrides.streamer } : {}),
  });
  return { app, searchRepo };
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: adminSignup,
  });
  const body = res.json();
  return { accessToken: body.accessToken as string, tenantId: body.user.tenantId as string };
};

const parseSseEvents = (body: string): Array<{ event: string; data: unknown }> => {
  const events: Array<{ event: string; data: unknown }> = [];
  for (const block of body.split('\n\n').filter(Boolean)) {
    const lines = block.split('\n');
    let event = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice('event: '.length);
      if (line.startsWith('data: ')) data = line.slice('data: '.length);
    }
    if (event && data) events.push({ event, data: JSON.parse(data) });
  }
  return events;
};

describe('POST /api/v1/chat', () => {
  it('streams retrieval + delta + done events on a confident answer', async () => {
    const citation: CitationRef = {
      meetingId: randomUUID(),
      turnId: 'turn-1',
      spanStartMs: 0,
      spanEndMs: 1000,
      speaker: 'Anthony',
    };
    const retriever: ChatRetriever = async () => ({
      citations: [citation],
      context: 'Anthony said pricing should be tiered for enterprise customers.',
      retrievalConfidence: 0.9,
    });
    const streamer: ChatStreamer = async function* () {
      yield 'Anthony ';
      yield 'said ';
      yield 'pricing ';
      yield 'should be ';
      yield 'tiered ';
      yield 'for enterprise.';
    };
    const { app } = await buildApp({ retriever, streamer });
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { query: 'What did Anthony say about pricing?', messages: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = parseSseEvents(res.body);
    const kinds = events.map((e) => e.event);
    expect(kinds[0]).toBe('retrieval');
    expect(kinds[kinds.length - 1]).toBe('done');
    const retrievalEvent = events[0]?.data as { citations: CitationRef[] };
    expect(retrievalEvent.citations).toHaveLength(1);
    const doneEvent = events[events.length - 1]?.data as {
      emptyState: string;
      faithfulness: number | null;
    };
    expect(['confident', 'low-confidence']).toContain(doneEvent.emptyState);
    expect(doneEvent.faithfulness).toBeGreaterThan(0);
    await app.close();
  });

  it('emits off-topic when retriever returns no citations and zero confidence', async () => {
    const retriever: ChatRetriever = async () => ({
      citations: [],
      context: '',
      retrievalConfidence: 0,
    });
    const streamer: ChatStreamer = async function* () {
      yield 'should not be called';
    };
    const { app } = await buildApp({ retriever, streamer });
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { query: 'Tell me about quantum cooking', messages: [] },
    });
    expect(res.statusCode).toBe(200);
    const events = parseSseEvents(res.body);
    const done = events.find((e) => e.event === 'done')?.data as {
      emptyState: string;
    };
    expect(done.emptyState).toBe('off-topic');
    await app.close();
  });

  it('emits no-answer when streamer yields zero tokens', async () => {
    const retriever: ChatRetriever = async () => ({
      citations: [
        {
          meetingId: randomUUID(),
          turnId: 't1',
          spanStartMs: 0,
          spanEndMs: 1000,
        },
      ],
      context: 'context',
      retrievalConfidence: 0.5,
    });
    const streamer: ChatStreamer = async function* () {};
    const { app } = await buildApp({ retriever, streamer });
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { query: 'q', messages: [] },
    });
    const events = parseSseEvents(res.body);
    const done = events.find((e) => e.event === 'done')?.data as {
      emptyState: string;
      faithfulness: number | null;
    };
    expect(done.emptyState).toBe('no-answer');
    expect(done.faithfulness).toBeNull();
    await app.close();
  });

  it('returns 422 on empty query', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { query: '', messages: [] },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: { query: 'q', messages: [] },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
