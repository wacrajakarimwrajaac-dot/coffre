// Coffre Web is a paid feature (7-day free trial, then a subscription sold on the website).
// The phone is the one that serves the data, so it is also the one that enforces it: no active access, no link.
// The app only shows the status. It never shows a price or a way to pay.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

export interface WebAccess {
  active: boolean;
  reason: 'subscription' | 'trial' | 'expired' | 'signed_out';
  /** End of the subscription period or of the trial (ms). */
  until: number | null;
}

const KEY = (userId: string) => `coffre.webaccess.${userId}`;
/** Without internet the last known answer is trusted for a while after its end date, so a short outage never cuts the link. */
const OFFLINE_GRACE = 3 * 864e5;

async function remember(userId: string, a: WebAccess) {
  await AsyncStorage.setItem(KEY(userId), JSON.stringify(a)).catch(() => {});
}

async function cached(userId: string): Promise<WebAccess | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY(userId))) ?? 'null');
  } catch {
    return null;
  }
}

/** Asks the server; if it cannot be reached, falls back to the last answer. Never throws. */
export async function checkWebAccess(userId: string): Promise<WebAccess> {
  try {
    const { data, error } = await supabase.rpc('web_access');
    const r = data?.[0];
    if (error || !r) throw new Error(error?.message ?? 'no answer');
    const a: WebAccess = { active: !!r.active, reason: r.reason, until: r.until ? new Date(r.until).getTime() : null };
    await remember(userId, a);
    return a;
  } catch {
    const last = await cached(userId);
    if (last?.active && (last.until === null || last.until + OFFLINE_GRACE > Date.now())) return last;
    return { active: false, reason: 'expired', until: last?.until ?? null };
  }
}

export const daysLeft = (until: number | null) => (until ? Math.max(0, Math.ceil((until - Date.now()) / 864e5)) : 0);

export function describe(a: WebAccess): string {
  if (a.reason === 'subscription') return a.until ? `Coffre Web actif jusqu’au ${new Date(a.until).toLocaleDateString('fr-FR')}` : 'Coffre Web actif';
  if (a.reason === 'trial') return `Essai gratuit : encore ${daysLeft(a.until)} jour${daysLeft(a.until) > 1 ? 's' : ''}`;
  return 'Coffre Web n’est pas actif sur ton compte';
}
