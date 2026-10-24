import AsyncStorage from '@react-native-async-storage/async-storage';
// Google Drive access for the app, using Google's "device" flow (limited-input devices):
// the app shows a short code, the user confirms it on google.com/device with their Google account,
// and the app receives a long-lived refresh token. It works the same in Expo Go, in builds
// and on emulators, and needs no native Google setup.
// Stored in the app's private storage (no extra native module: keeps the app identical to the
// known-good native build).
const SecureStore = {
  getItemAsync: (k: string) => AsyncStorage.getItem(k),
  setItemAsync: (k: string, v: string) => AsyncStorage.setItem(k, v),
  deleteItemAsync: (k: string) => AsyncStorage.removeItem(k),
};

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_DEVICE_CLIENT_ID;
// For "TVs and limited input devices" clients Google does not treat this secret as confidential.
const CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_DEVICE_CLIENT_SECRET;

export const DRIVE_CONFIGURED = !!CLIENT_ID && !!CLIENT_SECRET;

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REFRESH_KEY = 'coffre.drive.refresh';

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  interval: number;
}

async function post(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { ok: res.ok, json };
}

export async function startDeviceFlow(): Promise<DeviceCode> {
  if (!DRIVE_CONFIGURED) throw new Error('Google Drive n’est pas encore configuré dans l’app.');
  const { ok, json } = await post('https://oauth2.googleapis.com/device/code', { client_id: CLIENT_ID!, scope: SCOPE });
  if (!ok) throw new Error(json.error_description ?? json.error ?? 'Connexion à Google impossible');
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUrl: json.verification_url ?? 'https://www.google.com/device',
    expiresAt: Date.now() + Number(json.expires_in ?? 1800) * 1000,
    interval: Number(json.interval ?? 5),
  };
}

/** Waits until the user confirms the code on google.com/device (or the code expires / is cancelled). */
export async function waitForDeviceAuthorization(code: DeviceCode, cancelled: () => boolean): Promise<void> {
  let wait = code.interval;
  while (Date.now() < code.expiresAt) {
    await new Promise((r) => setTimeout(r, wait * 1000));
    if (cancelled()) throw new Error('Annulé');
    const { ok, json } = await post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (ok && json.refresh_token) {
      await SecureStore.setItemAsync(REFRESH_KEY, json.refresh_token);
      cached = { token: json.access_token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
      return;
    }
    if (json.error === 'authorization_pending') continue;
    if (json.error === 'slow_down') { wait += 5; continue; }
    if (json.error === 'access_denied') throw new Error('Accès refusé sur Google');
    throw new Error(json.error_description ?? json.error ?? 'Autorisation Google impossible');
  }
  throw new Error('Le code a expiré, recommence.');
}

let cached: { token: string; expiresAt: number } | null = null;

export const hasDriveAccount = async () => !!(await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null));

/** A valid access token, refreshed silently from the stored refresh token. */
export async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh || !DRIVE_CONFIGURED) throw new Error('Google Drive n’est pas connecté');
  const { ok, json } = await post('https://oauth2.googleapis.com/token', {
    client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, refresh_token: refresh, grant_type: 'refresh_token',
  });
  if (!ok || !json.access_token) {
    if (json.error === 'invalid_grant') {
      await disconnectDrive();
      throw new Error('L’accès à Google Drive a expiré : reconnecte ton compte.');
    }
    throw new Error(json.error_description ?? 'Connexion à Google Drive impossible');
  }
  cached = { token: json.access_token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function disconnectDrive() {
  cached = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
}
