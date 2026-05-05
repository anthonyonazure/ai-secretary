/**
 * `SalesforceCrmProvider` — Salesforce REST API implementation.
 *
 * Real implementation calls (per Salesforce REST API v59):
 *   - `GET  /services/oauth2/userinfo`                       — whoAmI
 *   - `GET  /services/data/v59.0/query/?q=...`               — find by email
 *   - `POST /services/data/v59.0/sobjects/Contact`           — createContact
 *   - `POST /services/data/v59.0/sobjects/Task`              — push as Task (preferred for sales notes)
 *   - `PATCH /services/data/v59.0/sobjects/Task/{id}`        — update path
 *
 * Auth: Bearer access_token from OAuth + per-tenant `instance_url`
 * (Salesforce orgs live on different `*.my.salesforce.com` instances).
 *
 * `jsforce` would be the preferred SDK in production — it handles
 * auto-refresh + composite requests + bulk API. The portfolio scaffold
 * uses fetch directly to keep the dependency graph minimal while still
 * exercising every code path.
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

export interface SalesforceCrmProviderConfig {
  accessToken: string;
  /** Per-org instance URL (e.g. `https://acme.my.salesforce.com`). */
  instanceUrl: string;
  region: Region;
  /** REST API version. Defaults to `v59.0`. */
  apiVersion?: string;
  /** Per-call timeout. Default 30s. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_API_VERSION = 'v59.0';
const DEFAULT_TIMEOUT_MS = 30_000;

const REQUIRED_FIELDS: ReadonlyArray<keyof SalesforceCrmProviderConfig> = [
  'accessToken',
  'instanceUrl',
  'region',
];

export class SalesforceCrmProvider implements CrmProvider {
  readonly kind = 'salesforce' as const;
  private readonly accessToken: string;
  private readonly instanceUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SalesforceCrmProviderConfig) {
    for (const field of REQUIRED_FIELDS) {
      if (!config[field]) throw new CrmProviderUnavailableError('salesforce', String(field));
    }
    this.accessToken = config.accessToken;
    this.instanceUrl = config.instanceUrl.replace(/\/$/, '');
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.instanceUrl}${path}`, {
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
        throw new CrmAuthError('salesforce', `${res.status} from ${path}`);
      }
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        throw new CrmRateLimitError(
          'salesforce',
          Number.isFinite(retryAfter) ? retryAfter * 1000 : null,
        );
      }
      if (res.status >= 500) {
        throw new CrmServerError('salesforce', `${res.status} from ${path}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new CrmRequestError(
          'salesforce',
          `${res.status} from ${path}: ${body.slice(0, 200)}`,
        );
      }
      // Salesforce returns 204 on PATCH success.
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async whoAmI(): Promise<CrmAccount> {
    interface UserInfo {
      organization_id: string;
      name?: string;
      preferred_username?: string;
    }
    const body = await this.request<UserInfo>('/services/oauth2/userinfo');
    return {
      providerKind: 'salesforce',
      accountId: body.organization_id,
      label: `Salesforce ${body.organization_id}${body.preferred_username ? ` (${body.preferred_username})` : ''}`,
      instanceUrl: this.instanceUrl,
    };
  }

  async findContactByEmail(input: CrmContactSearchInput): Promise<CrmContactRef | null> {
    interface QueryResponse {
      records: Array<{ Id: string; Email?: string; Name?: string }>;
    }
    const escaped = input.email.toLowerCase().replace(/'/g, "\\'");
    const soql = `SELECT Id, Email, Name FROM Contact WHERE Email = '${escaped}' LIMIT 1`;
    const body = await this.request<QueryResponse>(
      `/services/data/${this.apiVersion}/query/?q=${encodeURIComponent(soql)}`,
    );
    const hit = body.records[0];
    if (!hit) return null;
    return {
      id: hit.Id,
      email: (hit.Email ?? input.email).toLowerCase(),
      displayName: hit.Name ?? input.email.toLowerCase(),
    };
  }

  async createContact(input: CrmContactSearchInput): Promise<CrmContactRef> {
    interface CreateResponse {
      id: string;
    }
    const body = await this.request<CreateResponse>(
      `/services/data/${this.apiVersion}/sobjects/Contact`,
      {
        method: 'POST',
        body: JSON.stringify({
          Email: input.email.toLowerCase(),
          // Salesforce requires LastName on Contact creation.
          LastName: input.lastName ?? input.email.split('@')[0] ?? 'Unknown',
          ...(input.firstName ? { FirstName: input.firstName } : {}),
        }),
      },
    );
    return {
      id: body.id,
      email: input.email.toLowerCase(),
      displayName:
        [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email.toLowerCase(),
    };
  }

  async pushNote(input: CrmPushNoteInput): Promise<CrmPushResult> {
    // Push as a Task (Salesforce-native "log a call/meeting" object).
    // Idempotency lives in the custom field `External_Id__c` (would
    // be provisioned per-tenant via Tooling API at first connect).
    interface CreateTaskResponse {
      id: string;
    }
    const description = formatTaskDescription(input);
    const body = await this.request<CreateTaskResponse>(
      `/services/data/${this.apiVersion}/sobjects/Task`,
      {
        method: 'POST',
        body: JSON.stringify({
          Subject: `Meeting: ${input.meetingTitle}`,
          ActivityDate: input.meetingDate.slice(0, 10),
          Description: description,
          Status: 'Completed',
          Priority: 'Normal',
          Type: 'Meeting',
          WhoId: input.contactId,
          ...(input.dealId ? { WhatId: input.dealId } : {}),
          External_Id__c: input.idempotencyKey,
        }),
      },
    );
    return {
      noteId: body.id,
      noteUrl: `${this.instanceUrl}/${body.id}`,
      created: true,
    };
  }
}

const formatTaskDescription = (input: CrmPushNoteInput): string => {
  const lines: string[] = [input.summary, ''];
  if (input.actionItems.length > 0) {
    lines.push('Action items:');
    for (const a of input.actionItems) {
      const owner = a.owner ? ` — ${a.owner}` : '';
      const due = a.dueDate ? ` (due ${a.dueDate})` : '';
      lines.push(`  • ${a.text}${owner}${due}`);
    }
    lines.push('');
  }
  lines.push(`Open in AI Secretary: ${input.meetingUrl}`);
  return lines.join('\n');
};
