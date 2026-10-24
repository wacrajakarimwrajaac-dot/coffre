import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { rebuildStyles } from '@/components/ui';
import { applyScheme, type Scheme } from './theme';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'coffre.theme';

const Ctx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void; scheme: Scheme }>({ pref: 'system', setPref: () => {}, scheme: 'dark' });

export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setPrefState(v === 'light' || v === 'dark' ? v : 'system')).catch(() => setPrefState('system'));
  }, []);

  const effective = pref ?? 'system';
  const scheme: Scheme = effective === 'system' ? (system === 'light' ? 'light' : 'dark') : effective;

  // Idempotent: palette + styles are updated before the (remounted) children render.
  applyScheme(scheme);
  rebuildStyles();

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  };

  if (pref === null) return null; // wait for the stored preference (a few ms) to avoid a flash
  return (
    <Ctx.Provider value={{ pref, setPref, scheme }}>
      <Fragment key={scheme}>{children}</Fragment>
    </Ctx.Provider>
  );
}
