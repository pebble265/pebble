import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { Button, ErrorText, Field } from '../components/ui';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, space } from '../theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email || !password) {
      setError('กรอกอีเมลและรหัสผ่าน');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="ยินดีต้อนรับกลับมา" subtitle="เข้าสู่ระบบเพื่อคุยกับ Pebble">
      <View style={{ gap: space.lg }}>
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
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="เข้าสู่ระบบ" onPress={submit} loading={busy} />
      </View>
      <Text style={{ textAlign: 'center', color: colors.muted }}>
        ยังไม่มีบัญชี?{' '}
        <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '600' }}>
          สมัครสมาชิก
        </Link>
      </Text>
    </AuthShell>
  );
}
