import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme';

/** Height the screens should leave free at the bottom so content isn't hidden under the bar. */
export const TAB_BAR_SPACE = 110;

/** True while the on-screen keyboard is up (the bar hides so inputs aren't covered). */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

type Item = { route: string; label: string; icon(active: boolean): ReactNode };

const ITEMS: Item[] = [
  {
    route: 'meds',
    label: 'ยา',
    icon: (a) => <MaterialCommunityIcons name={a ? 'pill' : 'pill'} size={22} color={a ? colors.blue : colors.text} />,
  },
  {
    route: 'journal',
    label: 'บันทึก',
    icon: (a) => <Ionicons name={a ? 'journal' : 'journal-outline'} size={21} color={a ? colors.blue : colors.text} />,
  },
  {
    route: 'chat',
    label: 'Pebbi',
    icon: (a) => <MaterialCommunityIcons name="star-four-points" size={20} color={a ? colors.blue : colors.text} />,
  },
  {
    route: 'robot',
    label: 'pebble',
    icon: (a) => <MaterialCommunityIcons name={a ? 'robot' : 'robot-outline'} size={22} color={a ? colors.blue : colors.text} />,
  },
  {
    route: 'me',
    label: 'โปรไฟล์',
    icon: (a) => <Ionicons name={a ? 'person' : 'person-outline'} size={21} color={a ? colors.blue : colors.text} />,
  },
];

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab(routeKey: string): void;
};

/**
 * The floating bar from the Figma Home screen: a frosted pill with five tabs
 * and a separate round red Home button on the right.
 */
export function PebbleTabBar({ state, navigateToTab }: Props) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const keyboard = useKeyboardVisible();
  if (keyboard) return null;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {ITEMS.map((it) => {
          const active = current === it.route;
          return (
            <Pressable
              key={it.route}
              onPress={() => go(it.route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={it.label}
              style={styles.item}>
              {it.icon(active)}
              <Text style={[styles.label, active && { color: colors.blue, fontWeight: '700' }]} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => go('index')}
        accessibilityRole="tab"
        accessibilityState={{ selected: current === 'index' }}
        accessibilityLabel="หน้าหลัก"
        style={({ pressed }) => [styles.home, pressed && { transform: [{ scale: 0.96 }] }]}>
        <Ionicons name={current === 'index' ? 'home' : 'home-outline'} size={28} color={colors.red} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: shadow.float,
    paddingHorizontal: 6,
    alignItems: 'center',
    maxWidth: 520,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontSize: 10, color: colors.text },
  home: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.float,
  },
});
