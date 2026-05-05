/**
 * Toolbar popup — renders the signed-in state, lists connected CRM
 * integrations, and provides a one-time pairing form.
 *
 * Plain DOM (no React) so the build is just `tsc` — no bundler config
 * needed for the portfolio scaffold.
 */

import { listIntegrations } from './lib/api-client.js';
import { type CrmHost, detectCrmHost } from './lib/crm-detector.js';
import { loadConfig, setAccessToken } from './lib/storage.js';

const HOST_LABEL: Record<CrmHost, string> = {
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  pipedrive: 'Pipedrive',
  unknown: 'No CRM',
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const queryActiveTabHost = async (): Promise<CrmHost> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return 'unknown';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return 'unknown';
  try {
    return detectCrmHost(new URL(tab.url).hostname);
  } catch {
    return 'unknown';
  }
};

const renderUnpaired = (main: HTMLElement, errorMsg?: string): void => {
  main.innerHTML = `
    <p class="empty">
      Pair this extension with your AI Secretary account by pasting an
      access token from <code>app.aisecretary.app/settings/extensions</code>.
    </p>
    <label for="token">Access token</label>
    <input id="token" type="password" autocomplete="off" placeholder="ais_…" />
    <button id="pair">Pair extension</button>
    ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ''}
  `;
  const input = main.querySelector<HTMLInputElement>('#token');
  const btn = main.querySelector<HTMLButtonElement>('#pair');
  if (!input || !btn) return;
  btn.addEventListener('click', async () => {
    const value = input.value.trim();
    if (!value) {
      renderUnpaired(main, 'Token is required.');
      return;
    }
    await setAccessToken(value);
    await render();
  });
};

const renderPaired = (
  main: HTMLElement,
  integrations: Array<{ id: string; provider: string; accountLabel: string; status: string }>,
): void => {
  if (integrations.length === 0) {
    main.innerHTML = `
      <p class="empty">
        No CRMs connected. Visit
        <a href="https://app.aisecretary.app/settings/integrations" target="_blank" rel="noopener">
          app.aisecretary.app/settings/integrations</a>
        to connect HubSpot, Salesforce, or Pipedrive.
      </p>
    `;
    return;
  }
  main.innerHTML = integrations
    .map(
      (i) => `
      <div class="integration" data-id="${escapeHtml(i.id)}">
        <div class="row">
          <span class="label">${escapeHtml(i.accountLabel)}</span>
          <span class="status ${escapeHtml(i.status)}">${escapeHtml(i.status)}</span>
        </div>
        <div class="row">
          <span class="status">${escapeHtml(i.provider)}</span>
        </div>
      </div>
    `,
    )
    .join('');
};

const render = async (): Promise<void> => {
  const main = document.getElementById('main');
  const hostEl = document.getElementById('host');
  if (!main || !hostEl) return;

  hostEl.textContent = HOST_LABEL[await queryActiveTabHost()];

  const config = await loadConfig();
  if (!config.accessToken) {
    renderUnpaired(main);
    return;
  }

  try {
    const list = await listIntegrations({
      baseUrl: config.apiBaseUrl,
      accessToken: config.accessToken,
    });
    renderPaired(main, list.items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    renderUnpaired(main, `Failed to load: ${message}`);
  }
};

const init = (): void => {
  const reset = document.getElementById('reset-token');
  if (reset) {
    reset.addEventListener('click', async (e) => {
      e.preventDefault();
      await setAccessToken(null);
      await render();
    });
  }
  void render();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
