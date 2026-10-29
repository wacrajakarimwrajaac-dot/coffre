import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { StorageBar } from '@/components/StorageBar';
import { ListRow, SectionLabel, Sheet, SheetRow, s } from '@/components/ui';
import { deleteAccount } from '@/lib/account';
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL } from '@/lib/appInfo';
import type { IconName } from '@/lib/icons';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { useTheme, type ThemePref } from '@/lib/themeProvider';
import { formatSize } from '@/lib/util';

const THEMES: [ThemePref, string, IconName][] = [['system', 'Automatique (comme le téléphone)', 'sun-moon'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']];

const lead = (name: IconName, color: string = C.muted): ReactNode => (
  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${color}1f`, alignItems: 'center', justifyContent: 'center' }}>
    <Icon name={name} size={19} color={color} />
  </View>
);

export default function Settings() {
  const st = useStore();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [email, setEmail] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [themeSheet, setThemeSheet] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
  }, []);

  const usage = st.usage;
  const themeLabel = THEMES.find(([p]) => p === theme.pref)![1].split(' (')[0];

  const confirmDelete = () =>
    Alert.alert(
      'Supprimer ton compte ?',
      'Ton compte et tout ce que Coffre garde sur ce téléphone (dossiers, notes, liens, fichiers) seront définitivement supprimés. Les copies déjà présentes dans ton Google Drive restent à toi. Cette action est irréversible.',
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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, paddingTop: insets.top + 6 }}>
      <Text style={s.h1}>Réglages</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 }}>
        <Logo size={44} withName={false} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{email}</Text>
          <Text style={s.muted}>Tes données restent sur ce téléphone</Text>
        </View>
      </View>

      {usage && (
        <View style={{ marginTop: 18, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>Espace utilisé</Text>
            <Text style={s.muted}>{formatSize(usage.usedBytes)}</Text>
          </View>
          <StorageBar usage={usage} />
          {usage.totalBytes > 0 && <Text style={s.muted}>{formatSize(usage.freeBytes)} libres sur {formatSize(usage.totalBytes)}</Text>}
        </View>
      )}

      <SectionLabel>Données</SectionLabel>
      <ListRow left={lead('hard-drive')} title="Espace de stockage" subtitle="Quel dossier utilise le plus de place" onPress={() => router.push('/storage')} />
      <ListRow left={lead('cloud')} title="Sauvegarde Google Drive" subtitle="Copie automatique dans ton Drive" onPress={() => router.push('/backup')} last />

      <SectionLabel>Apparence</SectionLabel>
      <ListRow left={lead(theme.scheme === 'light' ? 'sun' : 'moon')} title="Thème" subtitle={themeLabel} onPress={() => setThemeSheet(true)} last />

      <SectionLabel>Aide</SectionLabel>
      <ListRow left={lead('bug')} title="Signaler un problème" subtitle="Un bug, une idée, une question" onPress={() => router.push('/report')} last={!SUPPORT_EMAIL && !PRIVACY_URL} />
      {SUPPORT_EMAIL && <ListRow left={lead('mail')} title="Contacter le support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} last={!PRIVACY_URL} />}
      {PRIVACY_URL && <ListRow left={lead('shield-check')} title="Politique de confidentialité" onPress={() => Linking.openURL(PRIVACY_URL)} last />}

      <SectionLabel>Compte</SectionLabel>
      <ListRow left={lead('log-out')} title="Se déconnecter" onPress={() => supabase.auth.signOut()} />
      <ListRow left={lead('trash', C.danger)} title={busy ? 'Suppression en cours…' : 'Supprimer mon compte'} danger last onPress={busy ? undefined : confirmDelete} />

      <Text style={[s.muted, { textAlign: 'center', marginTop: 30 }]}>Coffre {APP_VERSION}</Text>

      <Sheet visible={themeSheet} onClose={() => setThemeSheet(false)} title="Thème">
        {THEMES.map(([p, label, icon]) => (
          <SheetRow key={p} icon={icon} label={label} selected={theme.pref === p} onPress={() => { setThemeSheet(false); theme.setPref(p); }} />
        ))}
      </Sheet>
    </ScrollView>
  );
}
