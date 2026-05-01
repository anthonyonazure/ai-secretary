import type { Meta, StoryObj } from '@storybook/react';
import { Pressable, Text } from 'react-native';

/*
 * Token classes (`bg-accent`, `text-fg`, `text-bg`, …) come from Track 1's
 * `tokens.tailwind.js` once `pnpm --filter @aisecretary/design-tokens
 * build` has run. NativeWind compiles them to RN style objects at build
 * time. Until then this story still renders (NativeWind ignores unknown
 * classes); colors snap into place once tokens land.
 */
function Button({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: 'primary' | 'secondary';
}) {
  const className =
    variant === 'primary'
      ? 'bg-accent active:opacity-80 rounded-md px-4 py-3'
      : 'bg-bg border border-fg/20 active:bg-fg/5 rounded-md px-4 py-3';
  const textClassName =
    variant === 'primary'
      ? 'text-bg text-base font-medium text-center'
      : 'text-fg text-base font-medium text-center';
  return (
    <Pressable className={className} accessibilityRole="button">
      <Text className={textClassName}>{label}</Text>
    </Pressable>
  );
}

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
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
    label: 'Start recording',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Cancel',
    variant: 'secondary',
  },
};
