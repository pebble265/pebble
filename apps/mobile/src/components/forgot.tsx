import { type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Image, type ImageSourcePropType, Pressable, ScrollView, View } from 'react-native';
import { Text } from './text';
import { At, FigmaFrame, FText, PAGE_BG, useS } from './figma';
import { colors } from '../theme';

/** Blurred colour-blob background of each Forget Password frame (Figma "Group 4"). */
export const FORGOT_BG = {
  select: require('../../assets/images/forgot/bg-select.jpg'),
  email: require('../../assets/images/forgot/bg-email.jpg'),
  verify: require('../../assets/images/forgot/bg-verify.jpg'),
  create: require('../../assets/images/forgot/bg-create.jpg'),
} as const;

/** A Forget Password frame: 402 x 874 Figma coordinates over its background. */
export function ForgotScreen({ bg, children }: PropsWithChildren<{ bg: ImageSourcePropType }>) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAGE_BG }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: PAGE_BG }}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      showsVerticalScrollIndicator={false}>
      <FigmaFrame>
        <BgImage source={bg} />
        {children}
        <Footer />
      </FigmaFrame>
    </ScrollView>
  );
}

function BgImage({ source }: { source: ImageSourcePropType }) {
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

/** White "a · pebble™" at the bottom of every frame. */
function Footer() {
  const s = useS();
  return (
    <>
      <At left={158} top={803} width={23} height={22}>
        <Image
          source={require('../../assets/images/splash-logo.png')}
          style={{ width: s(23), height: s(22), tintColor: '#FFF' }}
          resizeMode="stretch"
        />
      </At>
      <At left={186} top={813} width={2} height={2} style={{ backgroundColor: colors.surface, borderRadius: 999 }} />
      <FText left={195} top={806} size={15} weight="700" color="#FFF">
        pebble™
      </FText>
    </>
  );
}

/**
 * fluent:password-20-filled (the black "××_" key) with the tilted "?".
 * `size` is the component's Figma size (95 or 70); `q` places the "?" by its
 * centre, relative to the component.
 */
export function PwIcon({
  left,
  top,
  size,
  q,
}: {
  left: number;
  top: number;
  size: number;
  q?: { cx: number; cy: number; font: number };
}) {
  const s = useS();
  const k = size / 95;
  return (
    <At left={left} top={top} width={size} height={size} style={{ pointerEvents: 'none' }}>
      <Image
        source={require('../../assets/images/forgot/pw-icon.png')}
        style={{ position: 'absolute', left: s(8.5 * k), top: s(17 * k), width: s(76 * k), height: s(52.25 * k) }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      {q && (
        <Text
          style={{
            position: 'absolute',
            left: s(q.cx - 0.28 * q.font),
            top: s(q.cy - 0.6 * q.font),
            fontSize: s(q.font),
            fontWeight: '700',
            color: colors.ink,
            transform: [{ rotate: '22.488deg' }],
          }}>
          ?
        </Text>
      )}
    </At>
  );
}

/** Rounded (8) button with centred 16pt label. */
export function FButton({
  left,
  top,
  width,
  label,
  onPress,
  bg = '#000',
  color = '#FFF',
  busy,
  children,
}: {
  left: number;
  top: number;
  width: number;
  label: string;
  onPress(): void;
  bg?: string;
  color?: string;
  busy?: boolean;
  /** custom content instead of the centred label */
  children?: ReactNode;
}) {
  const s = useS();
  return (
    <At left={left} top={top} width={width} height={37}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: s(8),
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}>
        {busy ? (
          <ActivityIndicator color={color} />
        ) : (
          (children ?? <Text style={{ color, fontSize: s(16) }}>{label}</Text>)
        )}
      </Pressable>
    </At>
  );
}

/** Five rounded boxes (51 x 65, gap 13) over one hidden input. */
export function OtpBoxes({
  left,
  top,
  value,
  focused,
  onPress,
}: {
  left: number;
  top: number;
  value: string;
  focused: boolean;
  onPress(): void;
}) {
  const s = useS();
  return (
    <At left={left} top={top} width={307} height={65}>
      <Pressable onPress={onPress} accessibilityLabel="รหัสยืนยัน 5 หลัก" style={{ flex: 1, flexDirection: 'row', gap: s(13) }}>
        {Array.from({ length: 5 }, (_, i) => {
          const active = focused && (i === value.length || (i === 4 && value.length === 5));
          return (
            <View
              key={i}
              style={{
                width: s(51),
                height: s(65),
                borderRadius: s(24),
                borderWidth: 1,
                borderColor: active ? '#000' : '#828282',
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: s(28), color: colors.ink }}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
    </At>
  );
}
