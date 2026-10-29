// Google sign-in, then access check: paid subscription, 7-day free trial, or the subscription page.
// The phone checks the same rule itself before it serves the site, so this screen is not the only gate.
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { phone } from './phone';
import { supabase } from './supabase';

export interface Access {
  active: boolean;
  reason: 'subscription' | 'trial' | 'expired' | 'signed_out';
  until: Date | null;
}

interface Account {
  email: string;
  access: Access;
  signOut: () => Promise<void>;
  subscribeUrl: string | null;
}

const Ctx = createContext<Account | null>(null);
export const useAccount = () => useContext(Ctx)!;

const CHECKOUT = import.meta.env.VITE_CHECKOUT_URL as string | undefined;
export const PRICE_LABEL = (import.meta.env.VITE_PRICE_LABEL as string | undefined) || '1 € par mois';

/** Checkout link of the payment provider (Lemon Squeezy format), carrying the account id so the webhook knows who paid. */
function checkoutUrl(userId: string, email: string): string | null {
  if (!CHECKOUT) return null;
  try {
    const u = new URL(CHECKOUT);
    u.searchParams.set('checkout[email]', email);
    u.searchParams.set('checkout[custom][user_id]', userId);
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchAccess(): Promise<Access> {
  const { data, error } = await supabase!.rpc('web_access');
  const r = data?.[0];
  if (error || !r) throw new Error(error?.message ?? 'Accès introuvable');
  return { active: !!r.active, reason: r.reason, until: r.until ? new Date(r.until) : null };
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const load = useCallback(async () => {
    try {
      setAccess(await fetchAccess());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setAccess(null);
      return;
    }
    void load();
  }, [userId, load]);

  // On the subscription page: look again every 10 s and when coming back to the tab, so a payment shows up by itself.
  const blocked = !!access && !access.active;
  useEffect(() => {
    if (!blocked) return;
    const h = setInterval(() => document.visibilityState === 'visible' && void load(), 10_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(h);
      window.removeEventListener('focus', onFocus);
    };
  }, [blocked, load]);

  const email = session?.user.email ?? '';
  const subscribeUrl = useMemo(() => (userId ? checkoutUrl(userId, email) : null), [userId, email]);
  const signOut = useCallback(async () => {
    await phone.forget().catch(() => {});
    await supabase!.auth.signOut();
  }, []);

  if (!supabase) return <Screen><p className="error">Le service Coffre n’est pas configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p></Screen>;
  if (session === undefined) return <Screen><div className="spinner" /></Screen>;
  if (!session) return <SignIn />;
  if (!access) {
    return (
      <Screen>
        {error ? <><p className="error">{error}</p><button className="ghost" onClick={load}>Réessayer</button></> : <div className="spinner" />}
        <button className="ghost" onClick={signOut}><Icon name="log-out" size={16} /> Se déconnecter</button>
      </Screen>
    );
  }
  if (!access.active) return <Paywall email={email} access={access} subscribeUrl={subscribeUrl} onSignOut={signOut} />;
  return <Ctx.Provider value={{ email, access, signOut, subscribeUrl }}>{children}</Ctx.Provider>;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="pair">
      <div className="pair-top"><img src="/logo-mark.png" alt="" width={30} height={30} /> Coffre Web</div>
      <div className="pair-card center">{children}</div>
    </div>
  );
}

function SignIn() {
  const [error, setError] = useState('');
  const google = async () => {
    const { error: e } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (e) setError(e.message);
  };
  return (
    <Screen>
      <h1>Coffre sur ton ordinateur</h1>
      <p className="muted">Connecte-toi avec le même compte Google que sur ton téléphone. Tes données restent sur ton téléphone : ce site les affiche.</p>
      <button className="btn-google" onClick={google}><span className="g">G</span> Continuer avec Google</button>
      {error && <p className="error">{error}</p>}
      <p className="muted small">7 jours d’essai gratuit, puis {PRICE_LABEL}.</p>
    </Screen>
  );
}

function Paywall({ email, access, subscribeUrl, onSignOut }: { email: string; access: Access; subscribeUrl: string | null; onSignOut: () => void }) {
  return (
    <Screen>
      <h1>{access.reason === 'expired' ? 'Ton essai gratuit est terminé' : 'Abonnement requis'}</h1>
      <p className="muted">
        Coffre Web affiche ton Coffre sur l’ordinateur, en direct depuis ton téléphone. Il coûte <b>{PRICE_LABEL}</b>, et l’app mobile reste gratuite.
      </p>
      <ul className="perks">
        <li><Icon name="check" size={17} /> Tes dossiers, notes, liens, photos et vidéos sur grand écran</li>
        <li><Icon name="check" size={17} /> Ajout de fichiers depuis l’ordinateur, directement sur ton téléphone</li>
        <li><Icon name="check" size={17} /> Chiffré de bout en bout, rien n’est stocké sur un serveur</li>
      </ul>
      {subscribeUrl ? (
        <a className="btn primary" href={subscribeUrl} target="_blank" rel="noreferrer">S’abonner · {PRICE_LABEL}</a>
      ) : (
        <p className="muted">L’abonnement n’est pas encore ouvert. Reviens bientôt.</p>
      )}
      <p className="muted small">Connecté en tant que {email}. Après le paiement, cette page se met à jour toute seule.</p>
      <button className="ghost" onClick={onSignOut}><Icon name="log-out" size={16} /> Se déconnecter</button>
    </Screen>
  );
}
