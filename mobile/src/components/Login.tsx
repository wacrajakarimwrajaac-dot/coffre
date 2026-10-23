import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { Button, Input, s } from './ui';

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg({ text: error.message, error: true });
    if (mode === 'up' && !data.session) setMsg({ text: 'Compte créé. Confirme ton adresse via l’email reçu, puis connecte-toi.' });
  };

  const reset = async () => {
    if (!email.trim()) return setMsg({ text: 'Entre ton email d’abord.', error: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setMsg(error ? { text: error.message, error: true } : { text: 'Email de réinitialisation envoyé.' });
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ gap: 14 }}>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: '800' }}><Text style={{ color: C.primary }}>◆</Text> Coffre</Text>
          <Text style={s.muted}>Tous tes liens, notes, vocaux, fichiers et tâches, synchronisés partout.</Text>
          <Input placeholder="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input placeholder="Mot de passe" secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChangeText={setPassword} />
          {msg && <Text style={{ color: msg.error ? C.danger : C.muted }}>{msg.text}</Text>}
          <Button title={mode === 'in' ? 'Se connecter' : 'Créer mon compte'} busy={busy}
            disabled={!email.trim() || password.length < 6} onPress={submit} />
          <Button kind="ghost" title={mode === 'in' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
            onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }} />
          {mode === 'in' && <Button kind="ghost" title="Mot de passe oublié" onPress={reset} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
