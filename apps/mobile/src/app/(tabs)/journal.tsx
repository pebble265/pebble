import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE } from '../../components/tab-bar';
import { Card, EmptyState, ErrorText } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { longDate, moodOf, timeOf } from '../../lib/format';
import type { DoseHistory, MoodList } from '../../lib/types';
import { colors, gradients, shadow, space, type } from '../../theme';

/** Journal: the user's own mood check-ins and how medication went this week. */
export default function Journal() {
  const [moods, setMoods] = useState<MoodList | null>(null);
  const [history, setHistory] = useState<DoseHistory | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([api<MoodList>('/moods?days=14'), api<DoseHistory>('/doses/history?days=7')]);
      setMoods(m);
      setHistory(h);
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

  // Group by local date, newest first.
  const byDate = new Map<string, MoodList['entries']>();
  for (const e of moods?.entries ?? []) {
    const k = e.date ?? e.createdAt.slice(0, 10);
    byDate.set(k, [...(byDate.get(k) ?? []), e]);
  }
  const s = history?.summary;

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
        <Text style={type.title}>บันทึกของฉัน</Text>
        <ErrorText>{error}</ErrorText>

        <View style={styles.week}>
          <Text style={styles.weekTitle}>7 วันที่ผ่านมา</Text>
          <View style={{ flexDirection: 'row' }}>
            {[
              [s?.adherenceRate == null ? '–' : `${Math.round(s.adherenceRate * 100)}%`, 'กินตรงเวลา'],
              [String(s?.taken ?? '–'), 'กินแล้ว'],
              [String(s?.missed ?? '–'), 'พลาด'],
            ].map(([n, l]) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.weekNum}>{n}</Text>
                <Text style={styles.weekLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={type.heading}>ความรู้สึก 14 วัน</Text>
        {moods && byDate.size === 0 && (
          <EmptyState icon="happy-outline" title="ยังไม่มีบันทึก" text="เช็กอินความรู้สึกที่หน้าหลักได้ทุกวัน แล้วจะมาแสดงตรงนี้" />
        )}
        {[...byDate.entries()].map(([date, list]) => (
          <Card key={date} style={{ gap: space.sm }}>
            <Text style={type.label}>{longDate(date)}</Text>
            {list.map((e) => {
              const m = moodOf(e.score);
              return (
                <View key={e.id} style={styles.entry}>
                  <Text style={{ fontSize: 26 }}>{m?.emoji}</Text>
                  <Text style={[type.body, { flex: 1 }]}>{m?.label}</Text>
                  <Text style={type.small}>{timeOf(e.createdAt, moods?.timezone)}</Text>
                </View>
              );
            })}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, paddingBottom: TAB_BAR_SPACE + 10, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  week: {
    borderRadius: 24,
    padding: space.lg,
    gap: space.md,
    backgroundImage: gradients.summary,
    backgroundColor: '#D6BCE8',
    boxShadow: shadow.card,
  },
  weekTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  weekNum: { color: '#FFFFFF', fontWeight: '800', fontSize: 24 },
  weekLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
