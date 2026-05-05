/**
 * Typed wrapper for the AI Secretary API endpoints the extension hits.
 *
 * The extension never holds CRM tokens — those live server-side per
 * ADR-0003. The extension authenticates to AI Secretary with a
 * dedicated long-lived access token persisted in `chrome.storage.local`
 * (one-time pairing flow: user clicks "Connect extension" in the web
 * app, app generates a token, user pastes it into the popup).
 */

import {
  type CrmIntegrationListResponse,
  type CrmPushResponse,
  crmIntegrationListResponseSchema,
  crmPushResponseSchema,
} from '@aisecretary/shared';

export interface ExtensionApiClientOptions {
  baseUrl: string;
  /** Bearer token; null when unpaired. */
  accessToken: string | null;
  /** Override the global fetch (tests). */
  fetchImpl?: typeof fetch;
}

export class ExtensionApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ExtensionApiError';
  }
}

const buildHeaders = (token: string | null): Record<string, string> => {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export const listIntegrations = async (
  opts: ExtensionApiClientOptions,
): Promise<CrmIntegrationListResponse> => {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${opts.baseUrl}/api/v1/crm/integrations`, {
    headers: buildHeaders(opts.accessToken),
  });
  if (!res.ok) {
    throw new ExtensionApiError(res.status, `Failed to list integrations (${res.status})`);
  }
  return crmIntegrationListResponseSchema.parse(await res.json());
};

export interface PushArgs {
  integrationId: string;
  meetingId: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  dealId?: string;
}

export const pushToCrm = async (
  opts: ExtensionApiClientOptions,
  args: PushArgs,
): Promise<CrmPushResponse> => {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${opts.baseUrl}/api/v1/crm/push`, {
    method: 'POST',
    headers: { ...buildHeaders(opts.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      integrationId: args.integrationId,
      meetingId: args.meetingId,
      contactEmail: args.contactEmail,
      ...(args.contactFirstName ? { contactFirstName: args.contactFirstName } : {}),
      ...(args.contactLastName ? { contactLastName: args.contactLastName } : {}),
      ...(args.dealId ? { dealId: args.dealId } : {}),
      createContactIfMissing: true,
    }),
  });
  if (!res.ok) {
    throw new ExtensionApiError(res.status, `Failed to push to CRM (${res.status})`);
  }
  return crmPushResponseSchema.parse(await res.json());
};
