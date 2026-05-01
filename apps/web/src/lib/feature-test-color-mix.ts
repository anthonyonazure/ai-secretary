/**
 * One-shot feature test that adds `.no-color-mix` to <html> when the
 * runtime cannot evaluate `color-mix(in oklch, ...)`. The token build
 * pipeline emits both the live `color-mix()` value and a pre-computed
 * fallback custom property; the `.no-color-mix` scope swaps the live
 * value for the fallback. See arch-addendums § Static fallback for
 * color-mix().
 */
export function applyColorMixFeatureTest(): void {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || !CSS.supports) {
    return;
  }
  if (!CSS.supports('color: color-mix(in oklch, red 50%, blue)')) {
    document.documentElement.classList.add('no-color-mix');
  }
}
