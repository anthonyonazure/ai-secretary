/**
 * Factory: pick the concrete `CrmProvider` for the kind the selector
 * returned. Mirrors `packages/llm-gateway/src/factory.ts`.
 *
 * Each kind throws `CrmProviderUnavailableError` from its constructor
 * when required config is missing. The gateway treats that as a
 * non-retryable error and surfaces it to the caller.
 */

import { HubspotCrmProvider, type HubspotCrmProviderConfig } from './providers/hubspot.js';
import { MockCrmProvider, type MockCrmProviderOptions } from './providers/mock.js';
import { PipedriveCrmProvider, type PipedriveCrmProviderConfig } from './providers/pipedrive.js';
import { SalesforceCrmProvider, type SalesforceCrmProviderConfig } from './providers/salesforce.js';
import type { CrmProvider, CrmProviderKind } from './types.js';

export interface CrmProviderFactoryInput {
  kind: CrmProviderKind;
  hubspot?: HubspotCrmProviderConfig;
  salesforce?: SalesforceCrmProviderConfig;
  pipedrive?: PipedriveCrmProviderConfig;
  mock?: MockCrmProvider | MockCrmProviderOptions;
}

export const createCrmProvider = (input: CrmProviderFactoryInput): CrmProvider => {
  switch (input.kind) {
    case 'mock': {
      const m = input.mock;
      if (!m) return new MockCrmProvider();
      if (m instanceof MockCrmProvider) return m;
      return new MockCrmProvider(m);
    }
    case 'hubspot':
      if (!input.hubspot)
        throw new Error('createCrmProvider: kind=hubspot requires hubspot config');
      return new HubspotCrmProvider(input.hubspot);
    case 'salesforce':
      if (!input.salesforce)
        throw new Error('createCrmProvider: kind=salesforce requires salesforce config');
      return new SalesforceCrmProvider(input.salesforce);
    case 'pipedrive':
      if (!input.pipedrive)
        throw new Error('createCrmProvider: kind=pipedrive requires pipedrive config');
      return new PipedriveCrmProvider(input.pipedrive);
  }
};
