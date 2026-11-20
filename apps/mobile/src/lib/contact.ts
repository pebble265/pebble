import { Linking, Platform } from 'react-native';
import { Alert } from '../components/text';
import { t } from './i18n';
import Constants from 'expo-constants';

export const SUPPORT_EMAIL = 'qwerti.contact@gmail.com';

/** Opens the mail app to the pebble team, with the app version filled in. Falls back to showing the address. */
export async function contactTeam() {
  const subject = encodeURIComponent(t('ติดต่อทีม pebble'));
  const body = encodeURIComponent(`\n\n—\nPebble ${Constants.expoConfig?.version ?? ''} · ${Platform.OS} ${String(Platform.Version ?? '')}`);
  const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  try {
    // openURL directly: canOpenURL('mailto:') needs an Info.plist entry on iOS
    await Linking.openURL(url);
    return;
  } catch {
    // no mail app: show the address instead
  }
  Alert.alert('ติดต่อทีม pebble', `ส่งอีเมลมาที่ ${SUPPORT_EMAIL}`);
}
