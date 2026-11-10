import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { SocialButtons } from '../components/social-buttons';
import { Button, ErrorText, EyeToggle, Field } from '../components/ui';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, space } from '../theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email.includes('@')) return setError('อีเมลไม่ถูกต้อง');
    if (!name.trim()) return setError('บอกชื่อที่อยากให้ Pebble เรียกหน่อยนะ');
    if (password.length < 8) return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if (password !== confirmPw) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    setBusy(true);
    setError('');
    try {
      await signUp(name, email, password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Let's Sign-Up 🤩"
      subtitle="ตามสบายนะ อยู่ตรงนี้ได้เลย"
      footer={
        <Text style={{ textAlign: 'center', color: colors.muted }}>
          มีบัญชีแล้ว?{' '}
          <Link href="/sign-in" style={{ color: colors.text, fontWeight: '700' }}>
            เข้าสู่ระบบ
          </Link>
        </Text>
      }>
      <View style={{ gap: space.md }}>
        <Field
          label="อีเมล"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="ชื่อที่อยากให้ Pebble เรียก"
          value={name}
          onChangeText={setName}
          placeholder="เช่น เอิร์ธ"
          autoComplete="name"
          maxLength={100}
        />
        <Field
          label="รหัสผ่าน"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={hidden}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="อย่างน้อย 8 ตัวอักษร"
          right={<EyeToggle hidden={hidden} onPress={() => setHidden((h) => !h)} />}
        />
        <Field
          label="ยืนยันรหัสผ่าน"
          value={confirmPw}
          onChangeText={setConfirmPw}
          secureTextEntry={hidden}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="สมัครสมาชิก" leadingArrow onPress={submit} loading={busy} />
      </View>
      <SocialButtons verb="สมัคร" />
    </AuthShell>
  );
}
