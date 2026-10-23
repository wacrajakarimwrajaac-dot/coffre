import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { C } from '@/lib/theme';
import { Button, Input, s } from './ui';

const fmt = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const PRESET = { ...RecordingPresets.LOW_QUALITY, numberOfChannels: 1, bitRate: 64000 };

export function VoiceRecorder({ onSave, busy }: { onSave: (uri: string, name: string) => void; busy?: boolean }) {
  const recorder = useAudioRecorder(PRESET);
  const state = useAudioRecorderState(recorder, 250);
  const [uri, setUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [name, setName] = useState('');
  const player = useAudioPlayer(uri ?? undefined);
  const playing = useAudioPlayerStatus(player).playing;

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    return () => void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, []);

  const start = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Micro refusé', 'Autorise le micro dans les réglages du téléphone.');
    setUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setName(`Vocal du ${new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
  };

  const stop = async () => {
    setDuration(state.durationMillis);
    await recorder.stop();
    setUri(recorder.uri);
  };

  if (uri) {
    return (
      <View style={{ gap: 12 }}>
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }]}>
          <Pressable onPress={() => (playing ? player.pause() : (player.seekTo(0), player.play()))}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.primaryInk, fontSize: 18 }}>{playing ? '❚❚' : '▶'}</Text>
          </Pressable>
          <Text style={{ color: C.text }}>{fmt(duration)}</Text>
        </View>
        <Input value={name} onChangeText={setName} placeholder="Nom du vocal" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button kind="danger" title="Supprimer" onPress={() => setUri(null)} style={{ flex: 1 }} />
          <Button title="Ajouter" busy={busy} onPress={() => onSave(uri, name.trim() || 'Vocal')} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 30 }}>
      <Pressable onPress={state.isRecording ? stop : start}
        style={{ width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center',
          backgroundColor: state.isRecording ? C.danger : C.primary }}>
        <Text style={{ fontSize: 40 }}>{state.isRecording ? '■' : '🎤'}</Text>
      </Pressable>
      <Text style={{ color: C.text, fontSize: 22, fontVariant: ['tabular-nums'] }}>{fmt(state.durationMillis)}</Text>
      <Text style={s.muted}>{state.isRecording ? 'Appuie pour arrêter' : 'Appuie pour enregistrer'}</Text>
    </View>
  );
}
