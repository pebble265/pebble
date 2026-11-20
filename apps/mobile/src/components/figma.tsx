import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createContext, type PropsWithChildren, type ReactNode, type Ref, useContext } from 'react';
import { Image, Pressable, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Text, TextInput } from './text';
import { colors } from '../theme';

/**
 * The auth screens are laid out in the Figma frame's own coordinates
 * (402 x 874, iPhone 17 Pro) and scaled to the phone's width, so every
 * position, size and font matches the design exactly on any iPhone.
 */
export const FRAME_W = 402;
export const FRAME_H = 874;
export const PAGE_BG = '#FDFDFD';

const ScaleContext = createContext<number | null>(null);

export function useFigmaScale() {
  const { width } = useWindowDimensions();
  return width / FRAME_W;
}

/** Scales a Figma number to screen points. */
export function useS() {
  // Outside a FigmaFrame (e.g. in a page component that renders the frame) use the window scale.
  const fromFrame = useContext(ScaleContext);
  const fromWindow = useFigmaScale();
  const k = fromFrame ?? fromWindow;
  return (n: number) => n * k;
}

/**
 * Height of a 402 x 874 Figma frame on this phone. Frames are scaled by width, so on phones a little
 * shorter than the design (e.g. 393 x 852) the frame would poke a few points below the screen and the page
 * would scroll for nothing; within that small margin the frame is fitted to the screen instead.
 */
export function useFrameHeight(k: number) {
  const { height: win } = useWindowDimensions();
  const h = FRAME_H * k;
  return h > win && h - win <= 30 ? win : h;
}

