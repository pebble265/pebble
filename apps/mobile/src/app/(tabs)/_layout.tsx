import { Tabs } from 'expo-router/js-tabs';
import { PebbleTabBar } from '../../components/tab-bar';
import { colors } from '../../theme';

export default function TabsLayout() {
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
