import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, confirm, EmptyState, ErrorText } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { daysLabel } from '../../lib/format';
import type { Medication } from '../../lib/types';
import { colors, space, type } from '../../theme';

export default function Meds() {
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setMeds(await api<Medication[]>('/medications'));
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
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
        <View style={styles.headerRow}>
          <Text style={type.title}>ยาของฉัน</Text>
          <Button title="เพิ่มยา" icon="add" small onPress={() => router.push('/medication-new')} />
        </View>
        <ErrorText>{error}</ErrorText>

        {meds && meds.length === 0 && (
          <EmptyState
            icon="medkit-outline"
            title="ยังไม่มียา"
            text="เพิ่มยาที่กินประจำ แล้ว Pebble จะเตือนเมื่อถึงเวลา"
          />
        )}

        {meds?.map((m) => (
          <Card key={m.id}>
            <View style={styles.headerRow}>
              <Text style={[type.heading, { flex: 1 }]}>{m.name}</Text>
              <Pressable
                onPress={() => remove(m)}
                accessibilityRole="button"
                accessibilityLabel={`ลบ ${m.name}`}
                hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
            {m.dosage ? <Text style={type.body}>{m.dosage}</Text> : null}
            {m.instructions ? <Text style={type.small}>{m.instructions}</Text> : null}
            <View style={styles.chips}>
              {m.schedules.map((s) => (
                <Chip key={s.id} label={`${s.time} · ${daysLabel(s.daysOfWeek)}`} tone="primary" icon="alarm-outline" />
              ))}
              {m.schedules.length === 0 && <Chip label="ไม่ได้ตั้งเวลา" />}
            </View>
            {m.pillsRemaining != null && (
              <Text style={[type.small, m.pillsRemaining <= 5 && { color: colors.warn, fontWeight: '600' }]}>
                เหลือ {m.pillsRemaining} เม็ด{m.pillsRemaining <= 5 ? ' · ใกล้หมดแล้ว' : ''}
              </Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
