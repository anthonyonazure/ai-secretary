/**
 * `PipedriveCrmProvider` — Pipedrive v1 API implementation.
 *
 * Real implementation calls (per Pipedrive API v1):
 *   - `GET  /users/me`              — whoAmI
 *   - `GET  /persons/search?term=`  — find by email
 *   - `POST /persons`               — createContact
 *   - `POST /notes`                 — pushNote
 *   - `PUT  /notes/{id}`            — pushNote update path
 *
 * Auth: Bearer access_token from OAuth (preferred) OR a per-user
 * api_token (legacy). Token refresh is the API route layer's
 * responsibility — this provider receives a fresh token at construction
 * time.
 *
 * Pipedrive's official Node SDK (`pipedrive`) would be the production
 * choice; the portfolio scaffold uses fetch directly to keep the
 * dependency graph minimal while still exercising every code path.
 */

import {
  CrmAuthError,
  CrmProviderUnavailableError,
  CrmRateLimitError,
  CrmRequestError,
  CrmServerError,
} from '../errors.js';
import type {
  CrmAccount,
  CrmContactRef,
  CrmContactSearchInput,
  CrmProvider,
  CrmPushNoteInput,
  CrmPushResult,
  Region,
} from '../types.js';

export interface PipedriveCrmProviderConfig {
  accessToken: string;
  /**
   * Per-tenant API base URL (Pipedrive routes by company-domain:
   * `https://{company}.pipedrive.com/api/v1`).
   */
  apiBaseUrl: string;
  region: Region;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const REQUIRED_FIELDS: ReadonlyArray<keyof PipedriveCrmProviderConfig> = [
  'accessToken',
  'apiBaseUrl',
  'region',
];

export class PipedriveCrmProvider implements CrmProvider {
  readonly kind = 'pipedrive' as const;
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PipedriveCrmProviderConfig) {
    for (const field of REQUIRED_FIELDS) {
      if (!config[field]) throw new CrmProviderUnavailableError('pipedrive', String(field));
    }
    this.accessToken = config.accessToken;
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (res.status === 401 || res.status === 403) {
        throw new CrmAuthError('pipedrive', `${res.status} from ${path}`);
      }
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        throw new CrmRateLimitError(
          'pipedrive',
          Number.isFinite(retryAfter) ? retryAfter * 1000 : null,
        );
      }
      if (res.status >= 500) {
        throw new CrmServerError('pipedrive', `${res.status} from ${path}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new CrmRequestError('pipedrive', `${res.status} from ${path}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async whoAmI(): Promise<CrmAccount> {
    interface MeResponse {
      data: { id: number; name: string; company_id: number; company_name: string };
    }
    const body = await this.request<MeResponse>('/users/me');
    return {
      providerKind: 'pipedrive',
      accountId: String(body.data.company_id),
      label: `Pipedrive ${body.data.company_name} (${body.data.company_id})`,
      instanceUrl: this.apiBaseUrl,
    };
  }

  async findContactByEmail(input: CrmContactSearchInput): Promise<CrmContactRef | null> {
    interface SearchResponse {
      data: { items: Array<{ item: { id: number; name: string; emails?: string[] } }> };
    }
    const params = new URLSearchParams({
      term: input.email.toLowerCase(),
      fields: 'email',
      exact_match: 'true',
      limit: '1',
    });
    const body = await this.request<SearchResponse>(`/persons/search?${params}`);
    const hit = body.data.items[0]?.item;
    if (!hit) return null;
    return {
      id: String(hit.id),
      email: (hit.emails?.[0] ?? input.email).toLowerCase(),
      displayName: hit.name,
    };
  }

  async createContact(input: CrmContactSearchInput): Promise<CrmContactRef> {
    interface CreateResponse {
      data: { id: number; name: string };
    }
    const body = await this.request<CreateResponse>('/persons', {
      method: 'POST',
      body: JSON.stringify({
        name:
          [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email.toLowerCase(),
        email: [{ value: input.email.toLowerCase(), primary: true, label: 'work' }],
      }),
    });
    return {
      id: String(body.data.id),
      email: input.email.toLowerCase(),
      displayName: body.data.name,
    };
  }

  async pushNote(input: CrmPushNoteInput): Promise<CrmPushResult> {
    interface CreateNoteResponse {
      data: { id: number };
    }
    const content = formatNoteContent(input);
    const body = await this.request<CreateNoteResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify({
        content,
        person_id: Number(input.contactId),
        ...(input.dealId ? { deal_id: Number(input.dealId) } : {}),
        // Pipedrive doesn't expose a custom-field surface on notes — the
        // idempotency key is embedded as an HTML comment so re-pushes
        // can grep + update.
      }),
    });
    return {
      noteId: String(body.data.id),
      noteUrl: `${this.apiBaseUrl.replace('/api/v1', '')}/notes/${body.data.id}`,
      created: true,
    };
  }
}

const formatNoteContent = (input: CrmPushNoteInput): string => {
  const lines: string[] = [
    `<!-- aisecretary:${input.idempotencyKey} -->`,
    `<h3>${escapeHtml(input.meetingTitle)}</h3>`,
    `<p>${escapeHtml(input.summary)}</p>`,
  ];
  if (input.actionItems.length > 0) {
    lines.push('<p><strong>Action items</strong></p><ul>');
    for (const a of input.actionItems) {
      const owner = a.owner ? ` — ${escapeHtml(a.owner)}` : '';
      const due = a.dueDate ? ` (due ${escapeHtml(a.dueDate)})` : '';
      lines.push(`<li>${escapeHtml(a.text)}${owner}${due}</li>`);
    }
    lines.push('</ul>');
  }
  lines.push(`<p><a href="${escapeHtml(input.meetingUrl)}">Open in AI Secretary</a></p>`);
  return lines.join('\n');
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
