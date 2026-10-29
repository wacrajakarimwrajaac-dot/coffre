// Ads (Google AdMob). The native module is loaded lazily and every failure is swallowed: the app must never
// depend on an ad to start, and in Expo Go (no native module) ads are simply absent.
//
// Test ads by default (Google's public test ids). For real ads, set these as EAS environment variables and rebuild:
//   EXPO_PUBLIC_ADMOB_BANNER_ANDROID / EXPO_PUBLIC_ADMOB_BANNER_IOS   banner ad unit ids
// and replace the test app ids in app.json (react-native-google-mobile-ads plugin) with your AdMob app ids.
// EXPO_PUBLIC_ADS=0 turns ads off.
import { Platform } from 'react-native';

export const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS !== '0';

type AdsModule = typeof import('react-native-google-mobile-ads');

let loaded: AdsModule | null | undefined;
export function adsModule(): AdsModule | null {
  if (loaded !== undefined) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

let started: Promise<boolean> | null = null;

/** Asks for consent where the law requires it (EEA / UK), then starts the ads SDK. Resolves to "may show ads". */
export function startAds(): Promise<boolean> {
  if (!ADS_ENABLED) return Promise.resolve(false);
  started ??= (async () => {
    try {
      const m = adsModule();
      if (!m) return false;
      const info = await m.AdsConsent.gatherConsent();
      if (!info.canRequestAds) return false;
      await m.default().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return started;
}

export function bannerUnitId(m: AdsModule): string {
  const id = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  return id || m.TestIds.ADAPTIVE_BANNER;
}
