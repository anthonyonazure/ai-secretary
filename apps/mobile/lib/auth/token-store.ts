/**
 * Mobile token storage.
 *
 * Refresh tokens are sensitive — we use `expo-secure-store` (Keychain on
 * iOS, EncryptedSharedPreferences on Android) instead of AsyncStorage.
 * Access tokens stay in-memory only inside the Zustand store.
 *
 * TODO(Story 1.5e): consider rotating to a session-bound credential
 * issued by the backend; secure-store is fine for the slice.
 */

import * as SecureStore from 'expo-secure-store';

export const REFRESH_TOKEN_KEY = 'aisecretary.refresh-token';

export async function loadRefreshToken(): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Non-fatal — user just won't survive a cold start.
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
