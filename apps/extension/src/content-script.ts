/**
 * Content script — runs on every CRM page the manifest matches.
 *
 * Responsibilities:
 *   1. Detect which CRM is hosting the page.
 *   2. Mount a small mount-point DOM node (`#aisecretary-overlay-root`)
 *      so the popup or background can render the F5-CRM deal-mapping
 *      flow without fighting the host page.
 *   3. Listen for `chrome.runtime` messages and forward them into a
 *      window-level event channel so the React tree (loaded later)
 *      can subscribe.
 *
 * The actual deal-mapping React surface (FR73) is a follow-up.
 */

import { detectCrmHost } from './lib/crm-detector.js';

const MOUNT_ID = 'aisecretary-overlay-root';

const ensureMountPoint = (): HTMLElement => {
  const existing = document.getElementById(MOUNT_ID);
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = MOUNT_ID;
  el.dataset.aisecretaryHost = detectCrmHost(window.location.hostname);
  // Out-of-flow position so we don't disturb the host's layout. The
  // React tree will use absolute / fixed positioning inside.
  el.style.position = 'fixed';
  el.style.zIndex = '2147483647';
  el.style.bottom = '16px';
  el.style.right = '16px';
  document.body.appendChild(el);
  return el;
};

const main = (): void => {
  if (!document.body) {
    // Some host pages render before body is parsed — defer.
    document.addEventListener('DOMContentLoaded', () => main(), { once: true });
    return;
  }
  const mount = ensureMountPoint();
  // Bridge chrome.runtime messages → window-level events so the React
  // tree can subscribe without holding a chrome.runtime listener.
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      window.dispatchEvent(new CustomEvent('aisecretary:message', { detail: message }));
    });
  }
  mount.dispatchEvent(new CustomEvent('aisecretary:ready'));
};

main();
