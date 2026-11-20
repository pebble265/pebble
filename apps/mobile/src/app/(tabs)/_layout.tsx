import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { watchAlarmLaunches } from '../../lib/med-alarms';
import { PebbleTabBar } from '../../components/tab-bar';
import { colors } from '../../theme';
import { useTheme } from '../../lib/theme-mode';

export default function TabsLayout() {
  useTheme();
  // Opened from a ringing medicine alarm -> today's doses.
  useEffect(() => watchAlarmLaunches(), []);

  return (
    <Tabs
      tabBar={(props) => <PebbleTabBar state={props.state} navigateToTab={props.navigateToTab} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'หน้าหลัก' }} />
      <Tabs.Screen name="meds" options={{ title: 'ยา' }} />
      <Tabs.Screen name="journal" options={{ title: 'บันทึก' }} />
      <Tabs.Screen name="chat" options={{ title: 'Pebbi' }} />
      <Tabs.Screen name="robot" options={{ title: 'pebble' }} />
      <Tabs.Screen name="me" options={{ title: 'โปรไฟล์' }} />
    </Tabs>
  );
}
