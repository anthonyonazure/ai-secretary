import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['hooks/**/*.test.ts', 'components/**/*.test.ts', 'lib/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
