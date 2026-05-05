/**
 * Per-tenant CRM provider selection.
 *
 * Unlike the LLM gateway (where compliance routing decides the
 * provider), the CRM provider is determined by which integration the
 * tenant connected. So `selectCrmProviderKind` simply maps the
 * `tenant_integrations.provider_kind` column to the
 * `CrmProviderKind` enum, with a `'mock'` override for dev/test.
 */

import type { CrmProviderKind } from './types.js';

export type CrmRuntimeMode = 'production' | 'dev' | 'test';

export interface CrmSelectorInput {
  /** The provider_kind on the connected `tenant_integrations` row. */
  providerKind: CrmProviderKind;
  mode: CrmRuntimeMode;
  /** Test seam: force the mock provider regardless of mode. */
  forceMock?: boolean;
}

export const selectCrmProviderKind = (input: CrmSelectorInput): CrmProviderKind => {
  if (input.forceMock) return 'mock';
  if (input.mode === 'test') return 'mock';
  return input.providerKind;
};
