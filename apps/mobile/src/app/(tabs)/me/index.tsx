import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/text';
import { useS } from '../../../components/figma';
import { useTabBarHeight } from '../../../components/tab-bar';
import { confirm } from '../../../components/ui';
import { Avatar, daysWithPebble } from '../../../components/user-ui';
import { useAuth } from '../../../lib/auth';
import { contactTeam } from '../../../lib/contact';
import { colors, gradients } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const s = useS();
  return (
    <View style={{ marginTop: s(16) }}>
      <Text style={{ marginLeft: s(37), fontSize: s(10), color: colors.muted, marginBottom: s(2) }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, label, onPress, soon, last }: { icon: ReactNode; label: string; onPress?: () => void; soon?: boolean; last?: boolean }) {
  const s = useS();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        marginHorizontal: s(37),
        height: s(43),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}>
      <View style={{ width: s(18), alignItems: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: s(13), color: soon ? colors.faint : colors.ink }}>{label}</Text>
      {soon ? (
        <Text style={{ fontSize: s(10), color: colors.faint }}>เร็ว ๆ นี้</Text>
      ) : (
        <Ionicons name="chevron-forward" size={s(14)} color={colors.faint} />
      )}
    </Pressable>
  );
}

/** Figma "pebble(a) - User". */
export default function Me() {
  useTheme();
  const s = useS();
  const { user, signOut } = useAuth();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barH = useTabBarHeight();
  // Height of everything from the name down to "Sign out", measured after layout.
  const [contentH, setContentH] = useState(0);
  // The design puts the name 196pt down. When that would push "Sign out" under the tab bar, move it up
  // (never under the status bar) so the whole page fits and nothing needs scrolling.
  const bottomGap = barH + s(14);
  const top = contentH ? Math.max(insets.top + s(12), Math.min(s(196), winH - bottomGap - contentH)) : s(196);
  const fits = contentH > 0 && top + contentH + bottomGap <= winH + 1;
  const ic = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={s(16)} color={colors.ink} />;
  const mc = (name: keyof typeof MaterialCommunityIcons.glyphMap) => <MaterialCommunityIcons name={name} size={s(17)} color={colors.ink} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, backgroundImage: gradients.user }}>
      <ScrollView alwaysBounceVertical={false} scrollEnabled={!fits} contentContainerStyle={{ paddingTop: top, paddingBottom: bottomGap }}>
        <View onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
        {/* name + avatar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: s(37), paddingRight: s(30) }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: s(26), fontWeight: '700', color: colors.ink, letterSpacing: -0.4 }}>
              {user?.displayName}
            </Text>
            <Text style={{ fontSize: s(9), color: colors.ink, marginTop: s(2) }}>{daysWithPebble(user?.createdAt)}</Text>
          </View>
          <Avatar size={124} editable />
        </View>

        <Section title="การตั้งค่า">
          <Row icon={ic('person-circle')} label="ข้อมูลส่วนตัว" onPress={() => router.push('/me/personal')} />
          <Row icon={ic('log-in-outline')} label="การเข้าสู่ระบบและความปลอดภัย" onPress={() => router.push('/me/security')} />
          <Row icon={ic('albums-outline')} label="การแสดงผล" onPress={() => router.push('/me/appearance')} />
          <Row icon={ic('help-circle-outline')} label="ความช่วยเหลือ" onPress={() => router.push('/me/help')} />
          <Row icon={ic('document-text-outline')} label="ข้อกำหนดและเงื่อนไข" onPress={() => router.push('/terms')} last />
        </Section>

        <Section title="การตั้งค่า pebble">
          <Row icon={mc('medical-bag')} label="ข้อมูลทางการแพทย์" onPress={() => router.push('/me/medical')} />
          <Row icon={mc('pill')} label="ข้อมูลยา" onPress={() => router.push('/meds-manage')} />
          <Row icon={mc('robot')} label="pebble ของคุณ" onPress={() => router.navigate('/robot')} />
          <Row icon={ic('people-outline')} label="ผู้ดูแล" onPress={() => router.push('/me/caretakers')} />
          <Row icon={ic('chatbubble-ellipses-outline')} label="ติดต่อทีม pebble" onPress={contactTeam} last />
        </Section>

        <Pressable
          onPress={async () => {
            if (await confirm('ออกจากระบบ?', 'Pebble จะยังเตือนกินยาผ่านหุ่นตามปกติ', 'ออกจากระบบ')) signOut();
          }}
          accessibilityRole="button"
          style={{ alignSelf: 'center', marginTop: s(22), paddingHorizontal: s(16), paddingVertical: s(8) }}>
          <Text style={{ fontSize: s(13), fontWeight: '600', color: '#E5484D' }}>ออกจากระบบ</Text>
        </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
