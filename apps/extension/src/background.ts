/**
 * Background service worker — Manifest V3.
 *
 * Today this is a thin scaffold. Real responsibilities:
 *   - Hold the auth token (chrome.storage.local) so content scripts
 *     don't have to round-trip credentials on every CRM page load.
 *   - Proxy fetches to the AI Secretary API so the extension's CSP
 *     doesn't fight the CRM host's CSP.
 *   - Listen for context-menu actions (right-click → "Save selection
 *     as a meeting note").
 */

const init = (): void => {
  if (typeof chrome === 'undefined') return;
  chrome.runtime?.onInstalled.addListener(() => {
    // No-op for now. Once we have a settings page, we'd open it here
    // on first install: chrome.tabs.create({ url: 'options.html' }).
  });
};

init();
