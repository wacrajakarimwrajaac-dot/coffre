import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { addFile } from '@/lib/data';
import { uid } from '@/lib/util';
import { Sheet, SheetRow } from './ui';

type Picked = { uri: string; name: string; mime: string; size?: number };

/** "+" menu of a folder: text items open the add screen, media/documents are picked and uploaded here. */
export function AddSheet(p: {
  visible: boolean; folderId: string; onClose: () => void; onUploading: (n: number) => void; onDone: () => void;
}) {
  const go = (type: string) => {
    p.onClose();
    router.push({ pathname: '/add', params: { type, folder: p.folderId } });
  };

  const upload = async (files: Picked[]) => {
    if (!files.length) return;
    p.onUploading(files.length);
    const errors: string[] = [];
    for (const f of files) {
      try {
        await addFile(p.folderId, f, uid());
      } catch (e) {
        errors.push(`${f.name} : ${(e as Error).message}`);
      }
    }
    p.onUploading(0);
    p.onDone();
    if (errors.length) Alert.alert('Certains fichiers n’ont pas été ajoutés', errors.join('\n'));
  };

  const fromLibrary = async (camera: boolean) => {
    p.onClose();
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Appareil photo refusé', 'Autorise l’appareil photo dans les réglages.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.85 };
    const res = camera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 20 });
    if (res.canceled) return;
    await upload(res.assets.map((a) => {
      const video = a.type === 'video';
      const ext = video ? 'mp4' : 'jpg';
      return {
        uri: a.uri, size: a.fileSize,
        name: a.fileName ?? `${video ? 'Vidéo' : 'Photo'} ${new Date().toLocaleString('fr-FR').replace(/[/:]/g, '-')}.${ext}`,
        mime: a.mimeType ?? (video ? 'video/mp4' : 'image/jpeg'),
      };
    }));
  };

  const fromFiles = async () => {
    p.onClose();
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    await upload(res.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size, mime: a.mimeType ?? 'application/octet-stream' })));
  };

  return (
    <Sheet visible={p.visible} onClose={p.onClose}>
      <SheetRow icon="link" label="Lien (Instagram, Facebook, YouTube…)" onPress={() => go('link')} />
      <SheetRow icon="file-text" label="Note" onPress={() => go('note')} />
      <SheetRow icon="mic" label="Vocal" onPress={() => go('voice')} />
      <SheetRow icon="images" label="Photos et vidéos" onPress={() => fromLibrary(false)} />
      <SheetRow icon="camera" label="Prendre une photo ou vidéo" onPress={() => fromLibrary(true)} />
      <SheetRow icon="file" label="Document" onPress={fromFiles} />
    </Sheet>
  );
}
