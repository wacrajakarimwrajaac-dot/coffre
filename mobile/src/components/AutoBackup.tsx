import { useEffect } from 'react';
import { AppState } from 'react-native';
import { runScheduledBackup } from '@/lib/drive';

/** Runs the scheduled Drive backup when the app opens or returns to the foreground. */
export function AutoBackup() {
  useEffect(() => {
    const t = setTimeout(() => void runScheduledBackup(), 4000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void runScheduledBackup());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
  return null;
}
