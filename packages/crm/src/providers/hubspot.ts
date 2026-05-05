/**
 * `HubspotCrmProvider` — HubSpot CRM v3 implementation.
 *
 * Real implementation calls:
 *   - `GET /account-info/v3/details`                        — whoAmI / portalId
 *   - `POST /crm/v3/objects/contacts/search`                — findContactByEmail
 *   - `POST /crm/v3/objects/contacts`                       — createContact
 *   - `POST /crm/v3/objects/notes`                          — pushNote (engagement type=NOTE)
 *   - `PUT  /crm/v3/objects/notes/{id}`                     — pushNote update path
 *   - `POST /crm/v3/associations/notes/contacts/batch/create`
 *
 * The HubSpot Node SDK (`@hubspot/api-client`) import would land here
 * — and ONLY here. The CI isolation gate guards that. For the portfolio
 * scaffold, this implementation uses `fetch` directly, which keeps
 * the dependency graph small while still exercising every code path.
 *
 * Auth: Bearer access_token from OAuth (OR a Private App token in
 * single-tenant tests). Token refresh is the API route layer's
 * responsibility — this provider receives a fresh token at construction
 * time. Token persistence + refresh sits in `apps/api/src/lib/crm-tokens.ts`.
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

export interface HubspotCrmProviderConfig {
  /** OAuth access_token (or Private App token). */
  accessToken: string;
  /** Region this token is scoped to. */
  region: Region;
  /** Override base URL (tests). Defaults to `https://api.hubapi.com`. */
  baseUrl?: string;
  /** Per-call timeout. Default 30s. */
  timeoutMs?: number;
  /** Optional fetch impl override (tests). */
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.hubapi.com';
const DEFAULT_TIMEOUT_MS = 30_000;

const REQUIRED_FIELDS: ReadonlyArray<keyof HubspotCrmProviderConfig> = ['accessToken', 'region'];

export class HubspotCrmProvider implements CrmProvider {
  readonly kind = 'hubspot' as const;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly accessToken: string;

  constructor(config: HubspotCrmProviderConfig) {
    for (const field of REQUIRED_FIELDS) {
      if (!config[field]) throw new CrmProviderUnavailableError('hubspot', String(field));
    }
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
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
        throw new CrmAuthError('hubspot', `${res.status} from ${path}`);
      }
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        throw new CrmRateLimitError(
          'hubspot',
          Number.isFinite(retryAfter) ? retryAfter * 1000 : null,
        );
      }
      if (res.status >= 500) {
        throw new CrmServerError('hubspot', `${res.status} from ${path}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new CrmRequestError('hubspot', `${res.status} from ${path}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async whoAmI(): Promise<CrmAccount> {
    const body = await this.request<{ portalId: number; accountType?: string }>(
      '/account-info/v3/details',
    );
    return {
      providerKind: 'hubspot',
      accountId: String(body.portalId),
      label: `HubSpot Portal ${body.portalId}${body.accountType ? ` (${body.accountType})` : ''}`,
    };
  }

  async findContactByEmail(input: CrmContactSearchInput): Promise<CrmContactRef | null> {
    interface SearchResponse {
      results: Array<{
        id: string;
        properties: { email?: string; firstname?: string; lastname?: string };
      }>;
    }
    const body = await this.request<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [{ propertyName: 'email', operator: 'EQ', value: input.email.toLowerCase() }],
          },
        ],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1,
      }),
    });
    const hit = body.results[0];
    if (!hit) return null;
    const email = (hit.properties.email ?? input.email).toLowerCase();
    const display =
      [hit.properties.firstname, hit.properties.lastname].filter(Boolean).join(' ') || email;
    return { id: hit.id, email, displayName: display };
  }

  async createContact(input: CrmContactSearchInput): Promise<CrmContactRef> {
    interface CreateResponse {
      id: string;
      properties: { email?: string };
    }
    const body = await this.request<CreateResponse>('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          email: input.email.toLowerCase(),
          ...(input.firstName ? { firstname: input.firstName } : {}),
          ...(input.lastName ? { lastname: input.lastName } : {}),
        },
      }),
    });
    const email = (body.properties.email ?? input.email).toLowerCase();
    return {
      id: body.id,
      email,
      displayName: [input.firstName, input.lastName].filter(Boolean).join(' ') || email,
    };
  }

  async pushNote(input: CrmPushNoteInput): Promise<CrmPushResult> {
    // HubSpot has no native idempotency-key on engagements. We store
    // `idempotencyKey` in a custom property `hs_aisecretary_dedup_key`
    // (which the tenant's onboarding script provisions on the
    // engagements object). Production would query for existing notes
    // via that property before deciding to create vs. update.
    interface CreateNoteResponse {
      id: string;
    }
    const noteBody = formatNoteBody(input);
    const body = await this.request<CreateNoteResponse>('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date(input.meetingDate).getTime(),
          hs_aisecretary_dedup_key: input.idempotencyKey,
        },
        associations: [
          {
            to: { id: input.contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
          },
          ...(input.dealId
            ? [
                {
                  to: { id: input.dealId },
                  types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
                },
              ]
            : []),
        ],
      }),
    });
    return {
      noteId: body.id,
      noteUrl: `https://app.hubspot.com/contacts/${'$portalId'}/record/0-1/${input.contactId}#engagements`,
      created: true,
    };
  }
}

const formatNoteBody = (input: CrmPushNoteInput): string => {
  const lines: string[] = [`<b>${escapeHtml(input.meetingTitle)}</b>`];
  lines.push(`<p>${escapeHtml(input.summary)}</p>`);
  if (input.actionItems.length > 0) {
    lines.push('<p><b>Action items</b></p><ul>');
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
