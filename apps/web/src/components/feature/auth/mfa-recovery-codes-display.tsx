/**
 * Story 1.5c — recovery codes display.
 *
 * Shown ONCE after enrollment + after regenerate. Codes are not
 * fetchable later — only their hashes are stored. Provides Copy +
 * Print actions so the user has friction-free options to save them.
 */

import { useState } from 'react';

export interface MfaRecoveryCodesDisplayProps {
  recoveryCodes: string[];
  /** Optional confirmation callback once the user has saved them. */
  onAcknowledge?: () => void;
}

export function MfaRecoveryCodesDisplay({
  recoveryCodes,
  onAcknowledge,
}: MfaRecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can fail in non-secure contexts; fail silent.
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div
      data-testid="mfa-recovery-codes"
      className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <header className="flex flex-col gap-1">
        <h3 className="font-sans text-sm font-semibold">Save your recovery codes</h3>
        <p className="text-xs text-fg-muted">
          Store these somewhere safe. Each code works once if you lose access to your authenticator
          app. They will not be shown again.
        </p>
      </header>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 rounded-md bg-bg p-3 font-mono text-sm tracking-widest text-fg"
      >
        {recoveryCodes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          data-testid="mfa-recovery-copy"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          Print
        </button>
        {onAcknowledge ? (
          <button
            type="button"
            onClick={onAcknowledge}
            className="ml-auto inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            I have saved them
          </button>
        ) : null}
      </div>
    </div>
  );
}
