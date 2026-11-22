import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../../../components/text';
import { useS } from '../../../components/figma';
import { confirm } from '../../../components/ui';
import { SubPage } from '../../../components/user-ui';
import { Initial, PermToggle, Section } from '../../../components/care-ui';
import { api, errorText } from '../../../lib/api';
import { CARE_PERMS } from '../../../lib/care';
import type { CarePermissions, CaringFor, MyCaretaker } from '../../../lib/types';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

const STATUS: Record<MyCaretaker['status'], { text: string; color: () => string }> = {
  accepted: { text: 'ดูแลอยู่', color: () => colors.online },
  pending: { text: 'รอตอบรับ', color: () => colors.warn },
  expired: { text: 'คำเชิญหมดอายุ', color: () => colors.muted },
};

function CaretakerRow({ c, onChanged }: { c: MyCaretaker; onChanged(): void }) {
  const s = useS();
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<CarePermissions>(c.permissions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = c.caretaker?.displayName ?? c.inviteEmail ?? 'ผู้ดูแล';
  const st = STATUS[c.status];

  async function setPerm(key: keyof CarePermissions, v: boolean) {
    const prev = perms;
    setPerms({ ...perms, [key]: v });
    setErr('');
    try {
      setPerms(await api<CarePermissions>(`/caretakers/${c.id}/permissions`, { method: 'PATCH', body: { [key]: v } }));
    } catch (e) {
      setPerms(prev);
      setErr(errorText(e));
    }
  }

  async function remove() {
    const accepted = c.status === 'accepted';
    const ok = await confirm(
      accepted ? `ลบ ${name} ออกจากผู้ดูแล?` : 'ยกเลิกคำเชิญนี้?',
      accepted ? 'เขาจะไม่ได้รับการแจ้งเตือนและไม่เห็นข้อมูลของคุณอีก' : 'รหัสเชิญที่ส่งไปจะใช้ไม่ได้',
      accepted ? 'ลบ' : 'ยกเลิกคำเชิญ',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/caretakers/${c.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ marginHorizontal: s(30), marginBottom: s(8), borderRadius: s(16), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), padding: s(12) }}>
        <Initial name={name} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: s(14), fontWeight: '600', color: colors.ink }}>{name}</Text>
          <Text style={{ fontSize: s(11), color: colors.muted, marginTop: s(1) }}>
            {c.relationshipLabel ? `${c.relationshipLabel} · ` : ''}
            <Text style={{ color: st.color() }}>{st.text}</Text>
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={s(16)} color={colors.faint} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: s(14), paddingBottom: s(12), borderTopWidth: 1, borderTopColor: colors.line }}>
          <Text style={{ fontSize: s(11), color: colors.muted, marginTop: s(10), marginBottom: s(2) }}>สิ่งที่ {name} ได้รับ</Text>
          {CARE_PERMS.map((p) => (
            <PermToggle key={p.key} label={p.label} hint={p.hint} value={perms[p.key]} onChange={(v) => setPerm(p.key, v)} disabled={busy} />
          ))}
          {err ? <Text style={{ fontSize: s(11), color: colors.danger, marginTop: s(4) }}>{err}</Text> : null}
          <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: s(8), marginTop: s(4) }}>
            {busy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.danger }}>{c.status === 'accepted' ? 'ลบผู้ดูแล' : 'ยกเลิกคำเชิญ'}</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Profile → ผู้ดูแล: who looks after me (and what they get), and the people I look after. */
