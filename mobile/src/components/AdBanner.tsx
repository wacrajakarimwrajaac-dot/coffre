import { Component, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { adsModule, bannerUnitId, startAds } from '@/lib/ads';
import { C } from '@/lib/theme';

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Anchored adaptive banner. Renders nothing until the SDK is ready, when consent is refused, or if anything goes wrong. */
export function AdBanner() {
  const [ready, setReady] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let alive = true;
    // Let the first screen appear before touching the ads SDK.
    const t = setTimeout(() => void startAds().then((ok) => alive && setReady(ok)), 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const m = ready ? adsModule() : null;
  if (!m) return null;
  return (
    <Quiet>
      <View style={{ alignItems: 'center', backgroundColor: C.bg, minHeight: filled ? undefined : 0, overflow: 'hidden' }}>
        <m.BannerAd unitId={bannerUnitId(m)} size={m.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdLoaded={() => setFilled(true)} onAdFailedToLoad={() => setFilled(false)} />
      </View>
    </Quiet>
  );
}
