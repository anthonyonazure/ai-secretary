import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CommandPalette, CommandPaletteTrigger } from './command-palette';

/**
 * `CommandPalette` — Story 1.6 cmd-K placeholder. Full search lands
 * in Epic 7; the harness here just exercises open / close + the
 * trigger button.
 */
function PaletteHarness({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <CommandPaletteTrigger onOpen={() => setOpen(true)} />
      <CommandPalette open={open} onOpenChange={setOpen} disableShortcut />
    </div>
  );
}

const meta: Meta<typeof PaletteHarness> = {
  title: 'Layout/CommandPalette',
  component: PaletteHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'cmd-K palette — Radix Dialog + global keybinding. Story 1.6 ships the chrome; full search results land in Epic 7.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PaletteHarness>;

export const Closed: Story = {
  args: { defaultOpen: false },
};

export const OpenEmpty: Story = {
  args: { defaultOpen: true },
};

export const OpenWithPlaceholderResults: Story = {
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Same chrome as `OpenEmpty` — once Epic 7 wires real results, the placeholder copy is replaced by a virtualized list slot.',
      },
    },
  },
};
