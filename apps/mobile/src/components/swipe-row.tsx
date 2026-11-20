import Ionicons from '@expo/vector-icons/Ionicons';
import { type PropsWithChildren, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';

const OPEN = -64; // how far the card slides left to show the trash buttons

/**
 * Swipe a medicine to the left to show red trash buttons on the right
 * (Figma "Med Edit"). Tap anywhere on the card or swipe back to close.
 * One trash button lines up with the medicine pill (top `headerHeight` px),
 * one with the times card below it, like the design.
 */
export function SwipeToDelete({
  children,
  onDelete,
  label,
  headerHeight = 54,
  gap = 8,
}: PropsWithChildren<{ onDelete(): void; label: string; headerHeight?: number; gap?: number }>) {
  const [h, setH] = useState(0);
  const rows = h ? [headerHeight / 2, (headerHeight + gap + h) / 2] : [];
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const settle = (to: number) => {
    open.current = to !== 0;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 4, speed: 16 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // only take clearly sideways drags, so the page still scrolls up and down
      // (capture: take it over from the buttons inside once the drag is clearly horizontal)
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const base = open.current ? OPEN : 0;
        x.setValue(Math.max(OPEN * 1.4, Math.min(0, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const base = open.current ? OPEN : 0;
        const end = base + g.dx;
        settle(end < OPEN / 2 || g.vx < -0.4 ? OPEN : 0);
      },
      onPanResponderTerminate: () => settle(open.current ? OPEN : 0),
    }),
  ).current;

  return (
    <View onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {/* trash buttons sit behind, on the right */}
      {rows.map((cy, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            right: 6,
            top: cy - 13,
            opacity: x.interpolate({ inputRange: [OPEN, OPEN / 3, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' }),
          }}>
          <Pressable
            onPress={() => {
              settle(0);
              onDelete();
            }}
            accessibilityRole="button"
            accessibilityLabel={`ลบ ${label}`}
            hitSlop={10}
            style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#F06A6A', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash" size={13} color="#FFF" />
          </Pressable>
        </Animated.View>
      ))}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <Pressable onPress={() => open.current && settle(0)} disabled={false} accessible={false}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
