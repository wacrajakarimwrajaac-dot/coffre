import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Input, s } from '@/components/ui';
import { APP_VERSION, deviceSummary } from '@/lib/appInfo';
import { myReports, sendReport, type Report, type ReportCategory, type ReportStatus } from '@/lib/reports';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

const CATEGORIES: [ReportCategory, string][] = [['bug', '🐞 Problème'], ['suggestion', '💡 Idée'], ['account', '👤 Compte'], ['other', '✉️ Autre']];
const STATUS: Record<ReportStatus, [string, string]> = {
  new: ['Reçu', C.muted], in_progress: ['En cours', '#f5b84b'], resolved: ['Résolu', C.ok], closed: ['Fermé', C.muted],
};

export default function ReportScreen() {
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Report[]>([]);

  const loadHistory = useCallback(() => void myReports().then(setHistory).catch(() => {}), []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
    loadHistory();
  }, [loadHistory]);

  const pickShot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled) setShot({ uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' });
  };

  const send = async () => {
    if (message.trim().length < 3) return Alert.alert('Décris le problème', 'Quelques mots suffisent.');
    setBusy(true);
    try {
      await sendReport({ category, message, contactEmail: email, screenshot: shot ?? undefined });
      setMessage('');
      setShot(null);
      loadHistory();
      Alert.alert('Merci 🙏', 'Ton signalement a bien été envoyé. Tu peux suivre son statut ici.');
    } catch (e) {
      Alert.alert('Envoi impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const info = deviceSummary();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <Stack.Screen options={{ title: 'Signaler un problème' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={s.muted}>Quelque chose ne marche pas, ou tu as une idée ? Dis-le nous, on lit chaque message.</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(([c, label]) => (
            <Pressable key={c} onPress={() => setCategory(c)}
              style={{ borderWidth: 1, borderColor: category === c ? C.primary : C.line, backgroundColor: category === c ? '#ff6b5b1f' : 'transparent',
                borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: category === c ? C.primary : C.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Input multiline value={message} onChangeText={setMessage} maxLength={5000}
          placeholder={category === 'suggestion' ? 'Ton idée…' : 'Que s’est-il passé ? Qu’est-ce que tu faisais juste avant ?'} />

        <View>
          <Text style={s.label}>Email pour te répondre (optionnel)</Text>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>

        {shot ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={shot.uri} style={{ width: 64, height: 64, borderRadius: 10 }} />
            <Button kind="ghost" title="Retirer la capture" onPress={() => setShot(null)} />
          </View>
        ) : (
          <Button kind="ghost" title="📎 Joindre une capture d’écran" onPress={pickShot} />
        )}

        <Text style={[s.muted, { fontSize: 12 }]}>Envoyé avec : {info.platform} · Coffre {APP_VERSION}</Text>
        <Button title="Envoyer" busy={busy} onPress={send} />

        {history.length > 0 && (
          <View style={{ gap: 10, marginTop: 10 }}>
            <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1 }]}>Mes signalements</Text>
            {history.map((r) => (
              <View key={r.id} style={[s.card, { padding: 14, gap: 6 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.muted}>{CATEGORIES.find(([c]) => c === r.category)?.[1]} · {new Date(r.createdAt).toLocaleDateString('fr-FR')}</Text>
                  <Text style={{ color: STATUS[r.status][1], fontWeight: '700', fontSize: 13 }}>{STATUS[r.status][0]}</Text>
                </View>
                <Text style={{ color: C.text }} numberOfLines={4}>{r.message}</Text>
                {r.adminReply ? (
                  <View style={{ backgroundColor: C.panel, borderRadius: 10, padding: 10 }}>
                    <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>Réponse de l’équipe</Text>
                    <Text style={{ color: C.text }}>{r.adminReply}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
