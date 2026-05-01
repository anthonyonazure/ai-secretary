import type { Preview } from '@storybook/react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/*
 * Theme / density / motion mode wrapper for stories. NativeWind reads
 * className-on-host, so the parent <View> is enough for descendants to
 * resolve the active mode. We default to dark + relaxed + default
 * motion to match RootLayout. Per-story overrides land via decorators
 * once the design-tokens runtime export is wired (Track 1 follow-up).
 */
function ModeWrapper({ children }: { children: ReactNode }) {
  return (
    <View className="theme-dark density-relaxed motion-default flex-1 bg-bg p-4">{children}</View>
  );
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [(Story) => <ModeWrapper>{Story()}</ModeWrapper>],
};

export default preview;
