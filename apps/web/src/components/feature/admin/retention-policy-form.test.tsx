import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RetentionPolicyForm } from './retention-policy-form';

describe('RetentionPolicyForm', () => {
  it('saves the supplied values', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<RetentionPolicyForm value={{ audioDays: 90, transcriptDays: 365 }} onSave={onSave} />);
    await user.click(screen.getByTestId('retention-policy-save'));
    expect(onSave).toHaveBeenCalledWith({ audioDays: 90, transcriptDays: 365 });
  });

  it('rejects when audio retention exceeds transcript retention', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<RetentionPolicyForm value={{ audioDays: 365, transcriptDays: 365 }} onSave={onSave} />);
    const audio = screen.getByTestId('retention-audioDays-input') as HTMLInputElement;
    await user.clear(audio);
    await user.type(audio, '500');
    await user.click(screen.getByTestId('retention-policy-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('retention-audioDays-error').textContent).toMatch(/cannot exceed/);
  });

  it('enforces the minDays floor', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <RetentionPolicyForm
        value={{ audioDays: 30, transcriptDays: 365 }}
        minDays={30}
        onSave={onSave}
      />,
    );
    const audio = screen.getByTestId('retention-audioDays-input') as HTMLInputElement;
    await user.clear(audio);
    await user.type(audio, '7');
    await user.click(screen.getByTestId('retention-policy-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('retention-audioDays-error').textContent).toMatch(/Minimum 30 days/);
  });

  it('disables the save button while pending', () => {
    render(
      <RetentionPolicyForm
        value={{ audioDays: 90, transcriptDays: 365 }}
        onSave={() => {}}
        isPending
      />,
    );
    const btn = screen.getByTestId('retention-policy-save') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Saving…');
  });
});
