import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Alert } from '../components/text';
import { DarkScreen, Radar, SETUP_BG } from '../components/setup';
import { bluetoothState, scanForPebble } from '../lib/robot-ble';
import { DEMO_ROBOT, type FoundRobot, robotFlow } from '../lib/robot-protocol';
import { useTheme } from '../lib/theme-mode';

/** How long to look for a real robot before showing the demo one. */
const SCAN_MS = 12_000;

/** "pebble(a) - Onboarding Finding" from Figma: Bluetooth scan for a nearby pebble(a). */
export default function ConnectFinding() {
  useTheme();
  const [scanning, setScanning] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let stopScan = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;

      const found = (robot: FoundRobot) => {
        if (cancelled) return;
        cancelled = true;
        stopScan();
        if (timer) clearTimeout(timer);
        robotFlow.found = robot;
        router.replace('/connect-found');
      };

      setScanning(true);
      bluetoothState().then((state) => {
        if (cancelled) return;
        if (state === 'on') {
          stopScan = scanForPebble(found);
          timer = setTimeout(() => found(DEMO_ROBOT), SCAN_MS);
        } else if (state === 'unsupported') {
          // Web / simulator: nothing to scan with.
          timer = setTimeout(() => found(DEMO_ROBOT), 3000);
        } else {
          setScanning(false);
          Alert.alert(
            state === 'off' ? 'เปิด Bluetooth ก่อนนะ' : 'Pebble ยังไม่ได้รับอนุญาตให้ใช้ Bluetooth',
            state === 'off'
              ? 'เปิด Bluetooth ใน Control Center แล้วกลับมาที่หน้านี้'
              : 'ไปที่ Settings แล้วเปิด Bluetooth ให้ Pebble เพื่อค้นหาหุ่น',
            [
              { text: 'ใช้หุ่นเดโมไปก่อน', onPress: () => found(DEMO_ROBOT) },
              ...(state === 'unauthorized' && Platform.OS !== 'web'
                ? [{ text: 'เปิด Settings', onPress: () => Linking.openSettings() }]
                : []),
              { text: 'ลองอีกครั้ง', onPress: () => router.replace('/connect-finding') },
            ],
          );
        }
      });

      return () => {
        cancelled = true;
        stopScan();
        if (timer) clearTimeout(timer);
      };
    }, []),
  );

  return (
    <DarkScreen bg={SETUP_BG.finding}>
      <Radar active={scanning} />
    </DarkScreen>
  );
}
