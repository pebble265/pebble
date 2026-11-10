import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE } from '../../components/tab-bar';
import { Button, Card, confirm, ErrorText, RobotFace } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import type { Device, RobotSettings } from '../../lib/types';
import { colors, shadow, space, type } from '../../theme';

const STATUS: Record<Device['status'], string> = {
  online: 'ออนไลน์',
  charging: 'กำลังชาร์จ',
  offline: 'ออฟไลน์',
  error: 'มีปัญหา',
  unpaired: 'ยังไม่จับคู่',
};

/** "pebble" tab: the robot itself. Pair with the 6-digit code shown on its screen. */
export default function Robot() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [settings, setSettings] = useState<RobotSettings | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api<Device[]>('/devices'), api<RobotSettings>('/robot-settings')]);
      setDevices(d);
      setSettings(s);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function pair() {
    if (!/^\d{6}$/.test(code)) return setError('รหัสจับคู่ต้องเป็นตัวเลข 6 หลักบนหน้าจอหุ่น');
    setBusy(true);
    setError('');
    try {
      await api('/devices/pair', { method: 'POST', body: { code } });
      setCode('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function unpair(d: Device) {
    if (!(await confirm('เลิกจับคู่หุ่น?', 'หุ่นจะหยุดเตือนยาและคุยกับคุณจนกว่าจะจับคู่ใหม่', 'เลิกจับคู่'))) return;
    try {
      await api(`/devices/${d.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const device = devices?.[0];
  const online = device && ['online', 'charging'].includes(device.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <View style={styles.hero}>
          <RobotFace size={120} awake={!!online} />
          <Text style={styles.heroTitle}>{device ? (settings?.robotName ?? 'pebble(a)') : 'เชื่อมต่อ pebble(a)\nตัวแรกของคุณ'}</Text>
          {device && (
            <Text style={styles.heroSub}>
              {STATUS[device.status]}
              {device.batteryLevel != null ? ` · แบต ${device.batteryLevel}%` : ''}
            </Text>
          )}
        </View>
        <ErrorText>{error}</ErrorText>

        {devices && !device && (
          <Card style={{ gap: space.md }}>
            <Text style={type.heading}>จับคู่หุ่น</Text>
            <Text style={type.small}>เปิดหุ่น pebble(a) แล้วใส่รหัส 6 หลักที่ขึ้นบนหน้าจอของหุ่น</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor="#C4C4CA"
              style={styles.code}
              maxLength={6}
              accessibilityLabel="รหัสจับคู่ 6 หลัก"
            />
            <Button title="เชื่อมต่อ" leadingArrow onPress={pair} loading={busy} />
          </Card>
        )}

        {device && (
          <Card style={{ gap: space.md }}>
            <Text style={type.heading}>ข้อมูลหุ่น</Text>
            {[
              ['หมายเลขเครื่อง', device.serialNumber],
              ['ช่องใส่ยา', `${device.pillSlots} ช่อง`],
              ['เฟิร์มแวร์', device.firmwareVersion ?? '–'],
              ['เสียงเรียก', settings?.wakeWord ?? '–'],
            ].map(([k, v]) => (
              <View key={k} style={styles.kv}>
                <Text style={type.small}>{k}</Text>
                <Text style={type.label}>{v}</Text>
              </View>
            ))}
            <Button title="เลิกจับคู่" variant="danger" small onPress={() => unpair(device)} />
          </Card>
        )}

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="mic-outline" size={22} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>เลือกเสียงของหุ่น</Text>
            <Text style={type.small}>เร็ว ๆ นี้</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, paddingBottom: TAB_BAR_SPACE + 10, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xl,
    borderRadius: 28,
    backgroundImage: 'linear-gradient(160deg, #1C1C22 0%, #2E3B66 55%, #C46B7A 100%)',
    backgroundColor: '#24263A',
    boxShadow: shadow.card,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  code: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

