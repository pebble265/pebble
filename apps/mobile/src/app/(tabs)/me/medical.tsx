import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../../components/text';
import { useS } from '../../../components/figma';
import { Section } from '../../../components/care-ui';
import { confirm } from '../../../components/ui';
import { SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import type { MedicalData } from '../../../lib/types';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`).catch(() => {});

function useField() {
  const s = useS();
  return {
    height: s(42),
    borderRadius: s(12),
    backgroundColor: colors.fill,
    paddingHorizontal: s(14),
    fontSize: s(14),
    color: colors.ink,
    outlineWidth: 0,
  } as const;
}

/** A list of short items (allergies, conditions): chips with ✕, and a box to add one. */
function ChipList({ items, onChange, placeholder, tone }: { items: string[]; onChange(v: string[]): void; placeholder: string; tone: 'red' | 'blue' }) {
  const s = useS();
  const field = useField();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft('');
  };
  const bg = tone === 'red' ? colors.dangerSoft : colors.blueSoft;
  const fg = tone === 'red' ? colors.danger : colors.blue;
  return (
    <View style={{ marginHorizontal: s(30), gap: s(8) }}>
      {items.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
          {items.map((it) => (
            <Pressable
              key={it}
              onPress={() => onChange(items.filter((x) => x !== it))}
              accessibilityRole="button"
              accessibilityLabel={`ลบ ${it}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingLeft: s(12), paddingRight: s(8), height: s(30), borderRadius: 999, backgroundColor: bg }}>
              <Text style={{ fontSize: s(13), fontWeight: '600', color: fg }}>{it}</Text>
              <Ionicons name="close" size={s(14)} color={fg} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={placeholder} onSubmitEditing={add} returnKeyType="done" maxLength={100} accessibilityLabel={placeholder} style={[field, { flex: 1 }]} />
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="เพิ่ม" style={{ width: s(42), height: s(42), borderRadius: s(12), backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={s(22)} color={colors.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  const s = useS();
  return (
    <View style={{ gap: s(4) }}>
      <Text style={{ fontSize: s(11), color: colors.muted }}>{label}</Text>
      {children}
    </View>
  );
}

/** Profile → ข้อมูลทางการแพทย์: allergies, conditions, regular doctor and emergency contacts. */
export default function Medical() {
  useTheme();
  const s = useS();
  const field = useField();
  const [data, setData] = useState<MedicalData | null>(null);
  // the editable copy of allergies / conditions / doctor
  const [draft, setDraft] = useState<Omit<MedicalData, 'contacts'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newContact, setNewContact] = useState<{ label: string; phone: string } | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  const take = (d: MedicalData) => {
    setData(d);
    setDraft({ allergies: d.allergies, conditions: d.conditions, doctor: d.doctor });
  };

  useFocusEffect(
    useCallback(() => {
      api<MedicalData>('/medical')
        .then((d) => {
          take(d);
          setError('');
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  const dirty = !!data && !!draft && JSON.stringify({ a: data.allergies, c: data.conditions, d: data.doctor }) !== JSON.stringify({ a: draft.allergies, c: draft.conditions, d: draft.doctor });

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      take(await api<MedicalData>('/medical', { method: 'PATCH', body: draft }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function addContact() {
    if (!newContact) return;
    if (!newContact.label.trim() || !/^[0-9+\-\s()]{3,30}$/.test(newContact.phone.trim())) {
      return setError('ใส่ชื่อและเบอร์โทรให้ครบ');
    }
    setContactBusy(true);
    setError('');
    try {
      const d = await api<MedicalData>('/medical/contacts', { method: 'POST', body: newContact });
      setData((prev) => (prev ? { ...prev, contacts: d.contacts } : d));
      setNewContact(null);
    } catch (e) {
      const m = errorText(e);
      setError(/at most/i.test(m) ? 'เพิ่มผู้ติดต่อฉุกเฉินได้สูงสุด 5 คน' : /already/i.test(m) ? 'เบอร์นี้มีอยู่ในรายชื่อแล้ว' : m);
    } finally {
      setContactBusy(false);
    }
  }

  async function removeContact(id: string, label: string) {
    if (!(await confirm(`ลบ ${label}?`, 'ลบออกจากผู้ติดต่อฉุกเฉิน', 'ลบ'))) return;
    try {
      const d = await api<MedicalData>(`/medical/contacts/${id}`, { method: 'DELETE' });
      setData((prev) => (prev ? { ...prev, contacts: d.contacts } : d));
    } catch (e) {
      setError(errorText(e));
    }
  }

  const callButton = (phone: string) => (
    <Pressable onPress={() => call(phone)} accessibilityRole="button" accessibilityLabel={`โทร ${phone}`} style={{ width: s(34), height: s(34), borderRadius: 999, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="call" size={s(15)} color={colors.success} />
    </Pressable>
  );

  return (
    <SubPage title="ข้อมูลทางการแพทย์" icon="medkit-outline">
      <View style={{ marginHorizontal: s(40), flexDirection: 'row', gap: s(6), alignItems: 'flex-start' }}>
        <Ionicons name="lock-closed" size={s(12)} color={colors.muted} style={{ marginTop: s(2) }} />
        <Text style={{ flex: 1, fontSize: s(11.5), lineHeight: s(17), color: colors.muted }}>
          เก็บแบบเข้ารหัส เห็นได้แค่คุณ Pebble จะเตือนถ้าคุณเพิ่มยาที่ชื่อตรงกับยาที่แพ้
        </Text>
      </View>
      {!data && !error ? <ActivityIndicator style={{ marginTop: s(30) }} /> : null}

      {draft && data && (
        <>
          <Section title="ยาที่แพ้">
            <ChipList items={draft.allergies} onChange={(allergies) => setDraft({ ...draft, allergies })} placeholder="เช่น Penicillin, แอสไพริน" tone="red" />
          </Section>

          <Section title="โรคประจำตัว">
            <ChipList items={draft.conditions} onChange={(conditions) => setDraft({ ...draft, conditions })} placeholder="เช่น ความดันสูง, เบาหวาน" tone="blue" />
          </Section>

          <Section title="หมอประจำตัว">
            <View style={{ marginHorizontal: s(30), gap: s(10) }}>
              <Labeled label="ชื่อหมอ">
                <TextInput value={draft.doctor.name} onChangeText={(name) => setDraft({ ...draft, doctor: { ...draft.doctor, name } })} placeholder="เช่น พญ. สมใจ" maxLength={100} accessibilityLabel="ชื่อหมอ" style={field} />
              </Labeled>
              <Labeled label="โรงพยาบาล / คลินิก">
                <TextInput value={draft.doctor.place} onChangeText={(place) => setDraft({ ...draft, doctor: { ...draft.doctor, place } })} placeholder="เช่น รพ.ศรีธัญญา" maxLength={100} accessibilityLabel="โรงพยาบาล / คลินิก" style={field} />
              </Labeled>
              <Labeled label="เบอร์โทร">
                <View style={{ flexDirection: 'row', gap: s(8), alignItems: 'center' }}>
                  <TextInput value={draft.doctor.phone} onChangeText={(phone) => setDraft({ ...draft, doctor: { ...draft.doctor, phone } })} placeholder="02-xxx-xxxx" keyboardType="phone-pad" maxLength={30} accessibilityLabel="เบอร์โทรหมอ" style={[field, { flex: 1 }]} />
                  {data.doctor.phone ? callButton(data.doctor.phone) : null}
                </View>
              </Labeled>
            </View>
          </Section>

          {(dirty || saved) && (
            <Pressable
              onPress={save}
              disabled={saving || !dirty}
              accessibilityRole="button"
              style={{ marginHorizontal: s(30), marginTop: s(16), height: s(46), borderRadius: 999, backgroundColor: saved && !dirty ? colors.success : colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : saved && !dirty ? (
                <>
                  <Ionicons name="checkmark" size={s(18)} color="#FFF" />
                  <Text style={{ fontSize: s(15), fontWeight: '600', color: '#FFF' }}>บันทึกแล้ว</Text>
                </>
              ) : (
                <Text style={{ fontSize: s(15), fontWeight: '600', color: colors.primaryText }}>บันทึกข้อมูล</Text>
              )}
            </Pressable>
          )}

          <Section title="ผู้ติดต่อฉุกเฉิน">
            <Text style={{ marginHorizontal: s(40), marginBottom: s(8), fontSize: s(11), lineHeight: s(16), color: colors.muted }}>
              ถ้า Pebbi เห็นว่าคุณอาจไม่ปลอดภัย จะขึ้นรายชื่อนี้ให้กดโทรได้ทันที
            </Text>
            {data.contacts.map((c) => (
              <View key={c.id} style={{ marginHorizontal: s(30), marginBottom: s(8), padding: s(12), borderRadius: s(14), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: s(14), fontWeight: '600', color: colors.ink }}>{c.label}</Text>
                  <Text style={{ fontSize: s(12), color: colors.muted, marginTop: s(1) }}>{c.hotline ? `${c.phone} · สายด่วน` : c.phone}</Text>
                </View>
                {!c.hotline && (
                  <Pressable onPress={() => removeContact(c.id, c.label)} accessibilityRole="button" accessibilityLabel={`ลบ ${c.label}`} hitSlop={8} style={{ padding: s(4) }}>
                    <Ionicons name="trash-outline" size={s(17)} color={colors.faint} />
                  </Pressable>
                )}
                {callButton(c.phone)}
              </View>
            ))}
            {newContact ? (
              <View style={{ marginHorizontal: s(30), padding: s(12), borderRadius: s(14), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: s(8) }}>
                <TextInput value={newContact.label} onChangeText={(label) => setNewContact({ ...newContact, label })} placeholder="ชื่อ เช่น แม่ · สมศรี" maxLength={100} autoFocus accessibilityLabel="ชื่อผู้ติดต่อ" style={field} />
                <TextInput value={newContact.phone} onChangeText={(phone) => setNewContact({ ...newContact, phone })} placeholder="เบอร์โทร" keyboardType="phone-pad" maxLength={30} accessibilityLabel="เบอร์โทรผู้ติดต่อ" style={field} />
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  <Pressable onPress={() => setNewContact(null)} accessibilityRole="button" style={{ flex: 1, height: s(40), borderRadius: 999, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.ink }}>ยกเลิก</Text>
                  </Pressable>
                  <Pressable onPress={addContact} disabled={contactBusy} accessibilityRole="button" style={{ flex: 1, height: s(40), borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    {contactBusy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.primaryText }}>เพิ่ม</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setNewContact({ label: '', phone: '' })} accessibilityRole="button" style={{ marginHorizontal: s(40), paddingVertical: s(8), flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <Ionicons name="add-circle-outline" size={s(18)} color={colors.blue} />
                <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.blue }}>เพิ่มผู้ติดต่อฉุกเฉิน</Text>
              </Pressable>
            )}
          </Section>
        </>
      )}

      {error ? <Text style={{ marginHorizontal: s(40), marginTop: s(10), fontSize: s(12), color: colors.danger }}>{error}</Text> : null}
    </SubPage>
  );
}
