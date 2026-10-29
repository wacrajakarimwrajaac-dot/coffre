import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { PRIVACY_URL } from '@/lib/appInfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithGoogle } from '@/lib/googleAuth';
import { C } from '@/lib/theme';
import { Logo } from './Logo';
import { s } from './ui';

/** Google is the only way in: no passwords to keep, no confirmation emails to send. */
export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Logo size={48} />
        <Text style={[s.muted, { fontSize: 15, lineHeight: 22 }]}>
          Tes liens, notes, vocaux et fichiers, rangés sur ton téléphone et sauvegardés sur ton Google Drive.
        </Text>
        <Pressable onPress={google} disabled={busy}
          style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1, marginTop: 8 }}>
          <Text style={{ color: '#4285f4', fontWeight: '900', fontSize: 17 }}>G</Text>
          <Text style={{ color: '#1f1f1f', fontWeight: '600', fontSize: 17 }}>{busy ? 'Connexion…' : 'Continuer avec Google'}</Text>
        </Pressable>
        {error && <Text style={{ color: C.danger }}>{error}</Text>}
        <Text style={[s.muted, { textAlign: 'center', lineHeight: 18 }]}>
          Pour utiliser Coffre sur ton ordinateur, ouvre le site Coffre et scanne son QR code depuis Réglages → Coffre Web.
        </Text>
        {PRIVACY_URL && (
          <Text style={[s.muted, { textAlign: 'center', fontSize: 12 }]}>
            En continuant, tu acceptes la <Text style={{ color: C.primary }} onPress={() => Linking.openURL(PRIVACY_URL)}>politique de confidentialité</Text>.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
