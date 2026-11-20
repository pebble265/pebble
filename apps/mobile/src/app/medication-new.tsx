import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Text, TextInput } from '../components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedPicker, MEDS } from '../components/med-picker';
import { DosageTimes } from '../components/dosage-times';
import { Button, ErrorText, Field, confirm } from '../components/ui';
import { api, errorText } from '../lib/api';
import { colors, gradients, type Period, periodOf, PERIODS, shadow, space, themedStyles, type } from '../theme';
import type { MedicalData, Medication } from '../lib/types';
import { useTheme } from '../lib/theme-mode';

const ALL = [1, 2, 3, 4, 5, 6, 7];

/** Names only (no advice): a shortcut so people don't have to spell them. */

function BackButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" style={styles.back}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

/** Add a medicine, or edit one with ?id=… (&step=2 opens straight on the times). */
export default function NewMedication() {
  useTheme();
  const params = useLocalSearchParams<{ id?: string; step?: string }>();
  const editId = params.id;
  const [step, setStep] = useState<1 | 2>(params.step === '2' ? 2 : 1);
  const [loaded, setLoaded] = useState(!editId);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pills, setPills] = useState('');
  // One time per selected period, e.g. { morning: '08:00', night: '21:00' }
  const [times, setTimes] = useState<Partial<Record<Period, string>>>({ morning: '08:00' });
  const [editing, setEditing] = useState<Period>('morning');
  const [everyDay, setEveryDay] = useState(true);
  const [days, setDays] = useState<number[]>(ALL);
  const [sound, setSound] = useState('radial');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Editing: fill the form from the saved medicine.
  useEffect(() => {
    if (!editId) return;
    api<Medication>(`/medications/${editId}`)
      .then((m) => {
        setName(m.name);
        setDosage(m.dosage ?? '');
        setInstructions(m.instructions ?? '');
        setPills(m.pillsRemaining == null ? '' : String(m.pillsRemaining));
        if (m.sound) setSound(m.sound);
        const t: Partial<Record<Period, string>> = {};
        for (const sc of m.schedules) {
          const hhmm = sc.time.slice(0, 5);
          // two times in the same part of the day: use the next free slot
          const slot = [periodOf(hhmm), ...PERIODS.map((p) => p.key)].find((p) => !t[p]);
          if (slot) t[slot] = hhmm;
        }
        if (Object.keys(t).length) {
          setTimes(t);
          setEditing(PERIODS.find((p) => t[p.key])!.key);
        }
        const d = m.schedules[0]?.daysOfWeek ?? ALL;
        setEveryDay(d.length === 7);
        setDays(d);
        setLoaded(true);
      })
      .catch((e) => setError(errorText(e)));
  }, [editId]);

  const query = name.trim().toLowerCase();
  const suggestions = MEDS.filter((m) => m.name.toLowerCase().includes(query) && m.name.toLowerCase() !== query);

  /**
   * Safety check before the times step: does the name match something the user said they're
   * allergic to (Profile → ข้อมูลทางการแพทย์)? Asks before going on. Only for new medicines.
   */
  async function allergyOk() {
    if (editId) return true;
    const allergies = await api<MedicalData>('/medical').then((m) => m.allergies).catch(() => [] as string[]);
    const n = name.trim().toLowerCase();
    const hit = allergies.find((a) => {
      const x = a.trim().toLowerCase();
      return x.length >= 3 && (n.includes(x) || x.includes(n));
    });
    if (!hit) return true;
    return confirm(
      `คุณบันทึกไว้ว่าแพ้ ${hit}`,
      'ยานี้ชื่อตรงกับยาที่คุณแพ้ ปรึกษาแพทย์หรือเภสัชกรก่อนกินนะ ยังจะเพิ่มยานี้ไหม?',
      'เพิ่มต่อ',
    );
  }

  async function next() {
    if (!name.trim()) return setError('กรอกชื่อยา หรือเลือกจากรายการ');
    const n = pills.trim() ? Number(pills) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 0)) return setError('จำนวนเม็ดคงเหลือต้องเป็นตัวเลข');
    setError('');
    if (!(await allergyOk())) return;
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
      await api(editId ? `/medications/${editId}` : '/medications', {
        method: editId ? 'PATCH' : 'POST',
        body: {
          name: name.trim(),
          // when editing, an emptied field must be sent to clear it
          ...((dosage.trim() || editId) && { dosage: dosage.trim() }),
          ...((instructions.trim() || editId) && { instructions: instructions.trim() }),
          ...(pillsNum !== undefined && { pillsRemaining: pillsNum }),
          sound,
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

  if (step === 2) {
    return (
      <DosageTimes
        times={times}
        editing={editing}
        onTogglePeriod={togglePeriod}
        onTime={(v) => setTimes((t) => ({ ...t, [editing]: v }))}
        everyDay={everyDay}
        onEveryDay={setEveryDay}
        days={days}
        onDays={setDays}
        sound={sound}
        onSound={setSound}
        onBack={() => (editId && params.step === '2' ? router.back() : setStep(1))}
        onSave={save}
        busy={busy}
        disabled={!loaded}
        error={error}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => router.back()} />

          {step === 1 ? (
            <>
              <View style={styles.head}>
                <MaterialCommunityIcons name="pill" size={48} color={colors.text} style={{ transform: [{ rotate: '-35deg' }] }} />
                <Text style={styles.title}>{editId ? 'แก้ไขยา' : 'ใส่ชื่อยา\nหรือพิมพ์ค้นหา'}</Text>
              </View>

              <View style={styles.darkInput}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="ชื่อยา"
                  placeholderTextColor={colors.faint}
                  style={styles.darkText}
                  autoCapitalize="words"
                  maxLength={200}
                  accessibilityLabel="ชื่อยา"
                  autoFocus={!editId}
                />
                <MaterialCommunityIcons name="pill" size={20} color="#FFFFFF" />
              </View>

              {suggestions.length > 0 && (
                <>
                  <Text style={[type.small, { textAlign: 'center' }]}>หรือเลือกจากรายการนี้</Text>
                  <MedPicker items={suggestions} onPick={setName} />
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
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
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
}));
