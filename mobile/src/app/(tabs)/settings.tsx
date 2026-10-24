import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { s } from '@/components/ui';
import { deleteAccount } from '@/lib/account';
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL } from '@/lib/appInfo';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { formatSize } from '@/lib/util';

const PLAN_NAMES: Record<string, string> = { free: 'Gratuit', plus: 'Plus', premium: 'Premium' };

function Row({ icon, label, hint, onPress, danger }: { icon: string; label: string; hint?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, pressed && { backgroundColor: '#ffffff0a' }]}>
      <Text style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? C.danger : C.text, fontSize: 16 }}>{label}</Text>
        {hint ? <Text style={s.muted}>{hint}</Text> : null}
      </View>
      {!danger && <Text style={s.muted}>›</Text>}
    </Pressable>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 8 }}>
    <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }]}>{title}</Text>
    <View style={[s.card, { paddingVertical: 2 }]}>{children}</View>
  </View>
);

export default function Settings() {
  const st = useStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
  }, []);

  const usage = st.usage;
  const pct = usage ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;

  const confirmDelete = () =>
    Alert.alert(
      'Supprimer ton compte ?',
      'Tous tes dossiers, notes, liens, tâches et fichiers seront définitivement supprimés de Coffre. Les copies déjà présentes dans ton Google Drive restent à toi. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer définitivement', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
          } catch (e) {
            Alert.alert('Suppression impossible', (e as Error).message);
          } finally {
            setBusy(false);
          }
        } },
      ],
    );

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 60, paddingTop: insets.top + 8 }}>
      <Text style={s.h1}>Réglages</Text>
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Logo size={56} withName={false} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{email}</Text>
        {usage && <Text style={s.muted}>Formule {PLAN_NAMES[usage.plan] ?? usage.plan}</Text>}
      </View>

      {usage && (
        <View style={[s.card, { padding: 16, gap: 8 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.text }}>Espace utilisé</Text>
            <Text style={s.muted}>{formatSize(usage.usedBytes)} / {formatSize(usage.quotaBytes)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${pct}%`, backgroundColor: pct > 90 ? C.danger : C.ok }} />
          </View>
          <Text style={s.muted}>Taille max d’un fichier : {formatSize(usage.maxFileBytes)}</Text>
        </View>
      )}

      <Section title="Données">
        <Row icon="📊" label="Espace de stockage" hint="Quel dossier utilise le plus d’espace" onPress={() => router.push('/storage')} />
        <Row icon="☁️" label="Sauvegarde Google Drive" hint="Copie automatique dans ton Drive" onPress={() => router.push('/backup')} />
      </Section>

      <Section title="Aide">
        <Row icon="🐞" label="Signaler un problème" hint="Un bug, une idée, une question" onPress={() => router.push('/report')} />
        {SUPPORT_EMAIL && <Row icon="✉️" label="Contacter le support" hint={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />}
        {PRIVACY_URL && <Row icon="🔒" label="Politique de confidentialité" onPress={() => Linking.openURL(PRIVACY_URL)} />}
      </Section>

      <Section title="Compte">
        <Row icon="🚪" label="Se déconnecter" onPress={() => supabase.auth.signOut()} />
        <Row icon="🗑️" label={busy ? 'Suppression en cours…' : 'Supprimer mon compte'} danger onPress={busy ? () => {} : confirmDelete} />
      </Section>

      <Text style={[s.muted, { textAlign: 'center' }]}>Coffre {APP_VERSION} · tout ton sujet, au même endroit</Text>
    </ScrollView>
  );
}
