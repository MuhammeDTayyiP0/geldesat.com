import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { confirm } from '@/ui/dialogs';

export type PickedPhoto = { uri: string; width: number; height: number; mimeType?: string | null; fileName?: string | null };

/** Long edge we upload; the site re-encodes to its own sizes, so more only costs data. */
const MAX_EDGE = 2048;

async function ensurePermission(kind: 'camera' | 'library'): Promise<boolean> {
  const current = kind === 'camera' ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const next = kind === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (next.granted) return true;
  }
  const open = await confirm({
    title: kind === 'camera' ? 'Kamera izni gerekli' : 'Galeri izni gerekli',
    message: 'Fotoğraf ekleyebilmek için ayarlardan GeldeSat’a izin verin.',
    confirmText: 'Ayarları aç',
  });
  if (open) void Linking.openSettings();
  return false;
}

/** Pick up to `limit` photos from the library, or take one with the camera. */
export async function pickPhotos(source: 'camera' | 'library', limit: number): Promise<PickedPhoto[]> {
  if (limit < 1) return [];
  if (!(await ensurePermission(source))) return [];
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    ...(source === 'library' ? { allowsMultipleSelection: limit > 1, selectionLimit: limit, orderedSelection: true } : {}),
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((a) => ({ uri: a.uri, width: a.width, height: a.height, mimeType: a.mimeType, fileName: a.fileName }));
}

/** Shrink very large photos to JPEG before upload so it is quick on mobile data. */
export async function preparePhoto(photo: PickedPhoto): Promise<{ uri: string; mimeType: string; fileName: string }> {
  const longEdge = Math.max(photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri);
  if (longEdge > MAX_EDGE) {
    context.resize(photo.width >= photo.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, mimeType: 'image/jpeg', fileName: `foto-${Date.now()}.jpg` };
}
