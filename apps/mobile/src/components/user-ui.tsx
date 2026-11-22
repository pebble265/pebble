import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { useAuth } from '../lib/auth';
import { changeAvatar } from '../lib/avatar';
import { Text } from './text';
import { useS } from './figma';
import { TAB_BAR_SPACE } from './tab-bar';
import { colors } from '../theme';


/** "Join pebble for 3 days" */
export function daysWithPebble(createdAt?: string) {
  if (!createdAt) return '';
  const days = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000) + 1);
  return `อยู่กับ pebble มา ${days} วัน`;
}

const DEFAULT_AVATAR = require('../../assets/images/setup/avatar.png');

/** The signed-in user's photo (or the default picture), round. `px` is a plain size in points. */
export function UserPhoto({ px, style }: { px: number; style?: object }) {
  const { user } = useAuth();
  return (
    <Image
      source={user?.avatar ? { uri: user.avatar } : DEFAULT_AVATAR}
      style={[{ width: px, height: px, borderRadius: 999, backgroundColor: '#E9EEF7' }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Big avatar on the User tab. With `editable`, tapping it changes the photo (pencil badge). */
export function Avatar({ size, editable }: { size: number; editable?: boolean }) {
  const s = useS();
  const { user, reloadUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const photo = <UserPhoto px={s(size)} style={{ boxShadow: '0 6px 18px rgba(61,139,247,0.25)' }} />;
  if (!editable) return photo;
  return (
    <Pressable
      onPress={() => changeAvatar({ hasPhoto: !!user?.avatar, onBusy: setBusy, done: reloadUser })}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="เปลี่ยนรูปโปรไฟล์"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {photo}
      {busy ? (
        <View style={{ position: 'absolute', inset: 0, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          right: s(size * 0.04),
          bottom: s(size * 0.04),
          width: s(28),
          height: s(28),
          borderRadius: 999,
          backgroundColor: '#FFBF3F',
          borderWidth: 2,
          borderColor: '#FFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="camera" size={s(14)} color="#FFF" />
      </View>
    </Pressable>
  );
}

/** White page with the soft blue top, a back arrow and a centred title (sub-pages of the User tab). */
export function SubPage({ title, icon, children }: { title: string; icon?: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const s = useS();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingTop: s(88), paddingBottom: TAB_BAR_SPACE + 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ height: s(40), justifyContent: 'center', alignItems: 'center', marginBottom: s(10) }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="ย้อนกลับ"
            style={{ position: 'absolute', left: s(36), top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={s(20)} color={colors.ink} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            {icon ? <Ionicons name={icon} size={s(18)} color={colors.ink} /> : null}
            <Text style={{ fontSize: s(16), fontWeight: '500', color: colors.ink }}>{title}</Text>
          </View>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

/** Label + grey value row with a hairline under it (Login & Security, Appearance). */
export function InfoRow({
  label,
  value,
  right,
  onPress,
  last,
}: {
  label: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const s = useS();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        marginHorizontal: s(40),
        paddingVertical: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: s(13), fontWeight: '500', color: colors.ink }}>{label}</Text>
        {value ? <Text style={{ fontSize: s(11), color: colors.muted, marginTop: s(2) }}>{value}</Text> : null}
      </View>
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={s(14)} color={colors.faint} /> : null}
    </Pressable>
  );
}
