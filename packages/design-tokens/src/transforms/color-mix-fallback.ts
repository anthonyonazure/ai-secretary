/**
 * Style Dictionary custom transform + format helper for color-mix() fallback.
 *
 * Per ADR-0002 §"Static fallback for color-mix()":
 *   For any token whose value uses CSS `color-mix(...)` AND declares a
 *   `fallback` key, we emit two CSS custom properties:
 *     --<name>           = <live color-mix() expression>
 *     --<name>-fallback  = <pre-computed value>
 *   The `.no-color-mix` selector overrides the live var with the fallback.
 *
 * The RN export pipeline only ever consumes the fallback (RN has no
 * color-mix() support).
 */

// biome-ignore lint/suspicious/noExplicitAny: SD's TransformedToken type isn't reliably exported across versions; we narrow at call sites.
type SdToken = any;

export interface ColorMixToken {
  value: string;
  fallback: string;
  name: string;
  path: string[];
}

export function isColorMixToken(token: SdToken): token is ColorMixToken {
  return (
    typeof token?.value === 'string' &&
    token.value.includes('color-mix(') &&
    typeof token?.fallback === 'string'
  );
}

/**
 * Style Dictionary 4.x transform definition. Registered in
 * `style-dictionary.config.js` via `sd.registerTransform`.
 *
 * Transform of kind `attribute` so it runs early enough to annotate the
 * token without mutating its primary value (the format step decides
 * whether to swap based on platform).
 */
export const colorMixFallbackTransform = {
  name: 'attribute/color-mix-fallback',
  type: 'attribute' as const,
  transitive: false,
  filter: (token: SdToken): boolean => isColorMixToken(token),
  transform: (token: SdToken): Record<string, unknown> => ({
    ...(token.attributes ?? {}),
    hasColorMixFallback: true,
    colorMixFallback: token.fallback,
  }),
};

/**
 * Resolve the runtime value for a token on a given platform.
 *  - 'web'    → keep the live color-mix() expression.
 *  - 'native' → swap to the static fallback (RN doesn't support color-mix()).
 */
export function resolvePlatformValue(token: SdToken, platform: 'web' | 'native'): string {
  if (isColorMixToken(token)) {
    return platform === 'native' ? token.fallback : token.value;
  }
  return String(token.value);
}
