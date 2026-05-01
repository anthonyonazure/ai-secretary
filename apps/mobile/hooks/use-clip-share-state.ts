export type ClipShareScope = 'org-internal' | 'token-link' | 'cross-org';

export type ClipShareInput = {
  scope: ClipShareScope;
  expiresAt: string | null;
  recipientCount: number;
  blockedByPolicy: boolean;
  now?: number;
};

export type ClipShareLabel =
  | 'org-internal'
  | 'token-link-active'
  | 'token-link-expired'
  | 'cross-org-blocked'
  | 'cross-org-pending'
  | 'cross-org-accepted';

export type ClipShareState = {
  label: ClipShareLabel;
  copy: string;
  showRequestNewLink: boolean;
  showAdminBlockedHint: boolean;
};

export const deriveClipShareState = (input: ClipShareInput): ClipShareState => {
  const now = input.now ?? Date.now();
  if (input.scope === 'org-internal') {
    return {
      label: 'org-internal',
      copy: `Shared with ${input.recipientCount} teammate${input.recipientCount === 1 ? '' : 's'}.`,
      showRequestNewLink: false,
      showAdminBlockedHint: false,
    };
  }
  if (input.scope === 'cross-org') {
    if (input.blockedByPolicy) {
      return {
        label: 'cross-org-blocked',
        copy: 'Recipient’s organization has blocked external shares.',
        showRequestNewLink: false,
        showAdminBlockedHint: true,
      };
    }
    if (input.recipientCount === 0) {
      return {
        label: 'cross-org-pending',
        copy: 'Awaiting external recipient acceptance.',
        showRequestNewLink: false,
        showAdminBlockedHint: false,
      };
    }
    return {
      label: 'cross-org-accepted',
      copy: `Accepted by ${input.recipientCount} external recipient${input.recipientCount === 1 ? '' : 's'}.`,
      showRequestNewLink: false,
      showAdminBlockedHint: false,
    };
  }
  if (input.expiresAt === null) {
    return {
      label: 'token-link-active',
      copy: 'Token link with no expiration.',
      showRequestNewLink: false,
      showAdminBlockedHint: false,
    };
  }
  const expiresMs = Date.parse(input.expiresAt);
  if (expiresMs <= now) {
    return {
      label: 'token-link-expired',
      copy: 'This share has expired.',
      showRequestNewLink: true,
      showAdminBlockedHint: false,
    };
  }
  const daysLeft = Math.max(1, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000)));
  return {
    label: 'token-link-active',
    copy: `Token link active — expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
    showRequestNewLink: false,
    showAdminBlockedHint: false,
  };
};
