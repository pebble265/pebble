import { Platform } from 'react-native';
import { Alert } from '../components/text';

export function say(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

/** "ⓘ Learn more about pebble" */
export function learnMore() {
  say(
    'pebble(a)',
    'Pebble คือหุ่นเพื่อนคู่ใจและแอปที่ช่วยเตือนกินยา คุยด้วยได้ทุกเวลา และส่งต่อความห่วงใยถึงคนที่คุณไว้ใจ\n\nPebble ไม่ใช่แพทย์ หากฉุกเฉินโทร 1669 หรือสายด่วนสุขภาพจิต 1323',
  );
}
