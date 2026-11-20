import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, LayoutAnimation, PanResponder, Platform, View, StyleSheet } from 'react-native';
import { Text } from './text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, isDark, shadow, themedStyles } from '../theme';
import { getLang } from '../lib/i18n';
import { useTheme } from '../lib/theme-mode';

/** Height the screens should leave free at the bottom so content isn't hidden under the bar. */
export const TAB_BAR_SPACE = 110;
/** Exact height the floating bar takes on this phone (pill + its padding + home indicator). */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return 8 + 66 + Math.max(insets.bottom, 12);
}

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

type Item = { route: string; label: string; en?: string; icon(active: boolean): ReactNode; big(): ReactNode };

/** Every tab in its fixed order. The open one sits in the big round button; the rest stay in the pill. */
const ITEMS: Item[] = [
  {
    route: 'index',
    label: 'หน้าหลัก',
    icon: (a) => <Ionicons name={a ? 'home' : 'home-outline'} size={21} color={a ? colors.blue : colors.text} />,
    big: () => <Ionicons name="home" size={28} color={colors.red} />,
  },
  {
    route: 'meds',
    label: 'ยา',
    icon: (a) => <MaterialCommunityIcons name="pill" size={22} color={a ? colors.blue : colors.text} />,
    big: () => <MaterialCommunityIcons name="pill" size={30} color={colors.red} />,
  },
  {
    route: 'journal',
    label: 'บันทึก',
    en: 'Journal',
    icon: (a) => <Ionicons name={a ? 'journal' : 'journal-outline'} size={21} color={a ? colors.blue : colors.text} />,
    big: () => <Ionicons name="journal" size={27} color={colors.red} />,
  },
  {
    route: 'chat',
    label: 'Pebbi',
    icon: (a) => <MaterialCommunityIcons name="star-four-points" size={20} color={a ? colors.blue : colors.text} />,
    big: () => <MaterialCommunityIcons name="star-four-points" size={28} color={colors.red} />,
  },
  {
    route: 'robot',
    label: 'pebble',
    icon: (a) => <MaterialCommunityIcons name={a ? 'robot' : 'robot-outline'} size={22} color={a ? colors.blue : colors.text} />,
    big: () => <MaterialCommunityIcons name="robot" size={30} color={colors.red} />,
  },
  {
    route: 'me',
    label: 'โปรไฟล์',
    icon: (a) => <Ionicons name={a ? 'person' : 'person-outline'} size={21} color={a ? colors.blue : colors.text} />,
    big: () => <Ionicons name="person" size={27} color={colors.red} />,
  },
];

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab(routeKey: string): void;
};

/** iOS 26+: real Liquid Glass. Elsewhere (older iOS, Android, web) the frosted look below. */
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();
const PILL_PAD = 6;
/** the round glass lens that follows a held finger */
const LENS = 64;
/** lighter than the frosted bar's shadow, so the glass edge does the work */
const LIQUID_SHADOW = '0px 8px 24px rgba(20, 20, 40, 0.12)';
/** Hold this long on the pill, then slide the finger to pick a tab (like the iOS 26 tab bar). */
const HOLD_MS = 250;

/**
 * A glass surface: Liquid Glass when the phone has it, a frosted view otherwise.
 * The glass fills its parent; a soft shadow sits under it so it lifts off white pages like Apple's bar.
 */
function Glass({ radius, clear }: { radius: number; clear?: boolean }) {
  if (LIQUID) {
    return (
      <>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: clear ? shadow.soft : LIQUID_SHADOW }]} />
        {/* "clear" glass for the bar too: "regular" looks like a flat grey pill over a plain page.
            No isInteractive: with it the glass never got installed and the bar showed as a plain white pill. */}
        <GlassView
          pointerEvents="none"
          glassEffectStyle="clear"
          tintColor={clear ? undefined : isDark() ? 'rgba(20,20,24,0.35)' : 'rgba(255,255,255,0.28)'}
          colorScheme={isDark() ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      </>
    );
  }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, clear ? styles.frostedLens : styles.frosted]} />;
}

/**
 * The floating bar from the Figma Home screen: a glass pill and a big round
 * button on the right. The round button always shows the open tab (Home at
 * first); the pill holds the other five in their fixed order.
 * Tap a tab to open it, or press and hold: a round glass lens appears under the finger,
 * slide it across the pill and let go on the tab you want.
 */
