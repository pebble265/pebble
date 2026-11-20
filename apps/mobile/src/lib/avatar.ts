import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { Alert } from '../components/text';
import { api, errorText } from './api';
import { t } from './i18n';

/** Side of the square photo we keep. Small enough to send inline with the profile (~30 KB). */
const SIZE = 320;

/** Opens the photo library or the camera, lets the user crop a square, and returns a small JPEG data URL. */
async function pick(from: 'library' | 'camera'): Promise<string | null> {
  const perm =
    from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      from === 'camera' ? 'Pebble ยังไม่ได้รับอนุญาตให้ใช้กล้อง' : 'Pebble ยังไม่ได้รับอนุญาตให้เข้าถึงรูปภาพ',
      'เปิดได้ที่ การตั้งค่า → Pebble',
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.[0]) return null;

  const a = res.assets[0];
  // Centre-crop to a square (the crop screen may not run, e.g. on web), then shrink.
  const side = Math.min(a.width, a.height);
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width && a.height && a.width !== a.height) {
    ctx.crop({ originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side });
  }
  ctx.resize({ width: SIZE, height: SIZE });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

async function upload(image: string | null) {
  if (image) await api('/users/me/avatar', { method: 'POST', body: { image } });
  else await api('/users/me/avatar', { method: 'DELETE' });
}

/**
 * "Change profile photo": choose from library / take a photo / remove.
 * Calls `done` after the profile changed (reload the user there).
 */
export function changeAvatar({ hasPhoto, onBusy, done }: { hasPhoto: boolean; onBusy?: (busy: boolean) => void; done: () => unknown }) {
  const run = (from: 'library' | 'camera' | 'remove') => async () => {
    try {
      const image = from === 'remove' ? null : await pick(from);
      if (from !== 'remove' && !image) return;
      onBusy?.(true);
      await upload(image);
      await done();
    } catch (e) {
      Alert.alert('เปลี่ยนรูปไม่สำเร็จ', errorText(e));
    } finally {
      onBusy?.(false);
    }
  };

  // The web build has no action sheet: go straight to the file picker.
  if (Platform.OS === 'web') {
    if (hasPhoto && window.confirm(t('ลบรูปโปรไฟล์? (กดยกเลิกเพื่อเลือกรูปใหม่)'))) return void run('remove')();
    return void run('library')();
  }

  Alert.alert('รูปโปรไฟล์', undefined, [
    { text: 'เลือกจากคลังรูป', onPress: run('library') },
    { text: 'ถ่ายรูป', onPress: run('camera') },
    ...(hasPhoto ? [{ text: 'ลบรูป', style: 'destructive' as const, onPress: run('remove') }] : []),
    { text: 'ยกเลิก', style: 'cancel' as const },
  ]);
}
