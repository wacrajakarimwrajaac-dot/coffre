import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, ListRow, SectionLabel, s } from '@/components/ui';
import { describe } from '@/lib/link/access';
import { useLink } from '@/lib/link/phone';
import { C } from '@/lib/theme';

const when = (ts?: number) =>
  ts ? new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais';

/** "Coffre Web": the websites linked to this phone, like WhatsApp's linked devices. */
export default function LinkedDevices() {
  const { devices, access, refreshAccess, unlink } = useLink();
  useEffect(() => void refreshAccess(), [refreshAccess]);
  const { code } = useLocalSearchParams<{ code?: string }>();

  const confirmUnlink = (id: string, name: string) =>
    Alert.alert(`Déconnecter ${name} ?`, 'Ce navigateur n’aura plus accès à ton Coffre. Tu pourras le reconnecter en scannant un nouveau QR code.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => void unlink(id) },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
      <Stack.Screen options={{ title: 'Coffre Web' }} />

      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${C.primary}1f`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="monitor-smartphone" size={30} color={C.primary} />
        </View>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Ton Coffre sur l’ordinateur</Text>
        <Text style={[s.muted, { textAlign: 'center', lineHeight: 20 }]}>
          Ouvre Coffre sur ton ordinateur et scanne le QR code affiché. L’ordinateur garde sa propre copie de ton Coffre ;
          quand tu appuies sur « Synchroniser » là-bas, les deux se mettent à jour (Coffre doit être ouvert ici). Tout est chiffré de bout en bout.
        </Text>
      </View>

      {code ? (
        <View style={[s.card, { padding: 16, gap: 6, marginBottom: 6 }]}>
          <Text style={{ color: C.text, fontWeight: '700' }}>Appareil connecté</Text>
          <Text style={s.muted}>Vérifie que le site affiche le même code : <Text style={{ color: C.text, fontWeight: '700' }}>{code}</Text></Text>
        </View>
      ) : null}

      {access && (
        <View style={[s.card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }]}>
          <Icon name={access.active ? 'circle-check' : 'clock'} size={20} color={access.active ? C.ok : C.warn} />
          <Text style={{ color: C.text, flex: 1 }}>{describe(access)}</Text>
        </View>
      )}

      <Button title="Connecter un appareil" disabled={!!access && !access.active} onPress={() => router.push('/link/scan')} />

      <SectionLabel>Appareils connectés</SectionLabel>
      {devices.length === 0 ? (
        <Text style={s.muted}>Aucun pour l’instant.</Text>
      ) : (
        [...devices].sort((a, b) => b.linkedAt - a.linkedAt).map((d, i, arr) => (
          <ListRow key={d.id} title={d.name} subtitle={`Dernière synchronisation : ${when(d.lastSeen)}`} last={i === arr.length - 1}
            left={<Icon name="laptop" size={22} color={C.muted} />}
            right={<Text style={{ color: C.danger, fontWeight: '600' }}>Déconnecter</Text>}
            onPress={() => confirmUnlink(d.id, d.name)} />
        ))
      )}
    </ScrollView>
  );
}
