import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncBackgroundTask } from '@/lib/backgroundBackup';
import { loadSettings, runScheduledBackup } from '@/lib/drive';

/** Runs the scheduled Drive backup when the app opens or returns to the foreground. */
export function AutoBackup() {
  useEffect(() => {
    const check = async () => {
      await syncBackgroundTask((await loadSettings()).frequency !== 'off');
      await runScheduledBackup();
    };
    const t = setTimeout(check, 4000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
  return null;
}
