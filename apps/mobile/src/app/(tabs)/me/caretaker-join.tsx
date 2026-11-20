import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../../components/text';
import { useS } from '../../../components/figma';
import { Initial } from '../../../components/care-ui';
import { SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import { CARE_PERMS, inviteCodeFrom } from '../../../lib/care';
import type { CarePermissions } from '../../../lib/types';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

type Preview = { invitedBy: string; relationshipLabel: string | null; permissions: CarePermissions; expiresAt: string };

/** What went wrong with a code, in words a caretaker understands. */
function inviteError(e: unknown) {
  const m = errorText(e);
  if (/invalid or has expired/i.test(m)) return 'รหัสนี้ใช้ไม่ได้ หรือหมดอายุแล้ว ขอรหัสใหม่จากคนที่เชิญ';
  if (/different email/i.test(m)) return 'คำเชิญนี้ส่งถึงอีเมลอื่น ต้องเข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ';
  if (/own invite/i.test(m)) return 'นี่คือคำเชิญที่คุณสร้างเอง ส่งให้ผู้ดูแลของคุณใช้นะ';
  if (/already a caretaker/i.test(m)) return 'คุณเป็นผู้ดูแลของเขาอยู่แล้ว';
  if (/already used/i.test(m)) return 'รหัสนี้ถูกใช้ไปแล้ว';
  return m;
}

/**
 * Profile → ผู้ดูแล → ใส่รหัสเชิญ (also opened by pebble://me/caretaker-join?token=...).
 * Shows who is inviting and what you'd get before you accept.
 */
export default function CaretakerJoin() {
  useTheme();
  const s = useS();
  const params = useLocalSearchParams<{ token?: string }>();
  const [code, setCode] = useState(params.token ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'look' | 'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const token = inviteCodeFrom(code);

  async function look(t = token) {
    if (t.length < 20) return setError('รหัสเชิญสั้นเกินไป ลองคัดลอกมาใหม่ทั้งหมด');
    setBusy('look');
    setError('');
    try {
      setPreview(await api<Preview>('/caretaking/invites/preview', { method: 'POST', body: { token: t } }));
    } catch (e) {
      setPreview(null);
      setError(inviteError(e));
    } finally {
      setBusy(null);
    }
  }

  // Opened from the invite link: look it up straight away.
  useEffect(() => {
    if (params.token) void look(inviteCodeFrom(params.token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function answer(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline');
    setError('');
    try {
      await api(`/caretaking/invites/${accept ? 'accept' : 'decline'}`, { method: 'POST', body: { token } });
      setDone(accept ? `ตอนนี้คุณเป็นผู้ดูแลของ ${preview?.invitedBy} แล้ว` : 'ปฏิเสธคำเชิญแล้ว');
    } catch (e) {
      setError(inviteError(e));
    } finally {
      setBusy(null);
    }
  }

  const button = (label: string, onPress: () => void, kind: 'primary' | 'plain', which: typeof busy) => (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        height: s(46),
        borderRadius: 999,
        backgroundColor: kind === 'primary' ? colors.primary : colors.fill,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}>
      {busy === which ? (
        <ActivityIndicator color={kind === 'primary' ? colors.primaryText : colors.ink} />
      ) : (
        <Text style={{ fontSize: s(15), fontWeight: '600', color: kind === 'primary' ? colors.primaryText : colors.ink }}>{label}</Text>
      )}
    </Pressable>
  );

  if (done) {
    return (
      <SubPage title="คำเชิญผู้ดูแล" icon="people-outline">
        <View style={{ alignItems: 'center', marginTop: s(30), marginHorizontal: s(40), gap: s(10) }}>
          <View style={{ width: s(56), height: s(56), borderRadius: 999, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={s(30)} color={colors.success} />
          </View>
          <Text style={{ fontSize: s(16), fontWeight: '700', color: colors.ink, textAlign: 'center' }}>{done}</Text>
          <Text style={{ fontSize: s(12), color: colors.muted, textAlign: 'center' }}>การแจ้งเตือนจะส่งไปที่อีเมลของคุณ และดูได้ในหน้าผู้ดูแล</Text>
          <Pressable onPress={() => router.replace('/me/caretakers')} accessibilityRole="button" style={{ marginTop: s(8), padding: s(8) }}>
            <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.blue }}>ไปที่หน้าผู้ดูแล</Text>
          </Pressable>
        </View>
      </SubPage>
    );
  }

  return (
    <SubPage title="ใส่รหัสเชิญ" icon="people-outline">
      <Text style={{ marginHorizontal: s(40), fontSize: s(12), lineHeight: s(18), color: colors.muted }}>
        วางรหัสหรือลิงก์ที่ได้รับจากคนที่เชิญคุณเป็นผู้ดูแล
      </Text>
      <View style={{ marginHorizontal: s(30), marginTop: s(12), gap: s(10) }}>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setPreview(null);
            setError('');
          }}
          placeholder="รหัสเชิญ"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          accessibilityLabel="รหัสเชิญ"
          style={{ minHeight: s(64), borderRadius: s(12), backgroundColor: colors.fill, paddingHorizontal: s(14), paddingTop: s(12), fontSize: s(13), color: colors.ink, outlineWidth: 0 }}
        />
        {!preview && (
          <View style={{ flexDirection: 'row' }}>{button('ดูคำเชิญ', () => look(), 'primary', 'look')}</View>
        )}
      </View>

      {error ? <Text style={{ marginHorizontal: s(40), marginTop: s(10), fontSize: s(12), color: colors.danger }}>{error}</Text> : null}

      {preview && (
        <View style={{ marginHorizontal: s(30), marginTop: s(16), padding: s(16), borderRadius: s(18), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: s(10) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <Initial name={preview.invitedBy} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: s(15), fontWeight: '700', color: colors.ink }}>{preview.invitedBy}</Text>
              <Text style={{ fontSize: s(12), color: colors.muted }}>
                {preview.relationshipLabel ? `ชวนคุณเป็นผู้ดูแล (ในฐานะ${preview.relationshipLabel})` : 'ชวนคุณเป็นผู้ดูแล'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: s(12), color: colors.muted }}>คุณจะได้รับ:</Text>
          {CARE_PERMS.filter((p) => preview.permissions[p.key]).map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', gap: s(8), alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle" size={s(16)} color={colors.success} style={{ marginTop: s(1) }} />
              <Text style={{ flex: 1, fontSize: s(13), color: colors.ink }}>{p.label}</Text>
            </View>
          ))}
          <Text style={{ fontSize: s(11), color: colors.faint }}>Pebble ไม่แชร์ข้อความแชท โน้ต หรือชื่อยา</Text>
          <View style={{ flexDirection: 'row', gap: s(10), marginTop: s(4) }}>
            {button('ปฏิเสธ', () => answer(false), 'plain', 'decline')}
            {button('ตอบรับ', () => answer(true), 'primary', 'accept')}
          </View>
        </View>
      )}
    </SubPage>
  );
}