export function PebbleTabBar({ state, navigateToTab }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const keyboard = useKeyboardVisible();
  const active = ITEMS.find((it) => it.route === current) ?? ITEMS[0];
  const others = ITEMS.filter((it) => it !== active);

  const [pillW, setPillW] = useState(0);
  const [hover, setHover] = useState<number | null>(null); // tab under the finger while dragging
  const lensX = useRef(new Animated.Value(0)).current; // lens centre
  const lensOn = useRef(new Animated.Value(0)).current;

  // Latest values for the touch handlers (they are created once).
  const live = useRef({ pillW, others, current });
  live.current = { pillW, others, current };

  const go = (name: string) => {
    if (name === live.current.current) return;
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    // The picked tab slides into the round button, the previous one slides back to its slot.
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    navigateToTab(route.key);
  };
  const goRef = useRef(go);
  goRef.current = go;

  const pan = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let startX = 0;
    const itemW = () => (live.current.pillW - PILL_PAD * 2) / 5;
    const indexAt = (x: number) => Math.max(0, Math.min(4, Math.floor((x - PILL_PAD) / itemW())));
    const centreOf = (i: number) => PILL_PAD + itemW() * (i + 0.5);
    // the lens follows the finger, but stays over the pill
    const clampX = (x: number) => Math.max(centreOf(0), Math.min(centreOf(4), x));
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => !dragging,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.locationX;
        dragging = false;
        stop();
        timer = setTimeout(() => {
          // Long press: the lens grows out of the tab under the finger.
          dragging = true;
          const i = indexAt(startX);
          lensX.setValue(centreOf(i));
          setHover(i);
          Animated.parallel([
            Animated.spring(lensOn, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 9 }),
            Animated.spring(lensX, { toValue: clampX(startX), useNativeDriver: true, speed: 30, bounciness: 0 }),
          ]).start();
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, g) => {
        const x = startX + g.dx;
        if (!dragging) {
          if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) stop(); // moved before the hold: not a tab press
          return;
        }
        lensX.setValue(clampX(x));
        const i = indexAt(x);
        setHover((h) => (h === i ? h : i));
      },
      onPanResponderRelease: (_e, g) => {
        const x = startX + g.dx;
        const wasHold = dragging;
        const moved = Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10;
        stop();
        dragging = false;
        const i = indexAt(x);
        const pick = live.current.others[i];
        if (wasHold) {
          // the lens settles on the chosen tab, then shrinks away
          Animated.sequence([
            Animated.spring(lensX, { toValue: centreOf(i), useNativeDriver: true, speed: 40, bounciness: 6 }),
            Animated.timing(lensOn, { toValue: 0, duration: 160, useNativeDriver: true }),
          ]).start(() => setHover(null));
          // Let go well above or below the bar: cancel.
          if (pick && Math.abs(g.dy) < 70) goRef.current(pick.route);
        } else if (!moved && pick) {
          goRef.current(pick.route); // plain tap
        }
      },
      onPanResponderTerminate: () => {
        stop();
        dragging = false;
        setHover(null);
        lensOn.setValue(0);
      },
    });
  }, [lensOn, lensX]);

  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill} onLayout={(e) => setPillW(e.nativeEvent.layout.width)}>
        <Glass radius={33} />
        {/* the round lens under the held tab, a little bigger than the bar like iOS's */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lens,
            {
              opacity: lensOn,
              transform: [
                { translateX: Animated.subtract(lensX, LENS / 2) },
                { scale: lensOn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.08] }) },
              ],
            },
          ]}>
          <Glass radius={LENS / 2} clear />
        </Animated.View>
        <View style={styles.pillRow}>
          {others.map((it, i) => (
            <View
              key={it.route}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: false }}
              accessibilityLabel={it.label}
              onAccessibilityTap={() => go(it.route)}
              style={styles.item}>
              {it.icon(hover === i)}
              <Text style={[styles.label, hover === i && { color: colors.blue }]} numberOfLines={1}>
                {getLang() === 'en' && it.en ? it.en : it.label}
              </Text>
            </View>
          ))}
        </View>
        {/* one touch layer over the whole pill: tap, or hold and slide */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
      </View>
      <View
        key={active.route}
        accessible
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        accessibilityLabel={active.label}
        style={styles.home}>
        <Glass radius={33} />
        {active.big()}
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
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
    height: 66,
    maxWidth: 520,
  },
  pillRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: PILL_PAD },
  /** pre-iOS 26: the frosted look */
  frosted: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glass,
    boxShadow: shadow.float,
  },
  frostedLens: {
    backgroundColor: isDark() ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: isDark() ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.95)',
    boxShadow: isDark() ? '0 6px 18px rgba(0,0,0,0.45)' : '0 6px 18px rgba(20,20,40,0.18), inset 0 1px 2px rgba(255,255,255,0.9)',
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: (66 - LENS) / 2,
    width: LENS,
    height: LENS,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontSize: 10, color: colors.text },
  home: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
