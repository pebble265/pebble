import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, gradients, PERIODS, periodOf, radius, shadow, space, type } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** White rounded card with the soft Figma shadow. */
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  title: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Figma's black buttons put an arrow at the left edge: "→  Sign-Up". */
  leadingArrow?: boolean;
  style?: ViewStyle;
  small?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  leadingArrow,
  style,
  small,
}: ButtonProps) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    blue: { bg: colors.blue, fg: '#FFFFFF', border: colors.blue },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant === 'secondary' && { boxShadow: shadow.soft },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        off && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {leadingArrow && (
            <Ionicons name="arrow-forward" size={18} color={palette.fg} style={styles.leadingArrow} />
          )}
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  right,
  ...props
}: TextInputProps & { label: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor="#B4B4BA"
          accessibilityLabel={label}
          {...props}
          style={[styles.input, !!right && { paddingRight: 48 }, props.style]}
        />
        {right ? <View style={styles.inputRight}>{right}</View> : null}
      </View>
      {hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
}

/** Show / hide password button for the right edge of a Field. */
export function EyeToggle({ hidden, onPress }: { hidden: boolean; onPress(): void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน'} style={{ padding: 8 }}>
      <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'primary' | 'blue';
  icon?: IconName;
}) {
  const t = {
    neutral: [colors.surfaceAlt, colors.muted],
    success: [colors.successSoft, colors.success],
    warn: [colors.warnSoft, colors.warn],
    danger: [colors.dangerSoft, colors.danger],
    primary: [colors.primarySoft, colors.text],
    blue: [colors.blueSoft, colors.blue],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t[0] }]}>
      {icon && <Ionicons name={icon} size={13} color={t[1]} />}
      <Text style={{ color: t[1], fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** The brand mark from the Figma header: a small black "a" tile + "pebble". */
export function Logo({ size = 20, tm }: { size?: number; tm?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.4 }} accessibilityLabel="pebble">
      <View style={[styles.logoTile, { width: size * 1.25, height: size * 1.25, borderRadius: size * 0.35 }]}>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.85, marginTop: -size * 0.08 }}>a</Text>
      </View>
      <Text style={{ fontSize: size, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>
        pebble{tm ? '™' : ''}
      </Text>
    </View>
  );
}

/** Pebble's face: a glossy blue blob with sleepy eyes (the robot / AI avatar). */
export function RobotFace({ size = 56, awake = false }: { size?: number; awake?: boolean }) {
  const eyeW = size * 0.16;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundImage: gradients.robot,
        backgroundColor: colors.blue,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: size * 0.16,
        boxShadow: '0px 6px 16px rgba(61, 139, 247, 0.35)',
      }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={
            awake
              ? { width: eyeW * 0.7, height: eyeW * 1.1, borderRadius: eyeW, backgroundColor: '#FFFFFF' }
              : {
                  width: eyeW,
                  height: eyeW * 0.5,
                  borderBottomLeftRadius: eyeW,
                  borderBottomRightRadius: eyeW,
                  borderWidth: Math.max(2, size * 0.04),
                  borderTopWidth: 0,
                  borderColor: '#FFFFFF',
                }
          }
        />
      ))}
    </View>
  );
}

/** Yellow capsule with the period icon and time (navy at night), as on "next up". */
export function TimeCapsule({ time, vertical, faded }: { time: string; vertical?: boolean; faded?: boolean }) {
  const p = PERIODS.find((x) => x.key === periodOf(time))!;
  const night = p.key === 'night';
  const fg = night ? '#FFFFFF' : '#5B4300';
  return (
    <View
      style={[
        vertical ? styles.capsuleV : styles.capsuleH,
        night ? { backgroundColor: colors.night } : { backgroundImage: gradients.sun, backgroundColor: colors.sun },
        faded && { opacity: 0.45 },
      ]}
      accessibilityLabel={`${p.label} ${time}`}>
      <MaterialCommunityIcons name={p.icon} size={vertical ? 15 : 14} color={fg} />
      <Text style={{ color: fg, fontWeight: '700', fontSize: vertical ? 11 : 12 }}>{time}</Text>
    </View>
  );
}

/** Round blue badge with a capsule icon (medicine marker). */
export function PillIcon({ size = 30, tone = 'blue' }: { size?: number; tone?: 'blue' | 'white' | 'red' }) {
  const bg = { blue: colors.blue, white: '#FFFFFF', red: '#FFFFFF' }[tone];
  const fg = { blue: '#FFFFFF', white: colors.blue, red: colors.red }[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name="pill" size={size * 0.58} color={fg} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.blue} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.small, { textAlign: 'center' }]}>{text}</Text> : null}
      {action}
    </View>
  );
}

/** Native confirm dialog; falls back to window.confirm on web. */
export function confirm(title: string, message: string, okLabel = 'ยืนยัน'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    boxShadow: shadow.card,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: space.md, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  leadingArrow: { position: 'absolute', left: space.lg },
  fieldLabel: { fontSize: 12, color: colors.text, fontWeight: '500' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D9D9DE',
    borderRadius: 10,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputRight: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' },
  error: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    padding: space.md,
    borderRadius: radius.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  logoTile: { backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  capsuleV: {
    width: 40,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    gap: 2,
  },
  capsuleH: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  empty: { alignItems: 'center', gap: space.md, padding: space.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
