import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { IconName } from '../../components/ui';
import { colors } from '../../theme';

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : name} color={typeof color === 'string' ? color : colors.muted} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'วันนี้', tabBarIcon: icon('sunny-outline', 'sunny') }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'คุยกับ Pebble', tabBarIcon: icon('chatbubble-ellipses-outline', 'chatbubble-ellipses') }}
      />
      <Tabs.Screen
        name="meds"
        options={{ title: 'ยาของฉัน', tabBarIcon: icon('medkit-outline', 'medkit') }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: 'ฉัน', tabBarIcon: icon('person-circle-outline', 'person-circle') }}
      />
    </Tabs>
  );
}
