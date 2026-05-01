import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';

/*
 * Token classes (`bg-accent`, `text-fg`, `text-bg`, `bg-bg`, etc.) are
 * emitted by Track 1 in `tokens.tailwind.js` once
 * `pnpm --filter @aisecretary/design-tokens build` has run. Until then
 * Storybook still renders this story (Tailwind treats unknown classes
 * as no-ops); the colors snap into place once tokens land.
 */
function Button({
  children,
  variant = 'primary',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const variantClasses =
    variant === 'primary'
      ? 'bg-accent text-bg hover:opacity-90'
      : 'bg-bg text-fg border border-fg/20 hover:bg-fg/5';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${variantClasses}`}
    >
      {children}
    </button>
  );
}

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'radio' },
      options: ['primary', 'secondary'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Start recording',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Cancel',
    variant: 'secondary',
  },
};
