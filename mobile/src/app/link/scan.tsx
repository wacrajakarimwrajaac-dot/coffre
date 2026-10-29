import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, s } from '@/components/ui';
import { useLink } from '@/lib/link/phone';
import { C } from '@/lib/theme';

/** Scans the QR code shown by the Coffre website. */
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const { pair } = useLink();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const onScanned = async (data: string) => {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    setError(null);
    try {
      const code = await pair(data);
      router.replace({ pathname: '/link', params: { code } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setTimeout(() => (handled.current = false), 1500);
    }
  };

  if (!permission) return <View style={s.screen} />;
  if (!permission.granted) {
    return (
      <View style={[s.screen, { padding: 24, justifyContent: 'center', gap: 16 }]}>
        <Stack.Screen options={{ title: 'Scanner le QR code' }} />
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>Coffre a besoin de la caméra pour scanner le QR code du site.</Text>
        <Button title="Autoriser la caméra" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ title: 'Scanner le QR code' }} />
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : ({ data }) => void onScanned(data)} />
      <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: '#ffffffcc' }} />
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 40, backgroundColor: '#000000aa', borderRadius: 16, padding: 16, gap: 6 }}>
        {busy ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff' }}>Connexion au site…</Text>
          </View>
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center' }}>Vise le QR code affiché sur le site Coffre, sur ton ordinateur.</Text>
        )}
        {error && <Text style={{ color: '#ff8a80', textAlign: 'center' }}>{error}</Text>}
      </View>
    </View>
  );
}
