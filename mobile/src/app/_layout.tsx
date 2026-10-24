import type { Session } from '@supabase/supabase-js';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AutoBackup } from '@/components/AutoBackup';
import { Login } from '@/components/Login';
import { sendReport } from '@/lib/reports';
import { SHARE_AVAILABLE } from '@/lib/share';
import { HabitsProvider } from '@/lib/habitsStore';
import { StoreProvider } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { ThemeProvider, useTheme } from '@/lib/themeProvider';

/** Shown instead of a blank screen if something crashes: retry, or send the error to us in one tap. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const report = async () => {
    setSent('sending');
    try {
      await sendReport({ category: 'bug', message: `Plantage : ${error.message}\n\n${(error.stack ?? '').slice(0, 2000)}` });
      setSent('sent');
    } catch {
      setSent('failed');
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24, gap: 14 }}>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>Oups, un problème est survenu</Text>
      <Text style={{ color: C.muted }}>{error.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
        <Text style={{ color: C.primaryInk, fontWeight: '700' }}>Réessayer</Text>
      </Pressable>
      <Pressable onPress={report} disabled={sent !== 'idle' && sent !== 'failed'} style={{ padding: 14, alignItems: 'center' }}>
        <Text style={{ color: C.text }}>
          {sent === 'sent' ? 'Signalement envoyé, merci' : sent === 'sending' ? 'Envoi…' : sent === 'failed' ? 'Échec, réessayer l’envoi' : 'Signaler ce problème'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Opens the "Enregistrer dans Coffre" screen when something is shared to the app (once signed in). */
function ShareRouter() {
  const { hasShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (hasShareIntent) router.push('/share');
  }, [hasShareIntent]);
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const { scheme } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <ShareIntentProvider options={{ disabled: !SHARE_AVAILABLE, resetOnBackground: false }}>
    <SafeAreaProvider>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      {session === undefined ? (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : !session ? (
        <Login />
      ) : (
        <StoreProvider key={session.user.id}>
          <HabitsProvider>
          <ShareRouter />
          <AutoBackup />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontSize: 16, fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: C.bg },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Ajouter' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal', title: 'Enregistrer dans Coffre' }} />
            <Stack.Screen name="report" options={{ presentation: 'modal' }} />
            <Stack.Screen name="discipline/new" options={{ presentation: 'modal' }} />
          </Stack>
          </HabitsProvider>
        </StoreProvider>
      )}
    </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
