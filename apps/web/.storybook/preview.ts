import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

/*
 * Theme / density / motion are mode classes on <html> per
 * arch-addendums § Token taxonomy. We expose three independent
 * decorators so reviewers can toggle each axis in isolation.
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      element: '#storybook-root',
      manual: false,
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'theme-dark',
      },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
    withThemeByClassName({
      themes: {
        dense: 'density-dense',
        relaxed: 'density-relaxed',
        accessible: 'density-accessible',
      },
      defaultTheme: 'relaxed',
      parentSelector: 'html',
    }),
    withThemeByClassName({
      themes: {
        default: 'motion-default',
        gentle: 'motion-gentle',
        reduced: 'motion-reduced',
      },
      defaultTheme: 'default',
      parentSelector: 'html',
    }),
  ],
};

export default preview;