export default function Caretakers() {
  useTheme();
  const s = useS();
  const [mine, setMine] = useState<MyCaretaker[] | null>(null);
  const [caring, setCaring] = useState<CaringFor[] | null>(null);
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, c, consents] = await Promise.all([
        api<MyCaretaker[]>('/caretakers'),
        api<CaringFor[]>('/caretaking'),
        api<Record<string, { active: boolean }>>('/privacy/consents'),
      ]);
      setMine(m);
      setCaring(c);
      setSharing(consents.caretaker_sharing?.active ?? true);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleSharing(on: boolean) {
    if (!on) {
      const ok = await confirm(
        'หยุดแชร์กับผู้ดูแลทุกคน?',
        'ผู้ดูแลทุกคนจะถูกลบ และคำเชิญที่ยังไม่ตอบจะใช้ไม่ได้ ถ้าเปิดใหม่ต้องเชิญใหม่',
        'หยุดแชร์',
      );
      if (!ok) return;
    }
    try {
      await api(`/privacy/consents/caretaker_sharing/${on ? 'grant' : 'revoke'}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const loading = mine === null && !error;

  return (
    <SubPage title="ผู้ดูแล" icon="people-outline">
      <Text style={{ marginHorizontal: s(40), fontSize: s(12), lineHeight: s(18), color: colors.muted }}>
        ผู้ดูแลคือคนที่คุณไว้ใจ เช่น ครอบครัวหรือเพื่อน เขาจะได้รับอีเมลแจ้งเตือนตามที่คุณเลือก และไม่เห็นข้อความแชท โน้ต หรือชื่อยา
      </Text>
      {error ? <Text style={{ marginHorizontal: s(40), marginTop: s(10), fontSize: s(12), color: colors.danger }}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: s(30) }} /> : null}

      {mine && (
        <Section title="ผู้ดูแลของฉัน">
          {mine.length === 0 ? (
            <Text style={{ marginHorizontal: s(40), fontSize: s(12), color: colors.faint, marginBottom: s(8) }}>ยังไม่มีผู้ดูแล</Text>
          ) : (
            mine.map((c) => <CaretakerRow key={c.id} c={c} onChanged={load} />)
          )}
          {sharing !== false && (
            <Pressable
              onPress={() => router.push('/me/caretaker-invite')}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginHorizontal: s(30),
                marginTop: s(4),
                height: s(44),
                borderRadius: 999,
                backgroundColor: colors.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: s(6),
                opacity: pressed ? 0.85 : 1,
              })}>
              <Ionicons name="person-add" size={s(16)} color={colors.primaryText} />
              <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.primaryText }}>เชิญผู้ดูแล</Text>
            </Pressable>
          )}
        </Section>
      )}

      {caring && (
        <Section title="คนที่ฉันดูแล">
          {caring.length === 0 ? (
            <Text style={{ marginHorizontal: s(40), fontSize: s(12), color: colors.faint }}>ยังไม่ได้เป็นผู้ดูแลใคร</Text>
          ) : (
            caring.map((p) => (
              <Pressable
                key={p.linkId}
                onPress={() => router.push({ pathname: '/me/caring', params: { linkId: p.linkId } })}
                accessibilityRole="button"
                accessibilityLabel={p.displayName}
                style={{ marginHorizontal: s(30), marginBottom: s(8), padding: s(12), borderRadius: s(16), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                <Initial name={p.displayName} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: s(14), fontWeight: '600', color: colors.ink }}>{p.displayName}</Text>
                  <Text style={{ fontSize: s(11), color: colors.muted, marginTop: s(1) }}>{p.relationshipLabel ? `คุณเป็น${p.relationshipLabel}ของเขา` : 'คุณเป็นผู้ดูแล'}</Text>
                </View>
                {p.unacknowledgedAlerts > 0 && (
                  <View style={{ minWidth: s(20), height: s(20), paddingHorizontal: s(6), borderRadius: 999, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: s(11), fontWeight: '700', color: '#FFF' }}>{p.unacknowledgedAlerts}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={s(14)} color={colors.faint} />
              </Pressable>
            ))
          )}
          <Pressable onPress={() => router.push('/me/caretaker-join')} accessibilityRole="button" style={{ marginHorizontal: s(40), paddingVertical: s(10) }}>
            <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.blue }}>มีรหัสเชิญ? ใส่รหัสที่นี่</Text>
          </Pressable>
        </Section>
      )}

      {sharing !== null && (
        <View style={{ marginHorizontal: s(40), marginTop: s(16), paddingTop: s(8), borderTopWidth: 1, borderTopColor: colors.line }}>
          <PermToggle
            label="แชร์ข้อมูลกับผู้ดูแล"
            hint={sharing ? 'ปิดเพื่อหยุดแชร์กับผู้ดูแลทุกคนทันที' : 'ปิดอยู่: ผู้ดูแลจะไม่ได้รับอะไรเลย'}
            value={sharing}
            onChange={toggleSharing}
          />
        </View>
      )}
    </SubPage>
  );
}
