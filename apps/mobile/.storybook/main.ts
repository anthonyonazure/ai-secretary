import type { StorybookConfig } from '@storybook/react-native';

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
};

export default config;
