import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, confirm, type IconName } from '../../components/ui';
import { api, API_URL } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { RobotSettings } from '../../lib/types';
import { colors, space, type } from '../../theme';

function Row({ icon, title, detail, soon }: { icon: IconName; title: string; detail?: string; soon?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={soon ? colors.muted : colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, soon && { color: colors.muted }]}>{title}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
      {soon && <Chip label="เร็ว ๆ นี้" />}
    </View>
  );
}

/** First letter for the avatar. Skips Thai leading vowels: "เอิร์ธ" -> "อ", not "เ". */
function initial(name: string) {
  const ch = [...name.trim()].find((c) => !/[\u0E40-\u0E44]/.test(c)) ?? '?';
  return ch.toUpperCase();
}

export default function Me() {
  const { user, signOut } = useAuth();
  const [robot, setRobot] = useState<RobotSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<RobotSettings>('/robot-settings').then(setRobot).catch(() => {});
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={type.title}>ฉัน</Text>

        <Card>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={{ color: colors.primaryText, fontSize: 22, fontWeight: '700' }}>
                {initial(user?.displayName ?? '')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{user?.displayName}</Text>
              <Text style={type.small}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Row icon="hardware-chip-outline" title={`หุ่น ${robot?.robotName ?? 'Pebble'}`} detail="จับคู่หุ่นและตั้งค่าเสียง" soon />
          <View style={styles.sep} />
          <Row icon="people-outline" title="ผู้ดูแล" detail="เชิญคนที่ไว้ใจให้ช่วยดูแล" soon />
          <View style={styles.sep} />
          <Row icon="shield-checkmark-outline" title="ความเป็นส่วนตัว" detail="ดาวน์โหลดหรือลบข้อมูล" soon />
        </Card>

        <Button
          title="ออกจากระบบ"
          variant="danger"
          icon="log-out-outline"
          onPress={async () => {
            if (await confirm('ออกจากระบบ?', 'Pebble จะยังเตือนกินยาผ่านหุ่นตามปกติ', 'ออกจากระบบ')) signOut();
          }}
        />
        <Text style={[type.small, { textAlign: 'center' }]}>เชื่อมต่อกับ {API_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  sep: { height: 1, backgroundColor: colors.border },
});
