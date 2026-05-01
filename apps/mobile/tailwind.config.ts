import type { Config } from 'tailwindcss';

// Token theme is emitted by `packages/design-tokens` (Track 1).
// Mobile reuses `tokens.tailwind.js` for NativeWind class generation;
// runtime token values for non-style consumers (animation drivers,
// imperative APIs) come from `tokens.native.ts` — see `src/lib/tokens.ts`.
const tokenTheme = await import('@aisecretary/design-tokens/build/tokens.tailwind.js')
  .then((m) => (m as { default: Record<string, unknown> }).default)
  .catch(() => ({}) as Record<string, unknown>);

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: ['class', '.theme-dark'],
  theme: {
    extend: tokenTheme,
  },
  plugins: [],
};

export default config;
