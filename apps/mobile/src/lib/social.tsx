import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Alert } from '../components/text';
import { errorText } from './api';
import { useAuth } from './auth';

WebBrowser.maybeCompleteAuthSession();

/** OAuth client ids from Google Cloud (set in mobile/.env, see README). */
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleConfigured =
  Platform.OS === 'ios' ? !!GOOGLE_IOS_CLIENT_ID : Platform.OS === 'web' ? !!GOOGLE_WEB_CLIENT_ID : false;

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/**
 * "Sign-In with google": Google's account chooser in an in-app browser sheet,
 * then the id_token goes to our backend. Only mount when googleConfigured,
 * because the underlying hook requires a client id.
 */
export function useGoogleSignIn() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!response || handled.current === response) return;
    handled.current = response;
    if (response.type !== 'success') {
      setBusy(false);
      if (response.type === 'error') notify('Google', response.error?.message ?? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      return;
    }
    const idToken = response.params.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      setBusy(false);
      return notify('Google', 'ไม่ได้รับข้อมูลจาก Google ลองใหม่อีกครั้ง');
    }
    signInWithGoogle(idToken)
      .catch((e) => notify('Google', errorText(e)))
      .finally(() => setBusy(false));
  }, [response, signInWithGoogle]);

  async function start() {
    if (!request) return;
    setBusy(true);
    const r = await promptAsync().catch(() => null);
    if (!r || r.type !== 'success') setBusy(false);
  }

  return { start, busy: busy || !request };
}

export function googleNotConfigured() {
  notify('Sign in with Google', 'ยังไม่ได้ใส่ Google Client ID ในแอป (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ดูขั้นตอนใน README');
}
