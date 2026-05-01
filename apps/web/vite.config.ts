import path from 'node:path';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA stub — full manifest + service-worker strategy lands with the
// offline-recording / queued-upload epic. For now the plugin is wired so
// that build artifacts include a registerable SW and the manifest spot
// is reserved.
//
// TanStackRouterVite watches `src/routes/**` and regenerates
// `src/routeTree.gen.ts`. The generated file is committed to git so
// `pnpm typecheck` works in fresh clones without first running `vite dev`
// (autoCodeSplitting is off — the bundle is small enough that splitting
// adds no value at this stage; revisit when the route tree exceeds ~30
// nodes).
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: false,
      // Co-located `*.test.tsx` files inside `src/routes/` are *tests*,
      // not routes. The default `routeFileIgnorePrefix: '-'` only
      // catches `-foo.tsx`; pattern below excludes the test suffix.
      routeFileIgnorePattern: '\\.test\\.[jt]sx?$',
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'AI Secretary',
        short_name: 'AI Secretary',
        description: 'Meeting Intelligence & Decision Platform',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
