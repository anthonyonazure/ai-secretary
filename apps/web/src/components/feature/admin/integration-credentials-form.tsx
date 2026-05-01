/**
 * `IntegrationCredentialsForm` — Stories 9.1 + 9.2 admin UI.
 *
 * Compact form an org admin uses to wire up bot credentials per region:
 *   - Zoom Server-to-Server OAuth (Account ID + Client ID + Client Secret)
 *   - Microsoft Teams app-only Graph (Tenant ID + Client ID + Client Secret)
 *
 * The form NEVER displays the persisted secret value — once a secret is
 * stored server-side, the field renders with a masked placeholder
 * ("••••" + "Replace") and the admin must explicitly opt to overwrite.
 *
 * a11y:
 *   - Each `fieldset` carries a `<legend>` for assistive tech grouping.
 *   - Secret-input fields use `type="password"` so screen readers don't
 *     read the value out loud.
 *   - The "Replace" button uses `aria-pressed` so AT announces the
 *     toggle.
 */

import { Eye, EyeOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

export type IntegrationProvider = 'zoom' | 'teams';

export interface IntegrationCredentialsFormProps {
  provider: IntegrationProvider;
  /** True when a credential set is currently persisted server-side. */
  hasExistingCredentials: boolean;
  /** Disabled while the save mutation is inflight. */
  isPending?: boolean;
  /** Called with the form values on submit. The form does NOT clear
   *  the inputs — the host swaps to a fresh form on success. */
  onSave: (values: Record<string, string>) => void;
  /** Called when the admin opts to disconnect the integration. */
  onDisconnect?: () => void;
}

const FIELDS: Record<
  IntegrationProvider,
  Array<{ name: string; label: string; secret: boolean }>
> = {
  zoom: [
    { name: 'accountId', label: 'Account ID', secret: false },
    { name: 'clientId', label: 'Client ID', secret: false },
    { name: 'clientSecret', label: 'Client Secret', secret: true },
  ],
  teams: [
    { name: 'tenantId', label: 'Microsoft Tenant ID', secret: false },
    { name: 'clientId', label: 'Application (client) ID', secret: false },
    { name: 'clientSecret', label: 'Client Secret', secret: true },
  ],
};

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  zoom: 'Zoom (Server-to-Server OAuth)',
  teams: 'Microsoft Teams (app-only Graph)',
};

export function IntegrationCredentialsForm({
  provider,
  hasExistingCredentials,
  isPending = false,
  onSave,
  onDisconnect,
}: IntegrationCredentialsFormProps) {
  const fields = FIELDS[provider];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, ''])),
  );
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [overwrite, setOverwrite] = useState(!hasExistingCredentials);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
      onSubmit={handleSubmit}
      data-testid={`integration-credentials-form-${provider}`}
      aria-label={`${PROVIDER_LABELS[provider]} credentials`}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold">{PROVIDER_LABELS[provider]}</legend>

        {hasExistingCredentials && !overwrite ? (
          <div className="flex items-center justify-between rounded-md bg-accent-soft px-3 py-2 text-sm">
            <span className="text-fg-muted">Credentials configured.</span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={overwrite}
                onClick={() => setOverwrite(true)}
                className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-3 text-xs text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid={`integration-replace-${provider}`}
              >
                Replace
              </button>
              {onDisconnect ? (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="inline-flex h-8 items-center rounded-md border border-danger bg-bg px-3 text-xs text-danger hover:bg-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                  data-testid={`integration-disconnect-${provider}`}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {overwrite || !hasExistingCredentials ? (
          <>
            {fields.map((field) => (
              <label
                key={field.name}
                className="flex flex-col gap-1 text-sm font-medium text-fg-muted"
              >
                {field.label}
                <div className="relative">
                  <input
                    type={field.secret && !revealedSecrets[field.name] ? 'password' : 'text'}
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="h-9 w-full rounded-md border border-border bg-bg px-3 pr-10 font-mono text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid={`integration-${provider}-${field.name}`}
                  />
                  {field.secret ? (
                    <button
                      type="button"
                      aria-label={revealedSecrets[field.name] ? 'Hide secret' : 'Show secret'}
                      aria-pressed={revealedSecrets[field.name] ?? false}
                      onClick={() =>
                        setRevealedSecrets((prev) => ({
                          ...prev,
                          [field.name]: !(prev[field.name] ?? false),
                        }))
                      }
                      className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {revealedSecrets[field.name] ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </div>
              </label>
            ))}
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                data-testid={`integration-save-${provider}`}
              >
                {isPending
                  ? 'Saving…'
                  : hasExistingCredentials
                    ? 'Replace credentials'
                    : 'Save credentials'}
              </button>
              {hasExistingCredentials ? (
                <button
                  type="button"
                  onClick={() => setOverwrite(false)}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-sm text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </fieldset>
    </form>
  );
}
