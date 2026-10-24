import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { Button, Sheet, SheetRow, s } from '@/components/ui';
import {
  accountEmail, backupToDrive, latestBackupDate, loadSettings, restoreFromDrive, saveSettings,
  type DriveSettings, type Frequency,
} from '@/lib/drive';
import {
  DRIVE_CONFIGURED, disconnectDrive, hasDriveAccount, startDeviceFlow, waitForDeviceAuthorization, type DeviceCode,
} from '@/lib/driveAuth';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatDue } from '@/lib/util';

const FREQ: Record<Frequency, string> = {
  off: 'Jamais (seulement quand je le demande)',
  daily: 'Quotidienne (à l’ouverture de l’app)',
  weekly: 'Hebdomadaire (à l’ouverture de l’app)',
};

export default function Backup() {
  const st = useStore();
  const [settings, setSettings] = useState<DriveSettings>({ frequency: 'off' });
  const [connected, setConnected] = useState(false);
  const [driveDate, setDriveDate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [freqSheet, setFreqSheet] = useState(false);
  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    const [cfg, has] = await Promise.all([loadSettings(), hasDriveAccount()]);
    setSettings(cfg);
    setConnected(has && !!cfg.email);
    if (has && cfg.email) latestBackupDate().then(setDriveDate).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    return () => { cancelled.current = true; };
  }, [refresh]);

  const update = async (patch: Partial<DriveSettings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
  };

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await fn() });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      cancelled.current = false;
      const dc = await startDeviceFlow();
      setCode(dc);
      await Clipboard.setStringAsync(dc.userCode).catch(() => {});
      Linking.openURL(`${dc.verificationUrl}?user_code=${encodeURIComponent(dc.userCode)}`).catch(() => {});
      try {
        await waitForDeviceAuthorization(dc, () => cancelled.current);
      } finally {
        setCode(null);
      }
      const email = await accountEmail();
      await update({ email, frequency: settings.frequency === 'off' ? 'daily' : settings.frequency, lastError: undefined });
      await refresh();
      return `Connecté à ${email}`;
    });

  const backupNow = () =>
    run(async () => {
      const { uploaded } = await backupToDrive((t) => setStatus({ text: t }));
      const now = Date.now();
      await update({ lastBackupAt: now, lastError: undefined });
      setDriveDate(now);
      return `Sauvegarde terminée${uploaded ? ` · ${uploaded} nouveau(x) fichier(s) envoyé(s)` : ''}`;
    });

  const restore = () =>
    Alert.alert('Restaurer la sauvegarde ?', 'Les éléments sauvegardés seront ajoutés ou remis à jour dans ce compte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Restaurer', onPress: () => run(async () => {
        const { items } = await restoreFromDrive((t) => setStatus({ text: t }));
        await st.reload();
        return `${items} élément(s) restauré(s)`;
      }) },
    ]);

  const disconnect = () =>
    Alert.alert('Déconnecter Google Drive ?', 'Les sauvegardes déjà présentes dans ton Drive sont conservées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await disconnectDrive();
        await update({ email: undefined, frequency: 'off' });
        setDriveDate(null);
        await refresh();
      } },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 50 }}>
      <Stack.Screen options={{ title: 'Sauvegarde Google Drive' }} />
      <Text style={s.muted}>
        Comme WhatsApp : tes dossiers, notes, liens, tâches et fichiers (photos, vidéos, vocaux, documents) sont copiés dans un
        dossier « Coffre » de ton Google Drive. Seuls les nouveaux fichiers sont envoyés à chaque fois.
      </Text>

      {!DRIVE_CONFIGURED ? (
        <Text style={{ color: C.danger }}>Google Drive n’est pas encore configuré dans cette version de l’app.</Text>
      ) : code ? (
        <View style={[s.card, { padding: 18, gap: 12, alignItems: 'center' }]}>
          <Text style={s.muted}>Sur la page Google qui vient de s’ouvrir, entre ce code puis choisis ton compte :</Text>
          <Text selectable style={{ color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: 4 }}>{code.userCode}</Text>
          <Text style={s.muted}>Le code est copié. En attente de ta confirmation…</Text>
          <Button kind="ghost" title="Rouvrir la page Google" onPress={() => Linking.openURL(`${code.verificationUrl}?user_code=${encodeURIComponent(code.userCode)}`)} />
          <Button kind="ghost" title="Annuler" onPress={() => { cancelled.current = true; setCode(null); }} />
        </View>
      ) : !connected ? (
        <Button title="Connecter mon compte Google" busy={busy} onPress={connect} />
      ) : (
        <>
          <View style={[s.card, { padding: 14, gap: 4 }]}>
            <Text style={s.muted}>Compte Google</Text>
            <Text style={{ color: C.text, fontSize: 16 }}>{settings.email}</Text>
          </View>

          <View style={[s.card, { padding: 14, gap: 4 }]}>
            <Text style={s.muted}>Sauvegarde automatique</Text>
            <Text onPress={() => setFreqSheet(true)} style={{ color: C.primary, fontSize: 16 }}>{FREQ[settings.frequency]}  ›</Text>
          </View>

          <Text style={s.muted}>
            Dernière sauvegarde : {driveDate ? formatDue(driveDate) : settings.lastBackupAt ? formatDue(settings.lastBackupAt) : 'jamais'}
          </Text>
          {settings.lastError ? <Text style={{ color: C.danger }}>Dernier essai automatique : {settings.lastError}</Text> : null}

          <Button title="Sauvegarder maintenant" busy={busy} onPress={backupNow} />
          <Button kind="ghost" title="Restaurer depuis Google Drive" disabled={busy} onPress={restore} />
          <Button kind="danger" title="Déconnecter Google Drive" disabled={busy} onPress={disconnect} />
        </>
      )}

      {status && <Text style={{ color: status.error ? C.danger : C.muted }}>{status.text}</Text>}

      <Sheet visible={freqSheet} onClose={() => setFreqSheet(false)}>
        {(Object.keys(FREQ) as Frequency[]).map((f) => (
          <SheetRow key={f} selected={settings.frequency === f} label={FREQ[f]}
            onPress={() => { setFreqSheet(false); update({ frequency: f }); }} />
        ))}
      </Sheet>
    </ScrollView>
  );
}
