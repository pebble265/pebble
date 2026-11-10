import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeWheel } from '../components/time-wheel';
import { Button, ErrorText, Field } from '../components/ui';
import { api, errorText } from '../lib/api';
import { DAY_SHORT } from '../lib/format';
import { colors, gradients, type Period, PERIODS, radius, shadow, space, type } from '../theme';

const ALL = [1, 2, 3, 4, 5, 6, 7];

/** Names only (no advice): a shortcut so people don't have to spell them. */
const COMMON = ['Fluoxetine', 'Sertraline', 'Escitalopram', 'Paroxetine', 'Venlafaxine', 'Mirtazapine', 'Amitriptyline', 'Bupropion'];

function BackButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" style={styles.back}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

export default function NewMedication() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pills, setPills] = useState('');
  // One time per selected period, e.g. { morning: '08:00', night: '21:00' }
  const [times, setTimes] = useState<Partial<Record<Period, string>>>({ morning: '08:00' });
  const [editing, setEditing] = useState<Period>('morning');
  const [everyDay, setEveryDay] = useState(true);
  const [days, setDays] = useState<number[]>(ALL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const suggestions = COMMON.filter((c) => c.toLowerCase().includes(name.trim().toLowerCase()) && c !== name.trim());

  function next() {
    if (!name.trim()) return setError('กรอกชื่อยา หรือเลือกจากรายการ');
    const n = pills.trim() ? Number(pills) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 0)) return setError('จำนวนเม็ดคงเหลือต้องเป็นตัวเลข');
    setError('');
    setStep(2);
  }

  function togglePeriod(p: Period) {
    const def = PERIODS.find((x) => x.key === p)!.defaultTime;
    if (!times[p]) {
      setTimes((t) => ({ ...t, [p]: def }));
      setEditing(p);
    } else if (editing !== p) {
      setEditing(p); // first tap on a selected chip edits it, second removes it
    } else {
      const rest = { ...times };
      delete rest[p];
      setTimes(rest);
      const left = PERIODS.find((x) => rest[x.key]);
      if (left) setEditing(left.key);
    }
  }

  async function save() {
    const list = PERIODS.map((p) => times[p.key]).filter((t): t is string => !!t);
    if (!list.length) return setError('เลือกอย่างน้อย 1 ช่วงเวลา');
    if (new Set(list).size !== list.length) return setError('มีเวลาซ้ำกัน');
    const useDays = everyDay ? ALL : days;
    if (!useDays.length) return setError('เลือกอย่างน้อย 1 วัน');
    const pillsNum = pills.trim() ? Number(pills) : undefined;

    setBusy(true);
    setError('');
    try {
      await api('/medications', {
        method: 'POST',
        body: {
          name: name.trim(),
          ...(dosage.trim() && { dosage: dosage.trim() }),
          ...(instructions.trim() && { instructions: instructions.trim() }),
          ...(pillsNum !== undefined && { pillsRemaining: pillsNum }),
          schedules: list.sort().map((time) => ({ time, ...(useDays.length < 7 && { daysOfWeek: useDays }) })),
        },
      });
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const editingTime = times[editing];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => (step === 2 ? setStep(1) : router.back())} />

          {step === 1 ? (
            <>
              <View style={styles.head}>
                <MaterialCommunityIcons name="pill" size={48} color={colors.text} style={{ transform: [{ rotate: '-35deg' }] }} />
                <Text style={styles.title}>{'ใส่ชื่อยา\nหรือพิมพ์ค้นหา'}</Text>
              </View>

              <View style={styles.darkInput}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="ชื่อยา"
                  placeholderTextColor="#B8B8BE"
                  style={styles.darkText}
                  autoCapitalize="words"
                  maxLength={200}
                  accessibilityLabel="ชื่อยา"
                  autoFocus
                />
                <MaterialCommunityIcons name="pill" size={20} color="#FFFFFF" />
              </View>

              {suggestions.length > 0 && (
                <>
                  <Text style={[type.small, { textAlign: 'center' }]}>หรือเลือกจากรายการนี้</Text>
                  <View style={{ gap: space.sm }}>
                    {suggestions.slice(0, 5).map((c, i) => (
                      <Pressable
                        key={c}
                        onPress={() => setName(c)}
                        accessibilityRole="button"
                        style={[styles.suggest, { marginHorizontal: i * 8, opacity: 1 - i * 0.14 }]}>
                        <Text style={styles.suggestText}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={{ gap: space.md, marginTop: space.md }}>
                <Field label="ขนาดที่กิน (ไม่บังคับ)" value={dosage} onChangeText={setDosage} placeholder="เช่น 20 mg / 1 เม็ด" maxLength={200} />
                <Field label="วิธีกิน (ไม่บังคับ)" value={instructions} onChangeText={setInstructions} placeholder="เช่น หลังอาหาร" maxLength={1000} />
                <Field
                  label="จำนวนเม็ดคงเหลือ (ไม่บังคับ)"
                  value={pills}
                  onChangeText={setPills}
                  keyboardType="number-pad"
                  placeholder="เช่น 30"
                  hint="Pebble จะเตือนเมื่อยาใกล้หมด"
                />
              </View>
              <ErrorText>{error}</ErrorText>
              <Button title="ถัดไป · ตั้งเวลากินยา" onPress={next} />
            </>
          ) : (
            <>
              <View style={styles.head}>
                <Ionicons name="time-outline" size={46} color={colors.text} />
                <Text style={styles.title}>{'ตั้งเวลา\nกินยา'}</Text>
                <Text style={type.small}>{name}</Text>
              </View>

              {editingTime ? (
                <TimeWheel value={editingTime} onChange={(v) => setTimes((t) => ({ ...t, [editing]: v }))} />
              ) : (
                <Text style={[type.small, { textAlign: 'center', paddingVertical: space.xl }]}>เลือกช่วงเวลาด้านล่างก่อน</Text>
              )}

              <Text style={[type.small, { textAlign: 'center', color: colors.text }]}>กินยาช่วงไหน</Text>
              <View style={styles.periods}>
                {PERIODS.map((p) => {
                  const on = !!times[p.key];
                  const night = p.key === 'night';
                  const isEditing = on && editing === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => togglePeriod(p.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${p.label}${on ? ` ${times[p.key]}` : ''}`}
                      style={{ alignItems: 'center', gap: 4 }}>
                      <View
                        style={[
                          styles.periodBox,
                          on && (night ? { backgroundColor: colors.night } : { backgroundImage: gradients.sun, backgroundColor: colors.sun }),
                          isEditing && styles.periodEditing,
                        ]}>
                        <MaterialCommunityIcons name={p.icon} size={22} color={on ? (night ? '#FFFFFF' : '#5B4300') : '#A0A0A8'} />
                      </View>
                      <Text style={{ fontSize: 11, color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '400' }}>{p.label}</Text>
                      <Text style={{ fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] }}>{times[p.key] ?? ' '}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[type.small, { textAlign: 'center' }]}>แตะช่วงที่เลือกแล้วเพื่อแก้เวลา แตะซ้ำเพื่อเอาออก</Text>

              <View style={styles.rows}>
                <View style={styles.row}>
                  <Text style={type.body}>กินทุกวัน</Text>
                  <Switch value={everyDay} onValueChange={setEveryDay} trackColor={{ true: colors.online }} />
                </View>
                {!everyDay && (
                  <View style={[styles.row, { justifyContent: 'center', gap: 6, flexWrap: 'wrap' }]}>
                    {ALL.map((d) => {
                      const on = days.includes(d);
                      return (
                        <Pressable
                          key={d}
                          onPress={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d].sort()))}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          style={[styles.day, on && { backgroundColor: colors.text }]}>
                          <Text style={{ color: on ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{DAY_SHORT[d]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <ErrorText>{error}</ErrorText>
              <Button title="บันทึกยา" leadingArrow onPress={save} loading={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  back: { width: 36, height: 36, justifyContent: 'center' },
  head: { alignItems: 'center', gap: space.sm },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.6 },
  darkInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3C3C42',
    borderRadius: 14,
    paddingHorizontal: space.lg,
    height: 52,
    gap: space.sm,
    boxShadow: shadow.soft,
  },
  darkText: { flex: 1, color: '#FFFFFF', fontSize: 16, outlineWidth: 0 },
  suggest: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    backgroundImage: gradients.pill,
    backgroundColor: colors.blue,
    boxShadow: shadow.soft,
  },
  suggestText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  periods: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  periodBox: {
    width: 52,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E4E4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodEditing: { borderWidth: 2, borderColor: colors.text },
  rows: { backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingHorizontal: space.lg, boxShadow: shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50 },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
