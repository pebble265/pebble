import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { Text, TextInput } from '../../../components/text';
import { useS } from '../../../components/figma';
import { PermToggle, Section } from '../../../components/care-ui';
import { SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import { CARE_PERMS, DEFAULT_PERMS, RELATIONSHIPS } from '../../../lib/care';
import { t } from '../../../lib/i18n';
import type { CarePermissions } from '../../../lib/types';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

type Invite = { id: string; token: string; expiresAt: string; emailed: boolean };

/** Profile → ผู้ดูแล → เชิญผู้ดูแล: who, what they get, then a code to share (and an email if given). */
export default function CaretakerInvite() {
  useTheme();
  const s = useS();
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [perms, setPerms] = useState<Partial<CarePermissions>>(DEFAULT_PERMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<Invite | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  async function send() {
    if (!emailOk) return setError('ใส่อีเมลของผู้ดูแลให้ถูกต้อง');
    setBusy(true);
    setError('');
    try {
      setInvite(
        await api<Invite>('/caretakers/invites', {
          method: 'POST',
          body: { email: email.trim(), ...(relation.trim() && { relationshipLabel: relation.trim() }), permissions: perms },
        }),
      );
    } catch (e) {
      const msg = errorText(e);
      setError(/yourself/i.test(msg) ? 'เชิญตัวเองไม่ได้' : /at most/i.test(msg) ? 'มีผู้ดูแลได้สูงสุด 10 คน' : msg);
    } finally {
      setBusy(false);
    }
  }

  const field = {
    height: s(44),
    borderRadius: s(12),
    backgroundColor: colors.fill,
    paddingHorizontal: s(14),
    fontSize: s(14),
    color: colors.ink,
    outlineWidth: 0,
  } as const;

  if (invite) {
    const message = t(
      `ชวนเป็นผู้ดูแลใน Pebble(a)\nเปิดแอป Pebble → โปรไฟล์ → ผู้ดูแล → ใส่รหัสเชิญ แล้ววางรหัสนี้:\n\n${invite.token}`,
    );
    return (
      <SubPage title="เชิญผู้ดูแล" icon="person-add-outline">
        <View style={{ alignItems: 'center', marginTop: s(10), marginHorizontal: s(40), gap: s(8) }}>
          <View style={{ width: s(56), height: s(56), borderRadius: 999, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={s(30)} color={colors.success} />
          </View>
          <Text style={{ fontSize: s(18), fontWeight: '700', color: colors.ink, textAlign: 'center' }}>สร้างคำเชิญแล้ว</Text>
          <Text style={{ fontSize: s(12), lineHeight: s(18), color: colors.muted, textAlign: 'center' }}>
            {invite.emailed
              ? `ส่งอีเมลเชิญไปที่ ${email.trim()} แล้ว ถ้าเขาไม่เห็นอีเมล ส่งรหัสด้านล่างให้เขาเองก็ได้`
              : `ส่งรหัสด้านล่างให้ ${email.trim()} แล้วให้เขาใส่ในแอป Pebble ที่ โปรไฟล์ → ผู้ดูแล → ใส่รหัสเชิญ`}
          </Text>
        </View>
        <View style={{ marginHorizontal: s(30), marginTop: s(16), padding: s(14), borderRadius: s(14), backgroundColor: colors.fill }}>
          <Text selectable style={{ fontSize: s(13), fontFamily: 'Menlo', color: colors.ink, textAlign: 'center' }}>
            {invite.token}
          </Text>
        </View>
        <Text style={{ marginHorizontal: s(40), marginTop: s(6), fontSize: s(11), color: colors.faint, textAlign: 'center' }}>
          ใช้ได้ 7 วัน และใช้ได้กับบัญชีอีเมลนี้เท่านั้น · กดค้างที่รหัสเพื่อคัดลอก
        </Text>
        <View style={{ flexDirection: 'row', gap: s(10), marginHorizontal: s(30), marginTop: s(16) }}>
          <Pressable
            onPress={() => Share.share({ message }).catch(() => {})}
            accessibilityRole="button"
            style={{ flex: 1, height: s(44), borderRadius: 999, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
            <Ionicons name="share-outline" size={s(16)} color={colors.primaryText} />
            <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.primaryText }}>ส่งหรือคัดลอกรหัส</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: s(14), padding: s(8) }}>
          <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.blue }}>เสร็จ</Text>
        </Pressable>
      </SubPage>
    );
  }

  return (
    <SubPage title="เชิญผู้ดูแล" icon="person-add-outline">
      <Section title="อีเมลของผู้ดูแล">
        <View style={{ marginHorizontal: s(30) }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="อีเมลของผู้ดูแล"
            style={field}
          />
          <Text style={{ fontSize: s(10.5), color: colors.muted, marginTop: s(6) }}>
            เขาต้องสมัคร Pebble ด้วยอีเมลนี้ถึงจะตอบรับได้ และการแจ้งเตือนจะส่งไปที่อีเมลนี้
          </Text>
        </View>
      </Section>

      <Section title="เขาเป็นอะไรกับคุณ (ไม่บังคับ)">
        <View style={{ marginHorizontal: s(30), gap: s(8) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
            {RELATIONSHIPS.map((r) => {
              const on = relation === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRelation(on ? '' : r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: s(12), height: s(30), borderRadius: 999, justifyContent: 'center', backgroundColor: on ? colors.blue : colors.fill }}>
                  <Text style={{ fontSize: s(12), fontWeight: '500', color: on ? '#FFF' : colors.ink }}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput value={relation} onChangeText={setRelation} placeholder="หรือพิมพ์เอง" maxLength={50} accessibilityLabel="ความสัมพันธ์" style={field} />
        </View>
      </Section>

      <Section title="สิ่งที่เขาจะได้รับ">
        <View style={{ marginHorizontal: s(30), paddingHorizontal: s(14), paddingVertical: s(4), borderRadius: s(16), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          {CARE_PERMS.map((p) => (
            <PermToggle key={p.key} label={p.label} hint={p.hint} value={!!perms[p.key]} onChange={(v) => setPerms({ ...perms, [p.key]: v })} />
          ))}
        </View>
        <Text style={{ marginHorizontal: s(40), marginTop: s(8), fontSize: s(10.5), color: colors.muted }}>
          เปลี่ยนได้ตลอดในหน้าผู้ดูแล ข้อความแชท โน้ต และชื่อยาจะไม่ถูกแชร์
        </Text>
      </Section>

      {error ? <Text style={{ marginHorizontal: s(40), marginTop: s(12), fontSize: s(12), color: colors.danger }}>{error}</Text> : null}

      <Pressable
        onPress={send}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginHorizontal: s(30),
          marginTop: s(18),
          height: s(46),
          borderRadius: 999,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed || !emailOk ? 0.6 : 1,
        })}>
        {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={{ fontSize: s(15), fontWeight: '600', color: colors.primaryText }}>ส่งคำเชิญ</Text>}
      </Pressable>
    </SubPage>
  );
}
