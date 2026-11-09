import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorText, Field } from '../components/ui';
import { api, errorText } from '../lib/api';
import { DAY_SHORT } from '../lib/format';
import { colors, radius, space, type } from '../theme';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALL = [1, 2, 3, 4, 5, 6, 7];

/** "8" -> "08:00", "830" -> "08:30", "8.30" -> "08:30" */
function normalizeTime(raw: string): string {
  const s = raw.trim().replace(/[.\s]/g, ':');
  if (HHMM.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length <= 2 && digits) return `${digits.padStart(2, '0')}:00`;
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return s;
}

export default function NewMedication() {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pills, setPills] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [days, setDays] = useState<number[]>(ALL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const cleanTimes = times.map(normalizeTime).filter(Boolean);
    if (!name.trim()) return setError('กรอกชื่อยา');
    const bad = cleanTimes.find((t) => !HHMM.test(t));
    if (bad) return setError(`เวลา "${bad}" ไม่ถูกต้อง ใช้รูปแบบ 08:00`);
    if (new Set(cleanTimes).size !== cleanTimes.length) return setError('มีเวลาซ้ำกัน');
    if (!days.length) return setError('เลือกอย่างน้อย 1 วัน');
    const pillsNum = pills.trim() ? Number(pills) : undefined;
    if (pillsNum !== undefined && (!Number.isInteger(pillsNum) || pillsNum < 0)) {
      return setError('จำนวนเม็ดคงเหลือต้องเป็นตัวเลข');
    }

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
          schedules: cleanTimes.map((time) => ({
            time,
            ...(days.length < 7 && { daysOfWeek: days }),
          })),
        },
      });
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Field label="ชื่อยา" value={name} onChangeText={setName} placeholder="เช่น Sertraline" maxLength={200} />
        <Field label="ขนาดที่กิน (ไม่บังคับ)" value={dosage} onChangeText={setDosage} placeholder="เช่น 1 เม็ด 50mg" maxLength={200} />
        <Field
          label="วิธีกิน (ไม่บังคับ)"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="เช่น หลังอาหารเช้า"
          maxLength={1000}
        />

        <View style={{ gap: space.sm }}>
          <Text style={type.label}>เวลาที่ต้องกิน</Text>
          {times.map((t, i) => (
            <View key={i} style={styles.timeRow}>
              <Ionicons name="alarm-outline" size={20} color={colors.primary} />
              <TextInput
                value={t}
                onChangeText={(v) => setTimes((ts) => ts.map((x, j) => (j === i ? v : x)))}
                onBlur={() => setTimes((ts) => ts.map((x, j) => (j === i ? normalizeTime(x) : x)))}
                placeholder="08:00"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.timeInput}
                accessibilityLabel={`เวลาที่ ${i + 1}`}
              />
              {times.length > 1 && (
                <Pressable
                  onPress={() => setTimes((ts) => ts.filter((_, j) => j !== i))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`ลบเวลาที่ ${i + 1}`}>
                  <Ionicons name="close-circle" size={22} color={colors.muted} />
                </Pressable>
              )}
            </View>
          ))}
          {times.length < 12 && (
            <Button title="เพิ่มเวลา" icon="add" variant="ghost" small onPress={() => setTimes((ts) => [...ts, ''])} />
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={type.label}>วันที่ต้องกิน</Text>
          <View style={styles.days}>
            {ALL.map((d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => setDays((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d].sort()))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.day, on && styles.dayOn]}>
                  <Text style={{ fontWeight: '600', color: on ? colors.primaryText : colors.muted }}>{DAY_SHORT[d]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="จำนวนเม็ดคงเหลือ (ไม่บังคับ)"
          value={pills}
          onChangeText={setPills}
          keyboardType="number-pad"
          placeholder="เช่น 30"
          hint="Pebble จะเตือนเมื่อยาใกล้หมด"
        />

        <ErrorText>{error}</ErrorText>
        <Button title="บันทึก" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  timeInput: { flex: 1, minHeight: 50, fontSize: 18, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  days: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  day: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
