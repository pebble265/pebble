import Ionicons from '@expo/vector-icons/Ionicons';
import RNMaskedView from '@react-native-masked-view/masked-view';
import { StatusBar } from 'expo-status-bar';
import { type ComponentType, type PropsWithChildren, type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Image, type ImageSourcePropType, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from './text';
import { At, Brand, FigmaFrame, LearnMore, PAGE_BG, useS } from './figma';
import { learnMore } from '../lib/about';
import { colors } from '../theme';

// The package's class typings predate React 19's JSX types.
const MaskedView = RNMaskedView as unknown as ComponentType<PropsWithChildren<{ maskElement: ReactNode }>>;

/** Blurred backgrounds of the dark onboarding frames (robot, static text and footer baked in). */
export const SETUP_BG = {
  hello: require('../../assets/images/setup/bg-hello.jpg'),
  finding: require('../../assets/images/setup/bg-finding.jpg'),
  found: require('../../assets/images/setup/bg-found.jpg'),
} as const;

export const AVATAR = require('../../assets/images/setup/avatar.png');

/** White frame with the "a · pebble™" header and "Learn more" footer. */
export function LightScreen({ children }: PropsWithChildren) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAGE_BG }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: PAGE_BG }}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      showsVerticalScrollIndicator={false}>
      <StatusBar style="dark" />
      <FigmaFrame>
        <Brand
          logo={{ left: 124, top: 93, width: 41, height: 39 }}
          dot={{ left: 174, top: 113, size: 4 }}
          word={{ left: 190.5, top: 99, size: 24, text: 'pebble™' }}
        />
        {children}
        <LearnMore left={25} top={808} onPress={learnMore} />
      </FigmaFrame>
    </ScrollView>
  );
}

/** Dark frame over one of the SETUP_BG images. */
export function DarkScreen({ bg, children }: PropsWithChildren<{ bg: ImageSourcePropType }>) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ flexGrow: 1 }}
      bounces={false}
      showsVerticalScrollIndicator={false}>
      <StatusBar style="light" />
      <FigmaFrame style={{ backgroundColor: '#000' }}>
        <FullBg source={bg} />
        {children}
      </FigmaFrame>
    </ScrollView>
  );
}

/** Must render inside FigmaFrame: useS() reads the frame's scale from context. */
function FullBg({ source }: { source: ImageSourcePropType }) {
  const s = useS();
  return (
    <Image
      source={source}
      style={{ position: 'absolute', left: 0, top: 0, width: s(402), height: s(874) }}
      resizeMode="stretch"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Round avatar (Figma "Group 3", 117 x 117). */
export function Avatar({
  left,
  top,
  size = 117,
  badge,
  uri,
  onPress,
}: {
  left: number;
  top: number;
  size?: number;
  badge?: ReactNode;
  /** the user's own photo, if they set one */
  uri?: string | null;
  /** makes the picture (and badge) a button, e.g. "change photo" */
  onPress?: () => void;
}) {
  const s = useS();
  const pic = (
    <>
      <Image
        source={uri ? { uri } : AVATAR}
        style={{ width: s(size), height: s(size), borderRadius: uri ? 999 : 0 }}
        accessibilityIgnoresInvertColors
      />
      {badge}
    </>
  );
  return (
    <At left={left} top={top} width={size} height={size}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="เปลี่ยนรูปโปรไฟล์" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          {pic}
        </Pressable>
      ) : (
        pic
      )}
    </At>
  );
}

/**
 * Text filled with a left-to-right gradient, like Figma's
 * `linear-gradient(90deg, #FFF 0%, #999 154%)` + background-clip: text.
 */
export function GradientText({
  children,
  left,
  top,
  width,
  size,
  weight = '700',
  align,
  from = '#FFF',
  to = '#999',
  stop = 154,
  fromStop = 0,
  angle = 90,
  lineHeight,
}: {
  children: string;
  left: number;
  top: number;
  width: number;
  size: number;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center';
  from?: string;
  to?: string;
  /** where `to` is reached, in % of the text box width */
  stop?: number;
  /** where `from` ends */
  fromStop?: number;
  angle?: number;
  lineHeight?: number;
}) {
  const s = useS();
  const text = (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{ fontSize: s(size), fontWeight: weight, color: Platform.OS === 'web' ? '#E8E8E8' : '#000', textAlign: align, paddingVertical: s(4), ...(lineHeight && { lineHeight: s(lineHeight) }) }}>
      {children}
    </Text>
  );
  return (
    <At left={left} top={top - 4} width={width} style={{ pointerEvents: 'none' }}>
      {Platform.OS === 'web' ? (
        text
      ) : (
        <MaskedView maskElement={text}>
          <View style={{ opacity: 0 }}>{text}</View>
          <View
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${angle}deg, ${from} ${fromStop}%, ${to} ${stop}%)`,
            }}
          />
        </MaskedView>
      )}
    </At>
  );
}

/** Invisible touch area over a button that is drawn in the background image. */
export function HitArea({
  left,
  top,
  width,
  height,
  label,
  onPress,
  disabled,
  children,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  onPress(): void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <At left={left} top={top} width={width} height={height}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' })}>
        {children}
      </Pressable>
    </At>
  );
}

/** One expanding ring of the "Finding Your pebble" radar. */
function Ring({ cx, cy, delay, k }: { cx: number; cy: number; delay: number; k: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  const max = 123; // outer ring in Figma
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: (cx - max / 2) * k,
        top: (cy - max / 2) * k,
        width: max * k,
        height: max * k,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [27 / max, 1] }) }],
      }}
    />
  );
}

/**
 * Bluetooth radar: the three static rings from Figma (45, 85, 123) plus
 * expanding pulses while `active`, around the 27 pt grey button.
 */
export function Radar({ active }: { active: boolean }) {
  const s = useS();
  const k = s(1);
  const cx = 200.5;
  const cy = 684.5;
  const ring = (d: number) => (
    <View
      key={d}
      style={{
        position: 'absolute',
        left: (cx - d / 2) * k,
        top: (cy - d / 2) * k,
        width: d * k,
        height: d * k,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.85)',
      }}
    />
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {[45, 85, 123].map(ring)}
      {active && [0, 800, 1600].map((d) => <Ring key={d} cx={cx} cy={cy} delay={d} k={k} />)}
      <View
        style={{
          position: 'absolute',
          left: (cx - 13.5) * k,
          top: (cy - 13.5) * k,
          width: 27 * k,
          height: 27 * k,
          borderRadius: 999,
          backgroundImage: 'linear-gradient(194deg, #F9F9F9 10%, #939393 177%)',
          backgroundColor: '#E6E6E6',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <BluetoothGlyph size={18 * k} />
      </View>
    </View>
  );
}

function BluetoothGlyph({ size }: { size: number }) {
  return <Ionicons name="bluetooth" size={size} color="#3C3C3C" />;
}
