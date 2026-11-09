import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { Button, ErrorText, Field } from '../components/ui';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, space } from '../theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) return setError('บอกชื่อที่อยากให้ Pebble เรียกหน่อยนะ');
    if (!email.includes('@')) return setError('อีเมลไม่ถูกต้อง');
    if (password.length < 8) return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
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
    <AuthShell title="สร้างบัญชี" subtitle="ใช้เวลาไม่ถึงนาที">
      <View style={{ gap: space.lg }}>
        <Field
          label="ชื่อที่อยากให้ Pebble เรียก"
          value={name}
          onChangeText={setName}
          placeholder="เช่น เอิร์ธ"
          autoComplete="nickname"
          maxLength={100}
        />
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
          label="รหัสผ่าน"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="อย่างน้อย 8 ตัวอักษร"
          onSubmitEditing={submit}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="สมัครสมาชิก" onPress={submit} loading={busy} />
      </View>
      <Text style={{ textAlign: 'center', color: colors.muted }}>
        มีบัญชีแล้ว?{' '}
        <Link href="/sign-in" style={{ color: colors.primary, fontWeight: '600' }}>
          เข้าสู่ระบบ
        </Link>
      </Text>
    </AuthShell>
  );
}
