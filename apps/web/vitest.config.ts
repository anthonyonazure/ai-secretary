import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { ViteUserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

/**
 * Vitest-only plugin that intercepts `.css` imports and returns an
 * empty module. Tailwind's TS-config loader (jiti) can't evaluate the
 * top-level `await` in `tailwind.config.ts`; Vite + esbuild handle it
 * fine in dev/build, but the vitest pipeline trips. Story 1.6 added
 * the first `.test.tsx` that imports a component with a `.css`
 * side-effect (the recording-status-pill); we don't assert against
 * computed styles in tests, so stubbing CSS out is safe.
 */
function stubCssImports(): Plugin {
  return {
    name: 'vitest-stub-css',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.css')) {
        return { id: '\0vitest-stub-css', moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id === '\0vitest-stub-css') return 'export default {};';
      return null;
    },
  };
}

const config: ViteUserConfig = {
  // Cast: vitest bundles an older vite type that doesn't match the
  // vite@6 plugin shape one-to-one. Functionally compatible.
  plugins: [stubCssImports() as unknown as never, react() as unknown as never],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest 4 removed environmentMatchGlobs. The same split is two projects
    // that inherit everything above (plugins, alias, setup file): component
    // tests (.test.tsx) get jsdom, pure-logic tests (.test.ts) stay on node.
    projects: [
      {
        extends: true,
        test: { name: 'node', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'jsdom', include: ['src/**/*.test.tsx'], environment: 'jsdom' },
      },
    ],
  },
};

export default defineConfig(config);
