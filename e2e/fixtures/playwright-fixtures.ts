import { fileURLToPath } from 'node:url';
import { type FullConfig, test as base } from '@playwright/test';
import { type ViteDevServer, createServer as createViteServer } from 'vite';
import { type StackHandle, startInMemoryStack } from './in-memory-stack.js';

const WEB_ROOT = fileURLToPath(new URL('../../apps/web/', import.meta.url));

const FIXED_API_PORT = Number(process.env.E2E_API_PORT ?? 4101);

interface E2EFixtures {
  stack: StackHandle;
  webBaseUrl: string;
}

interface E2EWorkerFixtures {
  vite: { url: string };
}

let viteServer: ViteDevServer | undefined;

const startVite = async (apiUrl: string): Promise<{ server: ViteDevServer; url: string }> => {
  const server = await createViteServer({
    root: WEB_ROOT,
    configFile: `${WEB_ROOT}vite.config.ts`,
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    logLevel: 'error',
    clearScreen: false,
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error('Vite server did not bind a port');
  }
  const url = `http://127.0.0.1:${address.port}`;
  return { server, url };
};

export const test = base.extend<E2EFixtures, E2EWorkerFixtures>({
  vite: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires destructuring of fixture dependencies.
    async ({}, use: (v: { url: string }) => Promise<void>) => {
      const apiUrl = `http://127.0.0.1:${FIXED_API_PORT}`;
      if (!viteServer) {
        const v = await startVite(apiUrl);
        viteServer = v.server;
        await use({ url: v.url });
        await viteServer.close();
        viteServer = undefined;
      } else {
        const address = viteServer.httpServer?.address();
        if (!address || typeof address === 'string') throw new Error('Vite no port');
        await use({ url: `http://127.0.0.1:${address.port}` });
      }
    },
    { scope: 'worker' },
  ],
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires destructuring of fixture dependencies.
  stack: async ({}, use) => {
    const stack = await startInMemoryStack({ apiPort: FIXED_API_PORT });
    await use(stack);
    await stack.close();
  },
  webBaseUrl: async ({ vite }, use) => {
    await use(vite.url);
  },
});

export { expect } from '@playwright/test';
export type { FullConfig };
