import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { GOOGLE_CLIENT_ID } from './drive';
import { supabase } from './supabase';

/** Shows the sign-in screen until the user is logged in (cloud mode only). */
export function AuthGate({ children }: { children: (email?: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <>{children()}</>;
  if (session === undefined) return <div className="auth"><p className="meta">Chargement…</p></div>;
  if (!session) return <Login />;
  return <>{children(session.user.email)}</>;
}

function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const auth = supabase!.auth;
    const { data, error } =
      mode === 'in'
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg({ text: error.message, error: true });
    if (mode === 'up' && !data.session) setMsg({ text: 'Compte créé. Confirme ton adresse via l’email reçu, puis connecte-toi.' });
  };

  const google = async () => {
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMsg({ text: error.message, error: true });
  };

  const reset = async () => {
    if (!email) return setMsg({ text: 'Entre ton email d’abord.', error: true });
    const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg(error ? { text: error.message, error: true } : { text: 'Email de réinitialisation envoyé.' });
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand"><img src="/favicon.svg" alt="" width={30} height={30} /> Coffre</div>
        <p className="meta" style={{ marginTop: -6 }}>Tout ton sujet, au même endroit.</p>
        <p className="meta">Tous tes liens, notes, fichiers et tâches, synchronisés partout.</p>
        {GOOGLE_CLIENT_ID && (
          <>
            <button type="button" className="btn-google" onClick={google}>
              <span className="g">G</span> Continuer avec Google
            </button>
            <div className="or"><span>ou</span></div>
          </>
        )}
        <input type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required minLength={6} placeholder="Mot de passe"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p className={msg.error ? 'error' : 'meta'}>{msg.text}</p>}
        <button className="btn-primary" disabled={busy}>{mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button type="button" className="btn-ghost small" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
        {mode === 'in' && <button type="button" className="btn-ghost small" onClick={reset}>Mot de passe oublié</button>}
      </form>
    </div>
  );
}
