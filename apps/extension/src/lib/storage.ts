/**
 * `chrome.storage.local` thin wrapper.
 *
 * Holds:
 *   - `accessToken`  — paired AI Secretary API token (set via popup).
 *   - `apiBaseUrl`   — environment override (defaults to prod).
 *
 * Uses `chrome.storage.local` (not `sync`) because the token is a
 * device-scoped credential — we don't want it propagating across
 * the user's other Chrome profiles.
 */

const STORAGE_KEYS = {
  accessToken: 'aisecretary:accessToken',
  apiBaseUrl: 'aisecretary:apiBaseUrl',
} as const;

const DEFAULT_API_BASE_URL = 'https://api.aisecretary.app';

export interface ExtensionConfig {
  accessToken: string | null;
  apiBaseUrl: string;
}

const isChromeAvailable = (): boolean => typeof chrome !== 'undefined' && !!chrome.storage?.local;

export const loadConfig = async (): Promise<ExtensionConfig> => {
  if (!isChromeAvailable()) {
    return { accessToken: null, apiBaseUrl: DEFAULT_API_BASE_URL };
  }
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.apiBaseUrl,
  ]);
  return {
    accessToken: (stored[STORAGE_KEYS.accessToken] as string | undefined) ?? null,
    apiBaseUrl: (stored[STORAGE_KEYS.apiBaseUrl] as string | undefined) ?? DEFAULT_API_BASE_URL,
  };
};

export const setAccessToken = async (token: string | null): Promise<void> => {
  if (!isChromeAvailable()) return;
  if (token === null) {
    await chrome.storage.local.remove(STORAGE_KEYS.accessToken);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.accessToken]: token });
};

export const setApiBaseUrl = async (url: string): Promise<void> => {
  if (!isChromeAvailable()) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.apiBaseUrl]: url });
};
