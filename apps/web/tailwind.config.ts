import { createRequire } from 'node:module';
import type { Config } from 'tailwindcss';

// Token theme is emitted by `packages/design-tokens` (Track 1).
// Once `pnpm --filter @aisecretary/design-tokens build` has run, the
// build artifact at `@aisecretary/design-tokens/build/tokens.tailwind.js`
// exports a Tailwind theme extension covering color / spacing / radius /
// font / motion / elevation / focus tokens.
//
// We resolve it via `createRequire` (synchronous CJS-style require) so
// the config evaluates without top-level `await`. Tailwind's TS-config
// loader ships an older `jiti` (1.21.x) that can't evaluate top-level
// await; Vite + esbuild handle it fine in dev, but the production
// PostCSS pipeline goes through that older jiti and fails.
//
// Web-build CI step `needs: tokens` per arch-addendums § CI integration,
// so production builds always have a fresh artifact.
const require = createRequire(import.meta.url);
let tokenTheme: Record<string, unknown> = {};
try {
  const mod = require('@aisecretary/design-tokens/build/tokens.tailwind.js') as
    | { default?: Record<string, unknown> }
    | Record<string, unknown>;
  tokenTheme =
    (mod as { default?: Record<string, unknown> }).default ?? (mod as Record<string, unknown>);
} catch {
  // Track 1 hasn't shipped the artifact yet — fall back to an empty
  // theme so the config still parses for local development.
  tokenTheme = {};
}

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
  darkMode: ['class', '.theme-dark'],
  theme: {
    extend: tokenTheme,
  },
  plugins: [],
};

export default config;
