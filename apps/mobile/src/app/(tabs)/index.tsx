import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import { Text } from '../../components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarHeight } from '../../components/tab-bar';
import { Card, ErrorText, PillIcon, RobotFace, TimeCapsule } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { syncMedAlarms } from '../../lib/med-alarms';
import { moodFlow } from '../../lib/mood-flow';
import { greetingWithIcon, MOODS, moodOf, timeOf } from '../../lib/format';
import { readHealthToday } from '../../lib/health';
import type { Device, DoseHistory, Medication, MoodEntry, MoodList, TodayDoses } from '../../lib/types';
import { colors, gradients, radius, shadow, space, themedStyles, type } from '../../theme';
import { useTheme } from '../../lib/theme-mode';

/** First letter for the avatar. Skips Thai leading vowels: "เอิร์ธ" -> "อ". */
function initial(name: string) {
  return ([...name.trim()].find((c) => !/[เ-ไ]/.test(c)) ?? '?').toUpperCase();
}

/** Battery ring around Pebble's face, filled by quarters (no SVG needed). */
function BatteryRing({ level, children, size = 92 }: { level: number | null; children: ReactNode; size?: number }) {
  const q = level == null ? 0 : Math.ceil(level / 25);
  const on = level != null && level <= 20 ? colors.red : colors.online;
  const off = '#E3E3E8';
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderTopColor: q >= 1 ? on : off,
            borderRightColor: q >= 2 ? on : off,
            borderBottomColor: q >= 3 ? on : off,
            borderLeftColor: q >= 4 ? on : off,
          },
        ]}
      />
      {children}
    </View>
  );
}

