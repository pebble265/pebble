import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, EmptyState, ErrorText } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { greeting, longDate, timeOf } from '../../lib/format';
import type { Dose, DoseHistory, TodayDoses } from '../../lib/types';
import { colors, radius, space, type } from '../../theme';

const STATUS = {
  pending: { label: 'รอกิน', tone: 'primary', icon: 'time-outline' },
  taken: { label: 'กินแล้ว', tone: 'success', icon: 'checkmark-circle' },
  skipped: { label: 'ข้าม', tone: 'neutral', icon: 'remove-circle-outline' },
  missed: { label: 'พลาด', tone: 'warn', icon: 'alert-circle-outline' },
} as const;

function DoseCard({
  dose,
  tz,
  onChanged,
}: {
  dose: Dose;
  tz: string;
  onChanged(d: Dose): void;
}) {
  const [busy, setBusy] = useState<'take' | 'skip' | null>(null);
  const [error, setError] = useState('');
  const s = STATUS[dose.status];
  // The backend refuses "taken" more than 1 hour early, so don't offer it yet.
  const tooEarly = new Date(dose.scheduledAt).getTime() - Date.now() > 60 * 60 * 1000;
  const canAct = (dose.status === 'pending' && !tooEarly) || dose.status === 'missed';

  async function act(kind: 'take' | 'skip') {
    setBusy(kind);
    setError('');
    try {
      onChanged(await api<Dose>(`/doses/${dose.id}/${kind}`, { method: 'POST', body: { via: 'app' } }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={dose.status === 'taken' ? { opacity: 0.75 } : undefined}>
      <View style={styles.doseTop}>
        <Text style={styles.time}>{timeOf(dose.scheduledAt, tz)}</Text>
        <Chip label={s.label} tone={s.tone} icon={s.icon} />
      </View>
      <Text style={type.heading}>{dose.medication.name}</Text>
      {dose.medication.dosage ? <Text style={type.body}>{dose.medication.dosage}</Text> : null}
      {dose.medication.instructions ? (
        <Text style={type.small}>{dose.medication.instructions}</Text>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {dose.status === 'pending' && tooEarly && (
        <Text style={type.small}>Pebble จะเตือนเมื่อถึงเวลา</Text>
      )}
      {canAct && (
        <View style={styles.actions}>
          <Button
            title="กินแล้ว"
            icon="checkmark"
            onPress={() => act('take')}
            loading={busy === 'take'}
            disabled={!!busy}
            style={{ flex: 1 }}
          />
          {dose.status === 'pending' && (
            <Button
              title="ข้าม"
              variant="ghost"
              onPress={() => act('skip')}
              loading={busy === 'skip'}
              disabled={!!busy}
            />
          )}
        </View>
      )}
    </Card>
  );
}

export default function Today() {
  const { user } = useAuth();
  const [today, setToday] = useState<TodayDoses | null>(null);
  const [history, setHistory] = useState<DoseHistory | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api<TodayDoses>('/doses/today'),
        api<DoseHistory>('/doses/history?days=7'),
      ]);
      setToday(t);
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

  const tz = today?.timezone ?? user?.timezone ?? 'Asia/Bangkok';
  const doses = today?.doses ?? [];
  const pending = doses.filter((d) => d.status === 'pending').length;
  const rate = history?.summary.adherenceRate;

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
        <View style={{ gap: 4 }}>
          <Text style={type.small}>{today ? longDate(today.date) : ' '}</Text>
          <Text style={type.title}>
            {greeting(tz)} {user?.displayName}
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{pending}</Text>
            <Text style={styles.statLabel}>ยาที่รอกินวันนี้</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>
              {rate == null ? '–' : `${Math.round(rate * 100)}%`}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>กินตรงเวลา 7 วัน</Text>
          </View>
        </View>

        <ErrorText>{error}</ErrorText>

        <Card style={styles.chatCta}>
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
          <Text style={[type.body, { flex: 1 }]}>วันนี้เป็นยังไงบ้าง? เล่าให้ Pebble ฟังได้นะ</Text>
          <Button title="คุยเลย" small variant="secondary" onPress={() => router.navigate('/chat')} />
        </Card>

        <Text style={type.heading}>ยาวันนี้</Text>
        {today && doses.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="วันนี้ไม่มียาที่ต้องกิน"
            text="ถ้าต้องกินยาประจำ เพิ่มยาไว้ Pebble จะช่วยเตือนให้"
            action={<Button title="เพิ่มยา" icon="add" onPress={() => router.push('/medication-new')} />}
          />
        ) : (
          doses.map((d) => (
            <DoseCard
              key={d.id}
              dose={d}
              tz={tz}
              onChanged={(nd) => {
                setToday((t) => t && { ...t, doses: t.doses.map((x) => (x.id === nd.id ? nd : x)) });
                api<DoseHistory>('/doses/history?days=7').then(setHistory).catch(() => {});
              }}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  summary: { flexDirection: 'row', gap: space.md },
  stat: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNum: { fontSize: 30, fontWeight: '700', color: colors.primaryText },
  statLabel: { fontSize: 13, color: colors.primarySoft },
  chatCta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  doseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 22, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