export function FigmaFrame({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const k = useFigmaScale();
  const height = useFrameHeight(k);
  return (
    <ScaleContext.Provider value={k}>
      <View style={[{ width: FRAME_W * k, height, backgroundColor: PAGE_BG }, style]}>{children}</View>
    </ScaleContext.Provider>
  );
}

type Box = { left?: number; top: number; width?: number; height?: number; right?: number };

/** Absolutely placed box in frame coordinates. */
export function At({ left, top, width, height, right, style, children }: PropsWithChildren<Box & { style?: StyleProp<ViewStyle> }>) {
  const s = useS();
  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: s(top),
          ...(left !== undefined && { left: s(left) }),
          ...(right !== undefined && { right: s(right) }),
          ...(width !== undefined && { width: s(width) }),
          ...(height !== undefined && { height: s(height) }),
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Text at a Figma text-layer position. SF Pro is the iOS system font, so with
 * Figma's "line-height: normal" the line box matches the design 1:1.
 */
export function FText({
  left,
  top,
  right,
  width,
  size,
  weight = '400',
  color = colors.ink,
  align,
  children,
  style,
}: {
  left?: number;
  top: number;
  right?: number;
  width?: number;
  size: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  align?: TextStyle['textAlign'];
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const s = useS();
  return (
    <Text
      style={[
        {
          position: 'absolute',
          top: s(top),
          ...(left !== undefined && { left: s(left) }),
          ...(right !== undefined && { right: s(right) }),
          ...(width !== undefined && { width: s(width) }),
          fontSize: s(size),
          fontWeight: weight,
          color,
          ...(align && { textAlign: align }),
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

/** Small black dot used in the designs. */
export function Dot({ left, top, size }: { left: number; top: number; size: number }) {
  return <At left={left} top={top} width={size} height={size} style={{ borderRadius: 999, backgroundColor: colors.ink }} />;
}

/** "a • pebble" header: logo image, dot, wordmark. */
export function Brand({
  logo,
  dot,
  word,
}: {
  logo: Box;
  dot: { left: number; top: number; size: number };
  word: { left: number; top: number; size: number; text: string };
}) {
  const s = useS();
  return (
    <>
      <At {...logo}>
        <Image
          source={require('../../assets/images/splash-logo.png')}
          style={{ width: s(logo.width ?? 0), height: s(logo.height ?? 0) }}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
        />
      </At>
      <Dot {...dot} />
      <FText left={word.left} top={word.top} size={word.size} weight="700">
        {word.text}
      </FText>
    </>
  );
}

/** 332 x 42 outlined input from the designs (white, 1px border, radius 6). */
export function FField({
  left,
  top,
  width = 332,
  inputRef,
  borderColor = colors.ink,
  fontSize = 16,
  padLeft = 10,
  placeholderColor = '#A0A0A6',
  height = 42,
  radius = 6,
  ...input
}: {
  left: number;
  top: number;
  width?: number;
  inputRef?: Ref<TextInputInstance>;
  borderColor?: string;
  fontSize?: number;
  padLeft?: number;
  placeholderColor?: string;
  height?: number;
  radius?: number;
} & TextInputProps) {
  const s = useS();
  return (
    <At left={left} top={top} width={width} height={height}>
      <TextInput
        ref={inputRef}
        placeholderTextColor={placeholderColor}
        {...input}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor,
          borderRadius: s(radius),
          backgroundColor: colors.surface,
          paddingLeft: s(padLeft),
          paddingRight: s(10),
          fontSize: s(fontSize),
          color: colors.ink,
          outlineWidth: 0,
        }}
      />
    </At>
  );
}

/** Checkbox icon + "Remember me". */
export function RememberMe({
  checked,
  onToggle,
  box,
  label,
}: {
  checked: boolean;
  onToggle(): void;
  box: { left: number; top: number };
  label: { left: number; top: number };
}) {
  const s = useS();
  return (
    <>
      <At left={box.left - 6} top={box.top - 6} width={label.left - box.left + 90} height={25}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="Remember me"
          hitSlop={8}
          style={{ flex: 1 }}
        />
      </At>
      <At left={box.left} top={box.top} width={13} height={13} style={{ pointerEvents: 'none' }}>
        <MaterialCommunityIcons
          name={checked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={s(15)}
          color={colors.ink}
          style={{ marginLeft: -s(1), marginTop: -s(1) }}
        />
      </At>
      <FText left={label.left} top={label.top} size={12} style={{ pointerEvents: 'none' }}>
        Remember me
      </FText>
    </>
  );
}

/** 318 x 63 rounded social button with icon on the left and right-aligned label. */
export function SocialButton({
  kind,
  label,
  rect,
  icon,
  textRight,
  onPress,
  bg,
  busy,
}: {
  kind: 'apple' | 'google' | 'email';
  label: string;
  rect: { left: number; top: number };
  icon: { left: number; top: number; size: number };
  /** distance of the label's right edge from the button's right edge */
  textRight: number;
  onPress(): void;
  bg?: string;
  busy?: boolean;
}) {
  const s = useS();
  const background = bg ?? (kind === 'apple' ? '#000' : kind === 'email' ? '#81E26E' : '#FFF');
  const fg = kind === 'apple' ? '#FFF' : '#000';
  return (
    <At left={rect.left} top={rect.top} width={318} height={63}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: s(18),
          backgroundColor: background,
          justifyContent: 'center',
          opacity: pressed || busy ? 0.75 : 1,
        })}>
        <View style={{ position: 'absolute', left: s(icon.left - rect.left), top: s(icon.top - rect.top) }}>
          {kind === 'apple' && <Ionicons name="logo-apple" size={s(icon.size)} color="#FFF" />}
          {kind === 'google' && (
            <Image source={require('../../assets/images/google-g.png')} style={{ width: s(icon.size), height: s(icon.size) }} />
          )}
          {kind === 'email' && <Ionicons name="phone-portrait" size={s(icon.size)} color="#FFF" />}
        </View>
        <Text
          style={{
            position: 'absolute',
            right: s(textRight),
            fontSize: s(16),
            fontWeight: '500',
            color: fg,
          }}>
          {label}
        </Text>
      </Pressable>
    </At>
  );
}

/** ⓘ Learn more about pebble */
export function LearnMore({ left, top, onPress }: { left: number; top: number; onPress(): void }) {
  const s = useS();
  return (
    <At left={left} top={top - 1} height={16}>
      <Pressable onPress={onPress} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center' }} hitSlop={8}>
        <Ionicons name="information-circle-outline" size={s(14)} color={colors.ink} />
        <Text style={{ fontSize: s(12), color: colors.ink, marginLeft: s(2) }}>Learn more about pebble</Text>
      </Pressable>
    </At>
  );
}
