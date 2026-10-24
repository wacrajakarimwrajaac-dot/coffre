import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || null;
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || null;

export function deviceSummary(): { platform: string; device: string } {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return {
    platform: `${os} ${String(Platform.Version)}`,
    device: (Constants.deviceName ?? '').slice(0, 300),
  };
}
