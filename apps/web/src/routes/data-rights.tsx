/**
 * `/data-rights` — public, no-auth DSAR portal (FR52).
 *
 * Plain-language register (UX spec § Step 11 GOV.UK style). The submitter
 * picks a request kind (access / deletion / correction), provides
 * identity info + tenant slug + a description. The server emails a
 * verification link; only after the submitter clicks the link does the
 * request route to the receiving tenant's admin queue.
 *
 * No auth — the verification email is the credential.
 */

import {
  type DsarPortalSubmissionResponse,
  type DsarPortalSubmitRequest,
  dsarPortalSubmissionResponseSchema,
} from '@aisecretary/shared';
import { createFileRoute } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { resolveApiBaseUrl } from '../lib/auth/api-client';

export const Route = createFileRoute('/data-rights')({
  component: DataRightsRoute,
});

const submitDsar = async (body: DsarPortalSubmitRequest): Promise<DsarPortalSubmissionResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/data-rights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Submission failed (${res.status})`);
  }
  return dsarPortalSubmissionResponseSchema.parse(await res.json());
};

const REQUEST_KIND_LABEL = {
  access: 'I want to see my data',
  deletion: 'I want my data deleted',
  correction: 'I want my data corrected',
} as const;

function DataRightsRoute() {
  const formId = useId();
  const [kind, setKind] = useState<DsarPortalSubmitRequest['kind']>('access');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [description, setDescription] = useState('');
  const [secondaryVerification, setSecondaryVerification] = useState('');
  const [submission, setSubmission] = useState<DsarPortalSubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitDsar({
        kind,
        email: email.trim(),
        fullName: fullName.trim(),
        tenantSlug: tenantSlug.trim(),
        description: description.trim(),
        ...(secondaryVerification.trim().length > 0
          ? { secondaryVerification: secondaryVerification.trim() }
          : {}),
      });
      setSubmission(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (submission) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-fg"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-fg" data-testid="dsar-submission-message">
          {submission.message}
        </p>
        <p className="text-xs text-fg-muted">
          The verification link expires{' '}
          {new Date(submission.verificationExpiresAt).toLocaleDateString()}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-fg-muted">Data rights</span>
        <h1 className="font-sans text-3xl font-semibold">Submit a data-rights request</h1>
        <p className="text-sm text-fg-muted">
          Use this form to ask AI Secretary to show you, correct, or delete personal data we hold
          about you. We’ll email you a verification link to confirm it’s really you, then route your
          request to the right organization.
        </p>
      </header>

      <form
        id={formId}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6"
        aria-label="Data-rights request form"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-fg">What would you like to do?</legend>
          {(['access', 'deletion', 'correction'] as const).map((k) => (
            <label key={k} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                data-testid={`dsar-kind-${k}`}
              />
              <span>{REQUEST_KIND_LABEL[k]}</span>
            </label>
          ))}
        </fieldset>

        <Field label="Your name" required>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={1}
            maxLength={200}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="dsar-full-name"
          />
        </Field>

        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="dsar-email"
          />
        </Field>

        <Field
          label="Organization"
          helper="The name (or short URL slug) of the company you believe holds your data."
          required
        >
          <input
            type="text"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
            minLength={1}
            maxLength={120}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="dsar-tenant-slug"
          />
        </Field>

        <Field
          label="Tell us what you’d like"
          helper="Anything that helps us find your data — emails you’ve been on, the meeting names, or dates."
          required
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={5}
            className="rounded-md border border-border bg-bg p-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="dsar-description"
          />
        </Field>

        <Field
          label="Secondary contact (optional)"
          helper="A phone number or alternate email. Helpful if we can’t reach the email above."
        >
          <input
            type="text"
            value={secondaryVerification}
            onChange={(e) => setSecondaryVerification(e.target.value)}
            maxLength={200}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="dsar-secondary"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="dsar-submit"
        >
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      <footer className="text-xs text-fg-muted">
        We’ll respond within the legally-required window for your jurisdiction (typically 30 days
        for GDPR / CCPA). If you’re an employee or customer of an organization that uses AI
        Secretary, you can also reach out to that organization directly.
      </footer>
    </main>
  );
}

function Field({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: input is rendered as a child by the caller
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-fg">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {helper ? <span className="text-xs text-fg-muted">{helper}</span> : null}
    </label>
  );
}
