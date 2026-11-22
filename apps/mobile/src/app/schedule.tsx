import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View, StyleSheet } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirm, ErrorText, PillIcon, TimeCapsule } from '../components/ui';
import { refreshMedAlarms } from '../lib/med-alarms';
import { api, errorText } from '../lib/api';
import { timeOf } from '../lib/format';
import type { Dose, TodayDoses } from '../lib/types';
import { colors, gradients, shadow, space, themedStyles } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** The backend refuses "taken" more than 1 hour early. */
const EARLY_MS = 60 * 60 * 1000;

/**
 * "Medicine Schedule Take-in" overlay from the Figma: doses due now as white
 * pills you can tap to confirm, then the rest of the day as blue pills.
 */
export default function Schedule() {
  useTheme();
  const [today, setToday] = useState<TodayDoses | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      api<TodayDoses>('/doses/today')
        .then(setToday)
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  const tz = today?.timezone;
  const now = Date.now();
  const doses = today?.doses ?? [];
  const due = doses.filter(
    (d) => d.status === 'missed' || (d.status === 'pending' && new Date(d.scheduledAt).getTime() - now <= EARLY_MS),
  );
  const later = doses.filter((d) => !due.includes(d));

  async function take(d: Dose) {
    const ok = await confirm(`กิน ${d.medication.name} แล้ว?`, d.medication.dosage ?? 'บันทึกว่ากินยารอบนี้แล้ว', 'กินแล้ว');
    if (!ok) return;
    setBusyId(d.id);
    setError('');
    try {
      const updated = await api<Dose>(`/doses/${d.id}/take`, { method: 'POST', body: { via: 'app' } });
      void refreshMedAlarms(); // taken before its time: today's alarm for it is dropped
      setToday((t) => t && { ...t, doses: t.doses.map((x) => (x.id === updated.id ? updated : x)) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.page}>
          <Text style={styles.title}>{'ถึงเวลา\nกินยา'}</Text>
          <ErrorText>{error}</ErrorText>
          {!today && <ActivityIndicator color="#FFFFFF" />}

          {today && due.length === 0 && (
            <View style={[styles.duePill, { justifyContent: 'center' }]}>
              <Text style={styles.dueName}>ตอนนี้ยังไม่มียาที่ต้องกิน 🙂</Text>
            </View>
          )}
          {due.map((d, i) => (
            <Pressable
              key={d.id}
              onPress={() => take(d)}
              disabled={busyId === d.id}
              accessibilityRole="button"
              accessibilityLabel={`กิน ${d.medication.name}`}
              style={({ pressed }) => [styles.duePill, { marginHorizontal: i * 6 }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={styles.nextLabel}>{'ยา\nถัดไป'}</Text>
              <TimeCapsule time={timeOf(d.scheduledAt, tz)} vertical />
              <PillIcon size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dueName} numberOfLines={1}>
                  {d.medication.name}
                </Text>
                {d.status === 'missed' && <Text style={{ fontSize: 11, color: colors.red }}>เลยเวลาแล้ว</Text>}
              </View>
              {busyId === d.id ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.dose} numberOfLines={1}>
                  {d.medication.dosage ?? ''}
                </Text>
              )}
            </Pressable>
          ))}
          {due.length > 0 && <Text style={styles.hint}>แตะยาที่กินแล้วเพื่อบันทึก</Text>}

          {later.length > 0 && (
            <>
              <Text style={[styles.title, { marginTop: space.lg }]}>{'ยาที่จะ\nมาถึง'}</Text>
              {later.map((d) => {
                const done = d.status !== 'pending';
                return (
                  <View key={d.id} style={[styles.laterPill, done && { opacity: 0.45 }]}>
                    <PillIcon size={26} tone="red" />
                    <Text style={styles.laterName} numberOfLines={1}>
                      {d.medication.name}
                      {d.medication.dosage ? ` | ${d.medication.dosage}` : ''}
                    </Text>
                    {d.status === 'taken' ? (
                      <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                    ) : (
                      <TimeCapsule time={timeOf(d.scheduledAt, tz)} />
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="ปิด" style={styles.close}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(44, 44, 50, 0.93)' },
  page: { padding: space.xl, paddingBottom: 120, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: space.sm,
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: 26,
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    minHeight: 64,
    boxShadow: shadow.float,
  },
  nextLabel: { fontSize: 10, fontWeight: '800', lineHeight: 11, color: colors.text },
  dueName: { fontSize: 16, fontWeight: '600', color: colors.text },
  dose: { fontSize: 12, fontWeight: '600', color: colors.text, maxWidth: 100 },
  hint: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  laterPill: {
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
  laterName: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  close: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xxl + 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.float,
  },
}));
