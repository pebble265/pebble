/**
 * Motion helpers: springy taps, staggered entrances and gentle idle loops,
 * so the app feels soft instead of stiff. Built on react-native-reanimated.
 *
 *  - Tap      drop-in for Pressable: shrinks a little on press, springs back.
 *  - Rise     fades + slides a block up when it first appears (index = order).
 *  - Stagger  wraps every child in a Rise with increasing delay.
 *  - Float    slow up/down bob (robot pictures, avatars).
 *  - Breathe  slow scale pulse (status dots, "listening" orbs).
 */
import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SPRING = { damping: 16, stiffness: 220, mass: 0.7 } as const;
export const layout = LinearTransition.springify().damping(18).stiffness(180);
export { FadeIn, FadeOut };

type TapProps = PressableProps & {
  /** How far to shrink while pressed (1 = no shrink). */
  scaleTo?: number;
};

/** Pressable that squishes slightly while pressed, then springs back. */
export function Tap({ scaleTo = 0.96, style, children, onPressIn, onPressOut, onLayout, disabled, ...rest }: TapProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  // Big things (backdrops, whole cards) shrink by a few points at most, never by 4 %.
  const [shrink, setShrink] = useState(scaleTo);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const state = { pressed, hovered: false } as PressableStateCallbackType;
  const resolved = typeof style === 'function' ? style(state) : style;
  const kids = typeof children === 'function' ? children(state) : children;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const big = Math.max(width, height);
        // full-screen backdrops: no squish at all
        setShrink(width > 340 && height > 480 ? 1 : Math.max(scaleTo, 1 - 10 / Math.max(big, 1)));
        onLayout?.(e);
      }}
      onPressIn={(e) => {
        setPressed(true);
        if (!disabled && shrink < 1) scale.value = withSpring(shrink, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.value = withSpring(1, { damping: 10, stiffness: 260, mass: 0.6 });
        onPressOut?.(e);
      }}
      style={[resolved as StyleProp<ViewStyle>, anim]}>
      {kids}
    </AnimatedPressable>
  );
}

/** Fade + slide up on first mount. `i` staggers siblings (≈70 ms each). */
export function Rise({ i = 0, children, style, delay = 0 }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View
      style={style}
      entering={reduce ? undefined : FadeInDown.delay(delay + i * 70).duration(420).springify().damping(17).stiffness(140)}>
      {children}
    </Animated.View>
  );
}

/** Rise every direct child in order. Keeps flow layout (gap, flex) intact. */
export function Stagger({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  let i = 0;
  return (
    <>
      {Children.map(children, (c) => {
        if (!isValidElement(c)) return c;
        return (
          <Rise i={i++} delay={delay}>
            {c}
          </Rise>
        );
      })}
    </>
  );
}

/** Gentle up/down bob forever. */
export function Float({ children, style, amount = 6, period = 3200 }: { children: ReactNode; style?: StyleProp<ViewStyle>; amount?: number; period?: number }) {
  const y = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-amount, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [amount, period, reduce, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Slow scale pulse forever (status dots, orbs). */
export function Breathe({ children, style, to = 1.08, period = 2400, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; to?: number; period?: number; delay?: number }) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    s.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(to, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [delay, period, reduce, s, to]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Blink loop for the robot's eyes: returns an animated scaleY style. */
export function useBlink(enabled = true) {
  const sy = useSharedValue(1);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || !alive) return;
      const tick = () => {
        sy.value = withSequence(withTiming(0.1, { duration: 90 }), withTiming(1, { duration: 140 }));
        t = setTimeout(tick, 2600 + Math.random() * 2600);
      };
      t = setTimeout(tick, 1200);
    });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [enabled, sy]);
  return useAnimatedStyle(() => ({ transform: [{ scaleY: sy.value }] }));
}

export { Animated };

/** Three bouncing dots, like iMessage "typing…". */
export function TypingDots({ color = '#9AA3AF', size = 7 }: { color?: string; size?: number }) {
  return (
    <Animated.View style={{ flexDirection: 'row', gap: size * 0.6, paddingVertical: size * 0.6 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} color={color} size={size} />
      ))}
    </Animated.View>
  );
}

function Dot({ i, color, size }: { i: number; color: string; size: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      i * 150,
      withRepeat(
        withSequence(
          withTiming(-size * 0.7, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 340 }),
        ),
        -1,
      ),
    );
  }, [i, size, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 0.55 + (-y.value / (size * 0.7)) * 0.45 }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size, backgroundColor: color }, anim]} />;
}
