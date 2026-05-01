import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from './i18n';
import { applyColorMixFeatureTest } from './lib/feature-test-color-mix';
import { router } from './router';
import './styles/globals.css';

// Run feature test BEFORE first render so the .no-color-mix fallback
// class is on <html> for the initial paint. See arch-addendums § Static
// fallback for color-mix().
applyColorMixFeatureTest();

// Story 1.9 — initialize i18next synchronously before mounting the
// router so the first render of any route already has translations
// resolved. Resources are bundled, so init never blocks on a fetch.
initI18n();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Service-worker registration — production-only. Vite injects `import.meta.env.PROD`
// so the dev server doesn't trip on the missing build artifact. Story 4.2 wires
// the worker for the offline upload queue replay; later epics add caching strategies.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Registration failure is non-fatal — page still works without offline replay.
    });
  });
}
