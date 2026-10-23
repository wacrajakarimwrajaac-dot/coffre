import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in through Supabase in the system browser (works in Expo Go and in builds).
 * The redirect URL (coffre://auth-callback, or exp://… in Expo Go) must be allowed in
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
/** Where Supabase sends the user back after Google (exp://… in Expo Go, coffre://… in builds). */
export const googleRedirectUrl = () => Linking.createURL('auth-callback');

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = googleRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message ?? 'Connexion Google impossible');

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return; // cancelled by the user

  const { queryParams } = Linking.parse(res.url);
  const fail = queryParams?.error_description ?? queryParams?.error;
  if (fail) throw new Error(String(fail));
  const code = queryParams?.code;
  if (typeof code !== 'string') throw new Error('Réponse Google invalide');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
}
