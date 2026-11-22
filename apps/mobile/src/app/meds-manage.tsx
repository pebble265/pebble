import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwipeToDelete } from '../components/swipe-row';
import { Button, confirm, EmptyState, ErrorText, PillIcon, TimeCapsule } from '../components/ui';
import { refreshMedAlarms } from '../lib/med-alarms';
import { api, errorText } from '../lib/api';
import { daysLabel } from '../lib/format';
import type { Medication } from '../lib/types';
import { colors, gradients, shadow, space, themedStyles, type } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** "Calibrate medication" from the Figma: a blue pill per medicine with its time chips below. */
/** Manage medicines: edit (pencil), edit times, swipe left to delete. Opened from the Medications tab. */
export default function ManageMeds() {
  useTheme();
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api<Medication[]>('/medications');
      setMeds(list);
      void refreshMedAlarms(); // alarm-clock reminders on this phone
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

  async function remove(m: Medication) {
    const ok = await confirm('ลบยานี้?', `"${m.name}" จะหยุดเตือน ประวัติการกินยายังเก็บไว้`, 'ลบ');
    if (!ok) return;
    try {
      await api(`/medications/${m.id}`, { method: 'DELETE' });
      setMeds((list) => list?.filter((x) => x.id !== m.id) ?? null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" style={{ paddingHorizontal: space.xl, paddingTop: space.sm, alignSelf: 'flex-start' }}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <ScrollView alwaysBounceVertical={false}
        contentContainerStyle={styles.page}
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
        <View style={styles.head}>
          <MaterialCommunityIcons name="pill" size={44} color={colors.text} style={{ transform: [{ rotate: '-35deg' }] }} />
          <Text style={styles.title}>จัดการยา</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>แก้ไขยา เวลากิน หรือปัดไปทางซ้ายเพื่อลบ</Text>
        </View>
        <ErrorText>{error}</ErrorText>

        {meds && meds.length === 0 && (
          <EmptyState icon="medkit-outline" title="ยังไม่มียา" text="เพิ่มยาที่กินประจำ แล้ว Pebble จะเตือนเมื่อถึงเวลา" />
        )}


        {meds?.map((m) => (
          <SwipeToDelete key={m.id} label={m.name} onDelete={() => remove(m)}>
          <View style={{ gap: 8 }}>
            <View style={styles.pill}>
              <PillIcon size={34} tone="white" />
              <Text style={styles.pillName} numberOfLines={1}>
                {m.name}
              </Text>
              {m.dosage ? (
                <Text style={styles.pillDose} numberOfLines={1}>
                  {m.dosage}
                </Text>
              ) : null}
              <Pressable
                onPress={() => router.push({ pathname: '/medication-new', params: { id: m.id } })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`แก้ไข ${m.name}`}>
                <MaterialCommunityIcons name="pencil" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.times}>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.row}>
                  <Ionicons name="time-outline" size={18} color={colors.text} />
                  <Text style={type.label}>เวลากินยา</Text>
                  {m.schedules[0] && <Text style={type.small}>· {daysLabel(m.schedules[0].daysOfWeek)}</Text>}
                </View>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  {m.schedules.map((s) => (
                    <TimeCapsule key={s.id} time={s.time} />
                  ))}
                  {m.schedules.length === 0 && <Text style={type.small}>ไม่ได้ตั้งเวลา</Text>}
                </View>
                {m.instructions ? <Text style={type.small}>{m.instructions}</Text> : null}
                {m.pillsRemaining != null && (
                  <Text style={[type.small, m.pillsRemaining <= 5 && { color: colors.warn, fontWeight: '600' }]}>
                    เหลือ {m.pillsRemaining} เม็ด{m.pillsRemaining <= 5 ? ' · ใกล้หมดแล้ว' : ''}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/medication-new', params: { id: m.id, step: '2' } })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`แก้เวลา ${m.name}`}
                style={{ alignSelf: 'center', paddingLeft: space.sm }}>
                <Text style={{ fontSize: 12, color: colors.text }}>edit</Text>
              </Pressable>
            </View>
          </View>
          </SwipeToDelete>
        ))}

        <Button title="เพิ่มยา" icon="add" variant="secondary" onPress={() => router.push('/medication-new')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  page: {
    padding: space.xl,
    paddingBottom: 40,
    gap: space.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  head: { alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    backgroundImage: gradients.pill,
    backgroundColor: colors.blue,
    boxShadow: shadow.soft,
  },
  pillName: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  pillDose: { color: '#FFFFFF', fontSize: 12, maxWidth: 120 },
  times: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: space.md,
    boxShadow: shadow.soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
