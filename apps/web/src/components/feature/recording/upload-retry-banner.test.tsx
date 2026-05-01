/// <reference lib="dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UploadRetryBanner } from './upload-retry-banner';

describe('UploadRetryBanner (Story 4.5)', () => {
  it('renders the headline + 3 actions with role="alert"', () => {
    render(
      <UploadRetryBanner
        recordingId="rec-1"
        onRetry={() => undefined}
        onUploadManually={() => undefined}
        autoFocus={false}
      />,
    );
    const banner = screen.getByTestId('upload-retry-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(screen.getByText(/your upload didn't finish/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload manually/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact support/i })).toBeInTheDocument();
  });

  it('fires onRetry when "Retry now" is clicked', () => {
    const onRetry = vi.fn();
    render(
      <UploadRetryBanner
        recordingId="rec-1"
        onRetry={onRetry}
        onUploadManually={() => undefined}
        autoFocus={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry now/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('fires onUploadManually when "Upload manually" is clicked', () => {
    const onUploadManually = vi.fn();
    render(
      <UploadRetryBanner
        recordingId="rec-1"
        onRetry={() => undefined}
        onUploadManually={onUploadManually}
        autoFocus={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /upload manually/i }));
    expect(onUploadManually).toHaveBeenCalledTimes(1);
  });

  it('builds a mailto link that includes the recording id', () => {
    render(
      <UploadRetryBanner
        recordingId="rec-abc-123"
        lastErrorMessage="connection reset by peer"
        onRetry={() => undefined}
        onUploadManually={() => undefined}
        supportEmail="help@example.test"
        autoFocus={false}
      />,
    );
    const link = screen.getByRole('link', { name: /contact support/i }) as HTMLAnchorElement;
    expect(link.href).toMatch(/^mailto:help@example\.test/);
    expect(link.href).toContain(encodeURIComponent('rec-abc-123'));
    expect(link.href).toContain(encodeURIComponent('connection reset by peer'));
  });

  it('autofocuses the primary action by default', () => {
    render(
      <UploadRetryBanner
        recordingId="rec-1"
        onRetry={() => undefined}
        onUploadManually={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /retry now/i })).toHaveFocus();
  });

  it('honors autoFocus={false}', () => {
    render(
      <UploadRetryBanner
        recordingId="rec-1"
        onRetry={() => undefined}
        onUploadManually={() => undefined}
        autoFocus={false}
      />,
    );
    expect(screen.getByRole('button', { name: /retry now/i })).not.toHaveFocus();
  });
});
