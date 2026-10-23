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

  // Tokens come back in the URL fragment (#access_token=…&refresh_token=…), or an error in the query.
  const params = new URLSearchParams((res.url.split('#')[1] ?? '') || (res.url.split('?')[1] ?? ''));
  const fail = params.get('error_description') ?? params.get('error');
  if (fail) throw new Error(fail);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Réponse Google invalide');
  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw new Error(sessionError.message);
}
