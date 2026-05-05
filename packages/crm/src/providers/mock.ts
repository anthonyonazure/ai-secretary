/**
 * `MockCrmProvider` — deterministic in-memory CRM provider for tests
 * + dev. Mirrors the shape of `MockLlmProvider` /
 * `MockTranscriptionProvider`.
 *
 * Tests can:
 *   - inject seeded contacts via `seedContact()`
 *   - assert what was pushed via `pushedNotes`
 *   - configure throw-on-call via `failNextCall = 'auth' | 'rateLimit'`
 */

import {
  CrmAuthError,
  CrmProviderUnavailableError,
  CrmRateLimitError,
  CrmRequestError,
} from '../errors.js';
import type {
  CrmAccount,
  CrmContactRef,
  CrmContactSearchInput,
  CrmProvider,
  CrmPushNoteInput,
  CrmPushResult,
} from '../types.js';

export interface MockCrmProviderOptions {
  /** Pre-seeded contacts by lowercase email. */
  contacts?: Record<string, CrmContactRef>;
  /** Override the account label returned by `whoAmI()`. */
  accountLabel?: string;
  /** Force the next call to throw a typed error. */
  failNextCall?: 'auth' | 'rateLimit' | 'unavailable' | 'request' | null;
  /** Force `whoAmI()` failure (used to simulate revoked-token state). */
  failWhoAmI?: boolean;
}

export class MockCrmProvider implements CrmProvider {
  readonly kind = 'mock' as const;
  public readonly contacts: Map<string, CrmContactRef> = new Map();
  public readonly pushedNotes: Array<{ input: CrmPushNoteInput; result: CrmPushResult }> = [];
  public failNextCall: MockCrmProviderOptions['failNextCall'] = null;
  public failWhoAmI = false;
  private accountLabel: string;
  private idCounter = 0;

  constructor(options: MockCrmProviderOptions = {}) {
    this.accountLabel = options.accountLabel ?? 'Mock CRM Account';
    if (options.contacts) {
      for (const [email, ref] of Object.entries(options.contacts)) {
        this.contacts.set(email.toLowerCase(), ref);
      }
    }
    if (options.failNextCall !== undefined) this.failNextCall = options.failNextCall;
    if (options.failWhoAmI !== undefined) this.failWhoAmI = options.failWhoAmI;
  }

  /** Test helper — seed a contact post-construction. */
  seedContact(ref: CrmContactRef): void {
    this.contacts.set(ref.email.toLowerCase(), ref);
  }

  private maybeThrow(): void {
    const next = this.failNextCall;
    if (!next) return;
    this.failNextCall = null;
    switch (next) {
      case 'auth':
        throw new CrmAuthError('mock', 'simulated auth failure');
      case 'rateLimit':
        throw new CrmRateLimitError('mock', 1000);
      case 'unavailable':
        throw new CrmProviderUnavailableError('mock', 'simulated missing field');
      case 'request':
        throw new CrmRequestError('mock', 'simulated bad request');
    }
  }

  async whoAmI(): Promise<CrmAccount> {
    if (this.failWhoAmI) throw new CrmAuthError('mock', 'simulated revoked token');
    this.maybeThrow();
    return {
      providerKind: 'mock',
      accountId: 'mock-account-001',
      label: this.accountLabel,
    };
  }

  async findContactByEmail(input: CrmContactSearchInput): Promise<CrmContactRef | null> {
    this.maybeThrow();
    return this.contacts.get(input.email.toLowerCase()) ?? null;
  }

  async createContact(input: CrmContactSearchInput): Promise<CrmContactRef> {
    this.maybeThrow();
    this.idCounter += 1;
    const id = `mock-contact-${this.idCounter}`;
    const ref: CrmContactRef = {
      id,
      email: input.email.toLowerCase(),
      displayName:
        [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email.toLowerCase(),
    };
    this.contacts.set(ref.email, ref);
    return ref;
  }

  async pushNote(input: CrmPushNoteInput): Promise<CrmPushResult> {
    this.maybeThrow();
    // Idempotency — re-pushing with the same key updates the existing note.
    const existing = this.pushedNotes.find((n) => n.input.idempotencyKey === input.idempotencyKey);
    if (existing) {
      existing.input = input;
      const result: CrmPushResult = { ...existing.result, created: false };
      existing.result = result;
      return result;
    }
    this.idCounter += 1;
    const noteId = `mock-note-${this.idCounter}`;
    const result: CrmPushResult = {
      noteId,
      noteUrl: `https://mock-crm.invalid/notes/${noteId}`,
      created: true,
    };
    this.pushedNotes.push({ input, result });
    return result;
  }
}
