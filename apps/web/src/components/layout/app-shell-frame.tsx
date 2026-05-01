/**
 * `AppShellFrame` — Story 1.6.
 *
 * Outer chrome that:
 *   1. Picks `AppShell.Inbox` (D1) or `AppShell.Cards` (D3) based on
 *      `useShellMode()`.
 *   2. Applies the current theme / density / motion mode classes on
 *      the root div per the design-tokens taxonomy (arch-addendums §
 *      Token taxonomy). Storybook's `withThemeByClassName` decorators
 *      do this manually for stories — `AppShellFrame` is the
 *      production runtime equivalent.
 *
 * Routes don't pick the shell directly. They render content into the
 * `<Outlet />` (handled inside the chosen shell) and the frame chooses
 * which shell wraps the outlet. This means the active shell can flip
 * at runtime without remounting routes — TanStack Router preserves
 * navigation state because the route tree above the shell is stable.
 */

import { useCommandPalette } from '../../hooks/use-command-palette';
import { CommandPalette } from '../feature/command-palette/command-palette';
import { AppShellCards } from './app-shell-cards';
import { AppShellInbox } from './app-shell-inbox';
import { useShellMode } from './shell-mode-store';
import { useThemeModeClassName } from './theme-mode-store';

export function AppShellFrame() {
  const mode = useShellMode();
  const modeClassName = useThemeModeClassName();
  const palette = useCommandPalette();

  return (
    <div data-app-shell-frame="true" className={modeClassName}>
      {mode === 'cards' ? <AppShellCards /> : <AppShellInbox />}
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  );
}
