import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { Alert } from '../components/text';
import { DarkScreen, GradientText, HitArea, SETUP_BG } from '../components/setup';
import { say } from '../lib/about';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { readPairCode } from '../lib/robot-ble';
import { robotFlow } from '../lib/robot-protocol';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Onboarding Conected" from Figma: We had found pebble(a) near you — Is This Yours? */
export default function ConnectFound() {
  useTheme();
  const { reloadUser } = useAuth();
  const robot = robotFlow.found;
  const [busy, setBusy] = useState(false);

  async function finish(run: () => Promise<unknown>) {
    setBusy(true);
    try {
      await run();
      robotFlow.found = null;
      await reloadUser(); // robotSetupAt is set -> the app opens Home
    } catch (e) {
      say('pebble(a)', e instanceof Error && !('status' in e) ? 'ต่อกับหุ่นไม่สำเร็จ ลองเข้าไปใกล้หุ่นอีกนิดแล้วลองใหม่' : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const skip = () => api('/users/me/robot-setup', { method: 'POST', body: { skipped: true } });
  const pairWith = (code: string, serialNumber?: string) =>
    api('/devices/pair', { method: 'POST', body: { code, ...(serialNumber && { serialNumber }) } });

  function yes() {
    if (!robot || robot.demo) return finish(skip); // no real robot yet: finish setup, pair later
    return finish(async () => pairWith(await readPairCode(robot.deviceId), robot.info.serial));
  }

  function trouble() {
    const byCode = () => {
      if (Platform.OS !== 'ios') {
        const code = Platform.OS === 'web' ? window.prompt('รหัส 6 หลักบนจอหุ่น') : null;
        if (code) finish(() => pairWith(code.trim()));
        return;
      }
      Alert.prompt('ใส่รหัสจากจอหุ่น', 'กดปุ่มบนหุ่นให้แสดงรหัส 6 หลัก แล้วพิมพ์ที่นี่', (code) => {
        if (code) finish(() => pairWith(code.trim()));
      }, 'plain-text', '', 'number-pad');
    };
    if (Platform.OS === 'web') return byCode();
    Alert.alert('เชื่อมต่อไม่ได้?', 'ลองเปิด Bluetooth และวางโทรศัพท์ไว้ใกล้หุ่น หรือใช้รหัส 6 หลักที่แสดงบนจอหุ่นแทน', [
      { text: 'ใส่รหัส 6 หลัก', onPress: byCode },
      { text: 'ข้ามไปก่อน', onPress: () => finish(skip) },
      { text: 'ปิด', style: 'cancel' },
    ]);
  }

  const subtitle = robot ? [robot.info.model, robot.info.color].filter(Boolean).join(', ') : '';

  return (
    <DarkScreen bg={SETUP_BG.found}>
      <GradientText left={180} top={383} width={200} size={14}>
        {subtitle}
      </GradientText>

      {/* both buttons and the link are drawn in the background */}
      <HitArea left={75} top={594} width={240} height={53} label="Yes, and connected" onPress={yes} disabled={busy}>
        {busy && <ActivityIndicator color="#FFF" style={{ position: 'absolute', right: 16 }} />}
      </HitArea>
      <HitArea left={75} top={657} width={240} height={53} label="No, Find again" onPress={() => router.replace('/connect-finding')} disabled={busy} />
      <HitArea left={100} top={735} width={200} height={26} label="have a trouble with connecting?" onPress={trouble} disabled={busy} />
    </DarkScreen>
  );
}
