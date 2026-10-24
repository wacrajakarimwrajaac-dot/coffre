import type { Session } from '@supabase/supabase-js';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Login } from '@/components/Login';
import { SHARE_AVAILABLE } from '@/lib/share';
import { StoreProvider } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

/** Opens the "Enregistrer dans Coffre" screen when something is shared to the app (once signed in). */
function ShareRouter() {
  const { hasShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (hasShareIntent) router.push('/share');
  }, [hasShareIntent]);
  return null;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <ShareIntentProvider options={{ disabled: !SHARE_AVAILABLE, resetOnBackground: false }}>
    <SafeAreaProvider>
      <StatusBar style="light" />
      {session === undefined ? (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : !session ? (
        <Login />
      ) : (
        <StoreProvider key={session.user.id}>
          <ShareRouter />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: C.bg },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Ajouter' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal', title: 'Enregistrer dans Coffre' }} />
          </Stack>
        </StoreProvider>
      )}
    </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
