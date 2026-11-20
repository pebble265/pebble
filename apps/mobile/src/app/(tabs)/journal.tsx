import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../components/text';
import { useS } from '../../components/figma';
import { TAB_BAR_SPACE } from '../../components/tab-bar';
import { ErrorText } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { DAY_SHORT, moodOf } from '../../lib/format';
import { getLang, locale } from '../../lib/i18n';
import type { DoseHistory, MoodEntry, MoodList } from '../../lib/types';
import { colors, gradients, isDark } from '../../theme';
import { useTheme } from '../../lib/theme-mode';
import { UserPhoto } from '../../components/user-ui';

const GREEN = '#6CC870';
const PURPLE_LIGHT = '#6264E4';
/** the mood line, a little brighter on the dark background */
const purple = () => (isDark() ? '#8B8DFF' : PURPLE_LIGHT);
const RANGE = { week: 7, month: 30 } as const;
type Range = keyof typeof RANGE;

/** Mood is 1..7 in the app; the chart (like the design) uses a 1..5 scale. */
const to5 = (score: number) => 1 + ((score - 1) * 4) / 6;

function localDate(iso: string, tz?: string) {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function lastDays(n: number, tz?: string) {
  const today = localDate(new Date().toISOString(), tz);
  const base = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

const shortDate = (ymd: string) =>
  new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`));

/** Figma "pebble(a) - Journey": mood + medicine compliance chart and recent check-ins. */
export default function Journal() {
  useTheme();
  const s = useS();
  const [moods, setMoods] = useState<MoodList | null>(null);
  const [history, setHistory] = useState<DoseHistory | null>(null);
  const [range, setRange] = useState<Range>('week');
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<MoodEntry | null>(null);
  const [draft, setDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  async function saveNote() {
    if (!editing) return;
    setSavingNote(true);
    try {
      const updated = await api<MoodEntry>(`/moods/${editing.id}`, { method: 'PATCH', body: { note: draft.trim() } });
      setMoods((m) => m && { ...m, entries: m.entries.map((x) => (x.id === updated.id ? { ...x, note: updated.note } : x)) });
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSavingNote(false);
    }
  }
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([api<MoodList>('/moods?days=30'), api<DoseHistory>('/doses/history?days=30')]);
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

  const tz = moods?.timezone;
  const days = lastDays(RANGE[range], tz);
  const first = days[0];

  const entries = (moods?.entries ?? []).filter((e) => (e.date ?? localDate(e.createdAt, tz)) >= first);
  const moodByDay = days.map((d) => {
    const list = entries.filter((e) => (e.date ?? localDate(e.createdAt, tz)) === d);
    return list.length ? list.reduce((a, e) => a + to5(e.score), 0) / list.length : null;
  });
  const complianceByDay = days.map((d) => {
    const list = (history?.doses ?? []).filter((x) => localDate(x.scheduledAt, tz) === d && x.status !== 'pending');
    return list.length ? (list.filter((x) => x.status === 'taken').length / list.length) * 100 : null;
  });
  const avg = entries.length ? entries.reduce((a, e) => a + to5(e.score), 0) / entries.length : null;

  const recent = moods?.entries ?? [];
  const shown = showAll ? recent : recent.slice(0, 3);

  // chart geometry, in the design's coordinates relative to the card (card x=32, y=183)
  const X0 = 48;
  const X1 = 279;
  const Y_TOP = 84; // 5 / 100
  const Y_BOT = 216; // 1 / 0
  const xAt = (i: number) => X0 + (days.length === 1 ? 0 : (i * (X1 - X0)) / (days.length - 1));
  const yMood = (v: number) => Y_BOT - ((v - 1) / 4) * (Y_BOT - Y_TOP);
  const yPct = (v: number) => Y_BOT - (v / 100) * (Y_BOT - Y_TOP);

  const series = (values: (number | null)[], y: (v: number) => number, color: string, key: string) => {
    const pts = values.map((v, i) => (v == null ? null : { x: xAt(i), y: y(v) }));
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      if (!a) continue;
      const b = pts.slice(i + 1).find((p) => p); // join across empty days
      if (b) {
        const dx = s(b.x - a.x);
        const dy = s(b.y - a.y);
        const len = Math.hypot(dx, dy);
        out.push(
          <View
            key={`${key}l${i}`}
            style={{
              position: 'absolute',
              left: s((a.x + b.x) / 2) - len / 2,
              top: s((a.y + b.y) / 2) - s(1),
              width: len,
              height: s(2),
              borderRadius: s(1),
              backgroundColor: color,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />,
        );
      }
      out.push(
        <View
          key={`${key}p${i}`}
          style={{
            position: 'absolute',
            left: s(a.x - 3.5),
            top: s(a.y - 3.5),
            width: s(7),
            height: s(7),
            borderRadius: 999,
            backgroundColor: colors.surface,
            borderWidth: s(2),
            borderColor: color,
          }}
        />,
      );
    }
    return out;
  };

  const step = range === 'week' ? 1 : 5;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, backgroundImage: gradients.screen }}>
      <ScrollView alwaysBounceVertical={false}
        contentContainerStyle={{ paddingTop: s(102), paddingBottom: TAB_BAR_SPACE + 20 }}
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
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: s(45), paddingRight: s(37) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: s(18), fontWeight: '500', color: colors.ink }}>ความรู้สึกของคุณ เส้นทางของคุณ</Text>
            <Text style={{ fontSize: s(36), fontWeight: '700', color: colors.ink, letterSpacing: -0.5 }}>{getLang() === 'en' ? 'Journal' : 'บันทึก'}</Text>
          </View>
          <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button" accessibilityLabel="โปรไฟล์">
            <UserPhoto px={s(44)} />
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        {/* chart card */}
        <View
          style={{
            marginTop: s(16),
            marginLeft: s(32),
            width: s(338),
            height: s(268),
            borderRadius: s(24),
            backgroundColor: colors.surface,
            backgroundImage: gradients.cardFaint,
            boxShadow: '0 4px 28px rgba(0,0,0,0.08)',
          }}>
          <Text style={{ position: 'absolute', left: s(20), top: s(16), fontSize: s(11), color: colors.muted }}>อารมณ์เฉลี่ย</Text>
          <Text style={{ position: 'absolute', left: s(20), top: s(28), fontSize: s(32), fontWeight: '400', color: colors.ink }}>
            {avg == null ? '–' : avg.toFixed(1)}
          </Text>
          <Text style={{ position: 'absolute', right: s(22), top: s(16), fontSize: s(11), color: colors.muted }}>การกินยา %</Text>

          {[5, 4, 3, 2, 1].map((v, i) => {
            const y = yMood(v);
            return (
              <View key={v}>
                <Text style={{ position: 'absolute', left: s(20), top: s(y - 7), width: s(16), fontSize: s(10), color: colors.ink }}>{v}</Text>
                <View
                  style={{
                    position: 'absolute',
                    left: s(41),
                    width: s(243),
                    top: s(y),
                    height: 0,
                    borderTopWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: colors.line,
                  }}
                />
                <Text style={{ position: 'absolute', right: s(20), top: s(y - 7), fontSize: s(10), color: colors.ink, textAlign: 'right' }}>
                  {100 - i * 25}
                </Text>
              </View>
            );
          })}

          {days.map((d, i) =>
            i % step === 0 || i === days.length - 1 ? (
              <Text
                key={d}
                style={{ position: 'absolute', left: s(xAt(i) - 16), width: s(32), top: s(Y_BOT + 13), fontSize: s(9), fontWeight: '500', textAlign: 'center' }}>
                {range === 'week' ? DAY_SHORT[((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1] : Number(d.slice(8))}
              </Text>
            ) : null,
          )}

          {series(complianceByDay, yPct, GREEN, 'c')}
          {series(moodByDay, yMood, purple(), 'm')}

          {entries.length === 0 && complianceByDay.every((v) => v == null) && (
            <Text style={{ position: 'absolute', left: 0, right: 0, top: s(138), textAlign: 'center', fontSize: s(12), color: colors.faint }}>
              ยังไม่มีข้อมูลในช่วงนี้
            </Text>
          )}
        </View>

        {/* legend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: s(14), marginTop: s(10) }}>
          {[
            ['การกินยา %', GREEN],
            ['คะแนนอารมณ์', purple()],
          ].map(([t, c]) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), height: s(20), paddingHorizontal: s(12), borderRadius: 999, backgroundColor: colors.fill }}>
              <View style={{ width: s(10), height: s(2), backgroundColor: c }} />
              <View style={{ width: s(5), height: s(5), borderRadius: 999, borderWidth: 1, borderColor: c, marginLeft: s(-7.5), backgroundColor: colors.fill }} />
              <Text style={{ fontSize: s(9), color: colors.text, marginLeft: s(4) }}>{t}</Text>
            </View>
          ))}
        </View>

        {/* week / month */}
        <View
          style={{
            marginTop: s(12),
            marginLeft: s(45),
            width: s(308),
            height: s(34),
            borderRadius: 999,
            flexDirection: 'row',
            backgroundColor: colors.surface,
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          }}>
          {(['week', 'month'] as const).map((r) => {
            const on = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(on &&
                    (isDark()
                      ? { backgroundColor: '#4A4A52', backgroundImage: 'linear-gradient(180deg, #5A5A62 0%, #3E3E45 100%)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)' }
                      : { backgroundColor: '#B5B5B9', backgroundImage: 'linear-gradient(180deg, #C9C9CC 0%, #A7A7AB 100%)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12)' })),
                }}>
                <Text style={{ fontSize: s(15), fontWeight: '500', color: on ? '#FFF' : colors.ink }}>{r === 'week' ? 'สัปดาห์' : 'เดือน'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginTop: s(16), textAlign: 'center', fontSize: s(15), fontWeight: '500' }}>เช็กอินล่าสุด</Text>

        <View style={{ alignItems: 'center', gap: s(10), marginTop: s(10) }}>
          {moods && recent.length === 0 && (
            <Text style={{ fontSize: s(13), color: colors.muted, textAlign: 'center', paddingHorizontal: s(40) }}>
              ยังไม่มีการเช็กอิน กดอีโมจิที่หน้าหลักเพื่อบันทึกความรู้สึกได้ทุกวัน
            </Text>
          )}
          {shown.map((e) => {
            const m = moodOf(e.score);
            return (
              <Pressable
                key={e.id}
                onPress={() => {
                  setEditing(e);
                  setDraft(e.note ?? '');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${m?.label} ${e.note ?? 'ไม่ได้เขียนโน้ต'} แตะเพื่อแก้โน้ต`}
                style={{
                  width: s(329),
                  minHeight: s(48),
                  paddingVertical: s(7),
                  borderRadius: s(20),
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: s(22),
                  paddingRight: s(20),
                  backgroundColor: colors.surface,
                  backgroundImage: gradients.cardFaint,
                  boxShadow: '0 -2px 18px rgba(0,0,0,0.07)',
                }}>
                <Text style={{ fontSize: s(20) }}>{m?.emoji}</Text>
                <View style={{ flex: 1, marginLeft: s(14) }}>
                  <Text numberOfLines={2} style={{ fontSize: s(12.5), fontWeight: '700', color: e.note ? colors.ink : colors.faint }}>
                    {e.note || 'ไม่ได้เขียนโน้ต · แตะเพื่อเขียน'}
                  </Text>
                  <Text style={{ fontSize: s(9.5), fontWeight: '500', color: colors.ink }}>
                    {shortDate(e.date ?? localDate(e.createdAt, tz))}
                  </Text>
                </View>
                <Text style={{ fontSize: s(10.5), color: colors.muted, marginLeft: s(8) }}>อารมณ์{m?.label}</Text>
              </Pressable>
            );
          })}
          {recent.length > 3 && (
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.muted, paddingVertical: s(4) }}>
                {showAll ? 'ย่อ' : `ดูทั้งหมด (${recent.length})`}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* edit a check-in's note */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: s(24) }} onPress={() => setEditing(null)}>
            <Pressable onPress={() => {}} style={{ borderRadius: s(24), backgroundColor: colors.surface, padding: s(20), gap: s(12) }}>
              <Text style={{ fontSize: s(16), fontWeight: '700', color: colors.ink }}>
                {moodOf(editing?.score)?.emoji} โน้ตของวันที่ {editing ? shortDate(editing.date ?? localDate(editing.createdAt, tz)) : ''}
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                multiline
                maxLength={500}
                placeholder="วันนี้เป็นยังไงบ้าง"
                placeholderTextColor={colors.faint}
                accessibilityLabel="โน้ต"
                style={{ minHeight: s(90), borderRadius: s(14), backgroundColor: colors.fill, padding: s(12), fontSize: s(14), color: colors.ink, textAlignVertical: 'top', outlineWidth: 0 }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10) }}>
                <Pressable onPress={() => setEditing(null)} accessibilityRole="button" style={{ height: s(38), paddingHorizontal: s(16), justifyContent: 'center' }}>
                  <Text style={{ fontSize: s(14), color: colors.muted }}>ยกเลิก</Text>
                </Pressable>
                <Pressable
                  onPress={saveNote}
                  disabled={savingNote}
                  accessibilityRole="button"
                  style={{ height: s(38), paddingHorizontal: s(18), borderRadius: 999, backgroundColor: colors.primary, justifyContent: 'center' }}>
                  {savingNote ? <ActivityIndicator color={colors.primaryText} /> : <Text style={{ fontSize: s(14), fontWeight: '700', color: colors.primaryText }}>บันทึก</Text>}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
