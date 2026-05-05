/**
 * `CrmGateway` — top-level entry the API + workers call.
 *
 * Responsibilities:
 *   1. Resolve provider kind via `selectCrmProviderKind`.
 *   2. Construct provider via `createCrmProvider`.
 *   3. Wrap calls with timeout + retry (`CrmRateLimitError` /
 *      `CrmServerError` retry; `CrmAuthError` does not).
 *   4. Audit each push attempt + outcome via the injected logger.
 *
 * The gateway is stateless — each call constructs a fresh provider.
 * Token refresh + persistence is the API/worker's responsibility (the
 * gateway sees only the current access_token via the config bundle).
 */

import {
  CrmAuthError,
  CrmError,
  CrmProviderUnavailableError,
  CrmRateLimitError,
} from './errors.js';
import { type CrmProviderFactoryInput, createCrmProvider } from './factory.js';
import { type CrmRuntimeMode, type CrmSelectorInput, selectCrmProviderKind } from './selector.js';
import type {
  CrmAccount,
  CrmAuditAction,
  CrmContactRef,
  CrmContactSearchInput,
  CrmProviderKind,
  CrmPushNoteInput,
  CrmPushResult,
} from './types.js';

export interface CrmAuditLogInput {
  action: CrmAuditAction;
  tenantId: string;
  actorUserId: string | null;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface CrmAuditLogger {
  log(input: CrmAuditLogInput): Promise<void>;
}

export interface CrmGatewayDeps {
  mode: CrmRuntimeMode;
  auditLogger: CrmAuditLogger;
  /** Per-call max retry attempts on retryable errors. Default 2. */
  maxRetries?: number;
  /** Sleep impl. Default `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

export interface CrmPushArgs {
  tenantId: string;
  actorUserId: string | null;
  selector: CrmSelectorInput;
  factory: Omit<CrmProviderFactoryInput, 'kind'>;
  contactSearch: CrmContactSearchInput;
  /**
   * When true and the contact does not exist, the gateway calls
   * `createContact()` and then `pushNote()`. When false, the push
   * fails with a typed error.
   */
  createIfMissing: boolean;
  noteInput: Omit<CrmPushNoteInput, 'contactId'>;
}

const DEFAULT_RETRIES = 2;
const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class CrmGateway {
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: CrmGatewayDeps) {
    this.maxRetries = deps.maxRetries ?? DEFAULT_RETRIES;
    this.sleep = deps.sleep ?? realSleep;
  }

  /** Shallow account-level health check. Used by the connect flow. */
  async whoAmI(args: {
    tenantId: string;
    actorUserId: string | null;
    selector: CrmSelectorInput;
    factory: Omit<CrmProviderFactoryInput, 'kind'>;
  }): Promise<CrmAccount> {
    const kind = selectCrmProviderKind(args.selector);
    const provider = createCrmProvider({ kind, ...args.factory });
    return await this.withRetry(() => provider.whoAmI(), kind);
  }

  /**
   * Push a meeting note. Resolves the contact (find or create) and
   * pushes the note via the selected provider.
   */
  async pushNote(args: CrmPushArgs): Promise<{ contact: CrmContactRef; result: CrmPushResult }> {
    const kind = selectCrmProviderKind(args.selector);
    const provider = createCrmProvider({ kind, ...args.factory });

    let contact: CrmContactRef | null;
    try {
      contact = await this.withRetry(() => provider.findContactByEmail(args.contactSearch), kind);
    } catch (err) {
      await this.logFailure(args.tenantId, args.actorUserId, args.selector.providerKind, err);
      throw err;
    }

    if (!contact) {
      if (!args.createIfMissing) {
        const err = new CrmError(
          `Contact ${args.contactSearch.email} not found in CRM and createIfMissing=false.`,
          kind,
          false,
        );
        await this.logFailure(args.tenantId, args.actorUserId, args.selector.providerKind, err);
        throw err;
      }
      try {
        contact = await this.withRetry(() => provider.createContact(args.contactSearch), kind);
      } catch (err) {
        await this.logFailure(args.tenantId, args.actorUserId, args.selector.providerKind, err);
        throw err;
      }
      await this.deps.auditLogger.log({
        action: 'crm.contact-created',
        tenantId: args.tenantId,
        actorUserId: args.actorUserId,
        resourceId: contact.id,
        metadata: { providerKind: kind, email: contact.email },
      });
    }

    let result: CrmPushResult;
    try {
      result = await this.withRetry(
        () => provider.pushNote({ ...args.noteInput, contactId: (contact as CrmContactRef).id }),
        kind,
      );
    } catch (err) {
      await this.logFailure(args.tenantId, args.actorUserId, args.selector.providerKind, err);
      throw err;
    }

    await this.deps.auditLogger.log({
      action: 'crm.note-pushed',
      tenantId: args.tenantId,
      actorUserId: args.actorUserId,
      resourceId: result.noteId,
      metadata: {
        providerKind: kind,
        contactId: contact.id,
        ...(args.noteInput.dealId ? { dealId: args.noteInput.dealId } : {}),
        idempotencyKey: args.noteInput.idempotencyKey,
        created: result.created,
      },
    });
    return { contact, result };
  }

  private async withRetry<T>(fn: () => Promise<T>, kind: CrmProviderKind): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= this.maxRetries) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const isRetryable = err instanceof CrmError && err.retryable;
        if (!isRetryable || attempt === this.maxRetries) break;
        const wait =
          err instanceof CrmRateLimitError && err.retryAfterMs
            ? err.retryAfterMs
            : 250 * 2 ** attempt;
        await this.sleep(wait);
        attempt += 1;
      }
    }
    void kind;
    throw lastErr;
  }

  private async logFailure(
    tenantId: string,
    actorUserId: string | null,
    providerKind: CrmProviderKind,
    err: unknown,
  ): Promise<void> {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';
    await this.deps.auditLogger.log({
      action: 'crm.push-failed',
      tenantId,
      actorUserId,
      resourceId: 'n/a',
      metadata: {
        providerKind,
        error: message.slice(0, 500),
        kind:
          err instanceof CrmAuthError
            ? 'auth'
            : err instanceof CrmRateLimitError
              ? 'rate-limit'
              : err instanceof CrmProviderUnavailableError
                ? 'unavailable'
                : 'other',
      },
    });
  }
}