function RobotCard({ device, robotName, compact }: { device: Device | null; robotName: string; compact: boolean }) {
  const online = device && ['online', 'charging'].includes(device.status);
  return (
    <Pressable onPress={() => router.navigate('/robot')} accessibilityRole="button">
      <Card style={compact ? [styles.robotCard, { paddingVertical: 12 }] : styles.robotCard}>
        <BatteryRing level={device?.batteryLevel ?? null} size={compact ? 76 : 92}>
          <RobotFace size={compact ? 52 : 64} awake={!!online} />
        </BatteryRing>
        <View style={styles.vr} />
        <View style={{ flex: 1, gap: 2 }}>
          {device ? (
            <>
              <View style={styles.row}>
                <Ionicons
                  name={device.status === 'charging' ? 'battery-charging' : 'battery-half'}
                  size={16}
                  color={colors.text}
                />
                <Text style={type.label}>{device.batteryLevel != null ? `${device.batteryLevel}%` : '–'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.robotName}>{robotName}</Text>
                <View style={[styles.dot, { backgroundColor: online ? colors.online : colors.muted }]} />
                <Text style={{ fontSize: 12, color: online ? colors.online : colors.muted }}>
                  {online ? 'ออนไลน์' : 'ออฟไลน์'}
                </Text>
              </View>
              <Text style={type.small}>{online ? 'เชื่อมต่ออยู่' : 'หุ่นไม่ได้เชื่อมต่อ ลองเช็ก WiFi'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.robotName}>pebble(a)</Text>
              <Text style={type.small}>ยังไม่ได้จับคู่หุ่น</Text>
              <View style={[styles.row, { marginTop: 4 }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.blue }}>จับคู่หุ่น</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.blue} />
              </View>
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  useTheme();
  const { user } = useAuth();
  const [today, setToday] = useState<TodayDoses | null>(null);
  const [history, setHistory] = useState<DoseHistory | null>(null);
  const [moods, setMoods] = useState<MoodList | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [robotName, setRobotName] = useState('pebble(a)');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [moodBusy, setMoodBusy] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  const [meds, setMeds] = useState<Medication[] | null>(null);

  // Fit the page between the greeting and the tab bar when possible, so it doesn't scroll for nothing.
  // If the normal layout is taller than the room, a compact one (tighter gaps, smaller robot ring) is used;
  // if even that doesn't fit (small phones), the page scrolls.
  const barH = useTabBarHeight();
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [compact, setCompact] = useState(false);
  const normalH = useRef(0); // content height in the normal layout
  const saving = useRef(0); // how much shorter the compact layout is
  const padTop = compact ? 6 : space.lg;
  const padBottom = barH + 12;
  const room = viewH - padTop - padBottom;
  const roomNormal = viewH - space.lg - padBottom;
  useEffect(() => {
    if (!viewH || !contentH) return;
    if (!compact) {
      normalH.current = contentH;
      if (contentH > roomNormal) setCompact(true);
    } else {
      if (!saving.current && normalH.current > contentH) saving.current = normalH.current - contentH;
      // e.g. a taller phone after rotation, or a card got shorter: go back to the roomy layout if it fits now
      if (saving.current && contentH + saving.current <= roomNormal) {
        saving.current = 0;
        setCompact(false);
      }
    }
  }, [viewH, contentH, roomNormal, compact]);
  const scrolls = !viewH || !contentH || contentH > room + 1;

  const load = useCallback(async () => {
    let todayDoses: TodayDoses | null = null;
    try {
      const [t, h, m] = await Promise.all([
        api<TodayDoses>('/doses/today'),
        api<DoseHistory>('/doses/history?days=7'),
        api<MoodList>('/moods?days=1').catch(() => null),
      ]);
      setToday(t);
      todayDoses = t;
      setHistory(h);
      setMoods(m);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
    // Today's doses can be empty even with meds (times already passed when the med was added,
    // or today isn't one of its days), so the card also needs the med list itself.
    api<Medication[]>('/medications')
      .then((m) => {
        setMeds(m);
        void syncMedAlarms(m, todayDoses); // alarm-clock reminders on this phone
      })
      .catch(() => {});
    // Robot info is nice-to-have: never block the screen on it.
    api<Device[]>('/devices').then((d) => setDevice(d[0] ?? null)).catch(() => {});
    api<{ robotName: string }>('/robot-settings').then((s) => setRobotName(s.robotName)).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Steps from Apple Health / Health Connect; permission is asked on the brief screen.
      readHealthToday(false).then((h) => setSteps(h.steps)).catch(() => {});
    }, [load]),
  );

  async function pickMood(score: number) {
    router.push({ pathname: '/feel', params: { score: String(score) } });
    setMoodBusy(true);
    const prev = moods;
    setMoods((m) => ({
      timezone: m?.timezone ?? '',
      entries: m?.entries ?? [],
      today: { id: 'tmp', score, label: moodOf(score)!.label, source: 'app', createdAt: new Date().toISOString() },
    }));
    const request = api<MoodEntry>('/moods', { method: 'POST', body: { score } });
    moodFlow.pending = request.catch(() => null); // the Feel screen attaches a note to this
    try {
      const saved = await request;
      setMoods((m) => m && { ...m, today: saved });
    } catch (e) {
      setMoods(prev);
      setError(errorText(e));
    } finally {
      setMoodBusy(false);
    }
  }



  const tz = today?.timezone ?? user?.timezone ?? 'Asia/Bangkok';
  const doses = today?.doses ?? [];
  const pending = doses.filter((d) => d.status === 'pending' || d.status === 'missed');
  const next = pending[0];
  const taken = doses.filter((d) => d.status === 'taken').length;
  const todayMood = moodOf(moods?.today?.score);
  const upcoming = next ? null : upcomingDose(meds ?? []);
  const hasMeds = (meds?.length ?? 0) > 0 || doses.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView alwaysBounceVertical={false}
        scrollEnabled={scrolls}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        contentContainerStyle={[styles.page, { paddingTop: padTop, paddingBottom: padBottom }]}
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
        <View onLayout={(e) => setContentH(e.nativeEvent.layout.height)} style={{ gap: compact ? 10 : space.lg }}>
        {/* Greeting */}
        <View style={[styles.header, compact && { marginTop: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: colors.text }}>{greetingWithIcon(tz)}</Text>
            <Text style={type.hero} numberOfLines={1}>
              {user?.displayName}
            </Text>
          </View>
          <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button" accessibilityLabel="โปรไฟล์" style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%', borderRadius: 999 }} accessibilityIgnoresInvertColors />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{initial(user?.displayName ?? '')}</Text>
            )}
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        <RobotCard device={device} robotName={robotName} compact={compact} />

        {/* Next up */}
        <View>
          {pending.length > 1 && <View style={styles.stackPlate} />}
          <Pressable
            onPress={() =>
              doses.length ? router.push('/schedule') : hasMeds ? router.navigate('/meds') : router.push('/medication-new')
            }
            accessibilityRole="button"
            accessibilityLabel={next ? `ยาถัดไป ${next.medication.name}` : upcoming ? `ยาถัดไป ${upcoming.med.name} ${upcoming.when} ${upcoming.time}` : 'ยา'}>
            <Card style={styles.nextCard}>
              {next ? (
                <>
                  <Text style={styles.nextLabel}>{'ยา\nถัดไป'}</Text>
                  <TimeCapsule time={timeOf(next.scheduledAt, tz)} vertical />
                  <PillIcon size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName} numberOfLines={1}>
                      {next.medication.name}
                    </Text>
                    {next.status === 'missed' && <Text style={{ fontSize: 12, color: colors.red }}>เลยเวลาแล้ว</Text>}
                  </View>
                  {next.medication.dosage ? (
                    <Text style={{ fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {next.medication.dosage}
                    </Text>
                  ) : null}
                </>
              ) : upcoming ? (
                <>
                  <Text style={styles.nextLabel}>{'ยา\nถัดไป'}</Text>
                  <TimeCapsule time={upcoming.time} vertical />
                  <PillIcon size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName} numberOfLines={1}>
                      {upcoming.med.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                      {doses.length ? 'วันนี้กินครบแล้ว 🎉 · ' : ''}
                      {upcoming.when}
                    </Text>
                  </View>
                  {upcoming.med.dosage ? (
                    <Text style={{ fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {upcoming.med.dosage}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <PillIcon size={34} tone="white" />
                  <Text style={[type.label, { flex: 1 }]}>
                    {doses.length ? 'วันนี้กินยาครบแล้ว เก่งมาก 🎉' : hasMeds ? 'วันนี้ไม่มียาที่ต้องกิน' : 'ยังไม่มียา แตะเพื่อเพิ่มยา'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </>
              )}
            </Card>
          </Pressable>
        </View>

        {/* Quick emotional check-in */}
        <Card style={{ backgroundImage: gradients.mood, gap: compact ? space.sm : space.md, ...(compact && { paddingVertical: 12 }) }}>
          <View>
            <Text style={type.heading}>เช็กอินความรู้สึก</Text>
            <Text style={type.small}>ตอนนี้รู้สึกยังไงบ้าง</Text>
          </View>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = moods?.today?.score === m.score;
              return (
                <Pressable
                  key={m.score}
                  onPress={() => pickMood(m.score)}
                  disabled={moodBusy}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: active }}
                  style={[styles.moodBtn, active && styles.moodActive]}>
                  <Text style={{ fontSize: active ? 28 : 24 }}>{m.emoji}</Text>
                </Pressable>
              );
            })}
          </View>
          {todayMood && (
            <Text style={[type.small, { textAlign: 'center' }]}>
              บันทึกแล้ว: {todayMood.label}
              {todayMood.score <= 2 ? ' · อยากเล่าให้ Pebbi ฟังไหม? แตะ Pebbi ด้านล่างได้เลย' : ''}
            </Text>
          )}
        </Card>

        {/* Today summary (tap for the full brief) */}
        <Pressable
          onPress={() => router.push('/brief')}
          accessibilityRole="button"
          accessibilityLabel="สรุปวันนี้"
          style={({ pressed }) => [styles.summary, compact && { paddingVertical: 12, gap: 10 }, pressed && { opacity: 0.9 }]}>
          <View style={styles.summaryHead}>
            <View style={styles.summaryIcon}>
              <MaterialCommunityIcons name="weather-sunset-up" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.summaryTitle}>สรุปวันนี้</Text>
              <Text style={styles.summarySub}>ไฮไลต์ของวันนี้</Text>
            </View>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>
                <MaterialCommunityIcons name="pill" size={18} color="#FFFFFF" /> {taken}/{doses.length}
              </Text>
              <Text style={styles.statLabel}>กินยาแล้ว</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>
                {todayMood ? `${todayMood.emoji} ${todayMood.label}` : '–'}
              </Text>
              <Text style={styles.statLabel}>อารมณ์วันนี้</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, { flex: 0.8 }]}>
              <Text style={styles.statNum}>
                <MaterialCommunityIcons name="shoe-sneaker" size={18} color="#FFFFFF" />{' '}
                {steps == null ? '–' : steps.toLocaleString('en-US')}
              </Text>
              <Text style={styles.statLabel}>ก้าววันนี้</Text>
            </View>
          </View>
        </Pressable>

        {/* Quick chat */}
        <View style={[styles.chatCard, compact && { paddingTop: 16, paddingBottom: 12, gap: space.sm }]}>
          <MaterialCommunityIcons name="star-four-points" size={34} color={colors.text} style={styles.sparkle} />
          <Text style={[type.heading, { fontSize: 17 }]}>คุยกับ Pebbi สั้น ๆ ไหม?</Text>
          {/* Tapping opens the Quick Chat overlay (keyboard + conversation over a blurred Home). */}
          <Pressable
            onPress={() => router.push('/quick-chat')}
            accessibilityRole="button"
            accessibilityLabel="พิมพ์ข้อความถึง Pebbi"
            style={styles.chatRow}>
            <View style={[styles.chatInput, { justifyContent: 'center' }]}>
              <Text style={{ fontSize: 15, color: '#A6A6AE' }} numberOfLines={1}>
                พื้นที่ของคุณ ความคิดของคุณ
              </Text>
            </View>
            <View style={styles.send}>
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundImage: gradients.robot,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    boxShadow: shadow.soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  robotCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: 22 },
  ringWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 7,
    transform: [{ rotate: '45deg' }],
  },
  vr: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: space.sm },
  robotName: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stackPlate: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: -7,
    height: 30,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    opacity: 0.7,
    boxShadow: shadow.soft,
  },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderRadius: 28 },
  nextLabel: { fontSize: 11, fontWeight: '800', lineHeight: 12, color: colors.text },
  medName: { fontSize: 17, fontWeight: '600', color: colors.text },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  moodActive: { backgroundColor: colors.surface, boxShadow: shadow.soft, transform: [{ scale: 1.1 }] },
  summary: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
    backgroundImage: gradients.summary,
    backgroundColor: '#D6BCE8',
    boxShadow: shadow.card,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundImage: 'linear-gradient(180deg, #6F7BF7 0%, #F0707A 100%)',
    backgroundColor: '#8F7BE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  summarySub: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  summaryStats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.6)' },
  chatCard: {
    borderRadius: radius.lg,
    padding: space.lg,
    paddingTop: 22,
    gap: space.md,
    backgroundImage: gradients.chat,
    backgroundColor: '#EEF2FF',
    boxShadow: shadow.card,
  },
  sparkle: { position: 'absolute', left: -6, top: -14 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chatInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** The next scheduled time (after now, within a week) across all active meds. */
function upcomingDose(meds: Medication[]): { med: Medication; time: string; when: string } | null {
  const now = new Date();
  let best: { at: number; med: Medication; time: string; offset: number } | null = null;
  for (const med of meds) {
    if (!med.isActive) continue;
    for (const sc of med.schedules) {
      const [hh, mm] = sc.time.split(':').map(Number);
      for (let offset = 0; offset <= 7; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hh, mm);
        if (d <= now) continue;
        const iso = ((d.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun, same as the API
        if (sc.daysOfWeek.length && !sc.daysOfWeek.includes(iso)) continue;
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (ymd < sc.startDate.slice(0, 10) || (sc.endDate && ymd > sc.endDate.slice(0, 10))) continue;
        if (!best || d.getTime() < best.at) best = { at: d.getTime(), med, time: sc.time.slice(0, 5), offset };
        break;
      }
    }
  }
  if (!best) return null;
  const when =
    best.offset === 0 ? 'วันนี้' : best.offset === 1 ? 'พรุ่งนี้' : `วัน${DAY_TH[new Date(best.at).getDay()]}`;
  return { med: best.med, time: best.time, when };
}
