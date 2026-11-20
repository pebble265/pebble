import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../../components/text';
import { useS } from '../../../components/figma';
import { confirm } from '../../../components/ui';
import { InfoRow, SubPage } from '../../../components/user-ui';
import { ApiError, api, errorText } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

const METHOD: Record<string, string> = { password: 'อีเมลและรหัสผ่าน', google: 'Google', apple: 'Apple' };

function Box({ placeholder, value, onChange }: { placeholder: string; value: string; onChange(v: string): void }) {
  const s = useS();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      secureTextEntry
      autoCapitalize="none"
      accessibilityLabel={placeholder}
      style={{ height: s(42), borderRadius: s(10), backgroundColor: colors.fill, paddingHorizontal: s(12), fontSize: s(14), color: colors.ink, outlineWidth: 0 }}
    />
  );
}

/** Figma "pebble(a) - Login": email, password, how you sign in, delete account. */
export default function Security() {
  useTheme();
  const s = useS();
  const { user, signIn, signOut } = useAuth();
  const methods = user?.loginMethods ?? (user?.hasPassword === false ? [] : ['password']);
  const hasPassword = methods.includes('password');

  const [open, setOpen] = useState<'password' | 'delete' | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (which: 'password' | 'delete') => {
    setOpen((o) => (o === which ? null : which));
    setCurrent('');
    setNext('');
    setAgain('');
    setMsg(null);
  };

  async function changePassword() {
    if (next.length < 8) return setMsg({ ok: false, text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว' });
    if (next !== again) return setMsg({ ok: false, text: 'รหัสผ่านใหม่สองช่องไม่ตรงกัน' });
    setBusy(true);
    setMsg(null);
    try {
      await api('/users/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      // other devices were signed out; sign this one back in with the new password
      if (user?.email) await signIn(user.email, next);
      setOpen(null);
      setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นถูกออกจากระบบ' });
    } catch (e) {
      const t = errorText(e);
      setMsg({ ok: false, text: /incorrect/i.test(t) ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : t });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!current) return setMsg({ ok: false, text: 'ใส่รหัสผ่านเพื่อยืนยัน' });
    const ok = await confirm('ลบบัญชีถาวร?', 'ข้อมูลยา บันทึกความรู้สึก และการจับคู่หุ่นจะถูกลบทั้งหมด กู้คืนไม่ได้', 'ลบบัญชี');
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      await api('/privacy/account', { method: 'DELETE', body: { password: current, confirm: 'DELETE' } });
      await signOut();
    } catch (e) {
      const wrong = e instanceof ApiError && e.status === 401;
      setMsg({ ok: false, text: wrong ? 'รหัสผ่านไม่ถูกต้อง' : errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const button = (label: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={{ height: s(42), borderRadius: 999, backgroundColor: danger ? '#E5484D' : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: s(14), fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );

  return (
    <SubPage title="การเข้าสู่ระบบและความปลอดภัย" icon="log-in-outline">
      <InfoRow label="อีเมลที่ใช้เข้าสู่ระบบ" value={user?.email} />
      {hasPassword && (
        <InfoRow label="รหัสผ่าน" value="••••••••••••••••••" onPress={() => toggle('password')} right={<Text style={{ fontSize: s(11), color: '#3B8BEF' }}>เปลี่ยน</Text>} />
      )}
      {open === 'password' && (
        <View style={{ marginHorizontal: s(40), gap: s(8), paddingVertical: s(10) }}>
          <Box placeholder="รหัสผ่านปัจจุบัน" value={current} onChange={setCurrent} />
          <Box placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" value={next} onChange={setNext} />
          <Box placeholder="ยืนยันรหัสผ่านใหม่" value={again} onChange={setAgain} />
          {button('บันทึกรหัสผ่านใหม่', changePassword)}
        </View>
      )}
      <InfoRow
        label="วิธีเข้าสู่ระบบ"
        value={methods.map((m) => METHOD[m] ?? m).join(', ') || '–'}
        right={
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            {methods.includes('google') && <Image source={require('../../../../assets/images/google-g.png')} style={{ width: s(16), height: s(16) }} />}
            {methods.includes('apple') && <Ionicons name="logo-apple" size={s(17)} color={colors.ink} />}
            {methods.includes('password') && <Ionicons name="mail-outline" size={s(16)} color={colors.ink} />}
          </View>
        }
        last
      />

      {msg && (
        <Text style={{ marginHorizontal: s(40), marginTop: s(8), fontSize: s(12), color: msg.ok ? '#34C759' : '#E5484D' }}>{msg.text}</Text>
      )}

      <Pressable onPress={() => toggle('delete')} accessibilityRole="button" style={{ marginHorizontal: s(40), marginTop: s(18) }}>
        <Text style={{ fontSize: s(13), color: '#E5484D', fontWeight: '500' }}>ลบบัญชีของฉัน</Text>
      </Pressable>
      {open === 'delete' &&
        (hasPassword ? (
          <View style={{ marginHorizontal: s(40), gap: s(8), paddingVertical: s(10) }}>
            <Text style={{ fontSize: s(11), color: colors.muted }}>ข้อมูลทั้งหมดจะถูกลบถาวร ใส่รหัสผ่านเพื่อยืนยัน</Text>
            <Box placeholder="รหัสผ่าน" value={current} onChange={setCurrent} />
            {button('ลบบัญชีถาวร', deleteAccount, true)}
          </View>
        ) : (
          <Text style={{ marginHorizontal: s(40), marginTop: s(8), fontSize: s(11), color: colors.muted }}>
            บัญชีนี้สร้างด้วย {methods.map((m) => METHOD[m]).join(' / ')} ต้องยืนยันตัวตนด้วยการเข้าสู่ระบบอีกครั้ง ซึ่งยังทำในแอปไม่ได้ ติดต่อทีม pebble เพื่อลบบัญชี
          </Text>
        ))}
    </SubPage>
  );
}
