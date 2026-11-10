import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { SocialButtons } from '../components/social-buttons';
import { Button, ErrorText, EyeToggle, Field } from '../components/ui';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, space } from '../theme';

function forgotPassword() {
  const msg = 'ระบบรีเซ็ตรหัสผ่านทางอีเมลกำลังจะมา ระหว่างนี้ติดต่อผู้ดูแลระบบได้เลย';
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('ลืมรหัสผ่าน', msg);
}

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email || !password) return setError('กรอกอีเมลและรหัสผ่าน');
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
    <AuthShell
      title="Come on in! 😎"
      subtitle="เข้าระบบก่อน ค่อยว่ากัน"
      footer={
        <Text style={{ textAlign: 'center', color: colors.muted }}>
          ยังไม่มีบัญชี?{' '}
          <Link href="/sign-up" style={{ color: colors.text, fontWeight: '700' }}>
            สมัครเลย
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
          label="รหัสผ่าน"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={hidden}
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
          right={<EyeToggle hidden={hidden} onPress={() => setHidden((h) => !h)} />}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={forgotPassword} hitSlop={8}>
            <Text style={{ fontSize: 12, color: colors.text }}>ลืมรหัสผ่าน?</Text>
          </Pressable>
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title="เข้าสู่ระบบ" onPress={submit} loading={busy} />
      </View>
      <SocialButtons verb="เข้าสู่ระบบ" />
    </AuthShell>
  );
}
