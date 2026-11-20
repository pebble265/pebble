import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type TextInputInstance, View } from 'react-native';
import { Text } from '../components/text';
import { FButton, FORGOT_BG, ForgotScreen, PwIcon } from '../components/forgot';
import { Dot, FField, FText, RememberMe, useS } from '../components/figma';
import { say } from '../lib/about';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resetFlow } from '../lib/reset-flow';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Forget Password" (Create New Password) from Figma, 1:1. */
export default function ForgotNew() {
  useTheme();
  const s = useS();
  const { resetPassword, setRemember } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRememberState] = useState(true);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (!resetFlow.resetToken) router.replace('/forgot-email');
  }, []);

  async function submit() {
    if (password.length < 8) return say('Create New Password', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (password !== confirm) return say('Create New Password', 'รหัสผ่านสองช่องไม่ตรงกัน');
    setBusy(true);
    try {
      await setRemember(remember);
      await resetPassword(resetFlow.resetToken, password);
      resetFlow.clear(); // signed in: the app switches to Home by itself
    } catch (e) {
      say('Create New Password', errorText(e));
      if (e instanceof Error && /expired|หมดเวลา/.test(e.message)) router.dismissTo('/forgot-email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForgotScreen bg={FORGOT_BG.create}>
      <PwIcon left={162} top={127} size={70} />

      <FText left={0} width={402} top={196} size={36} align="center">
        Create New Password
      </FText>
      <FText left={51} width={300} top={243} size={14} align="center">
        {'Set a strong and rememberable password\nto secure your account'}
      </FText>

      <FField
        left={35}
        top={311}
        borderColor="#979797"
        fontSize={14}
        padLeft={16}
        placeholder="New Password"
        placeholderColor="#979797"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules="minlength: 8;"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accessibilityLabel="New Password"
      />
      <Dot left={197} top={364} size={3} />
      <FField
        left={35}
        top={378}
        inputRef={confirmRef}
        borderColor="#979797"
        fontSize={14}
        padLeft={16}
        placeholder="Confirm Password"
        placeholderColor="#979797"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        accessibilityLabel="Confirm Password"
      />

      <RememberMe
        checked={remember}
        onToggle={() => setRememberState((r) => !r)}
        box={{ left: 38, top: 427 }}
        label={{ left: 55, top: 427 }}
      />

      <FButton left={219} top={445} width={148} label="Sign-Up" onPress={submit} busy={busy}>
        <View style={{ position: 'absolute', left: s(12), top: s(7) }}>
          <Ionicons name="arrow-forward" size={s(24)} color="#FFF" />
        </View>
        <Text style={{ position: 'absolute', left: s(74), color: '#FFF', fontSize: s(16) }}>Sign-Up</Text>
      </FButton>
    </ForgotScreen>
  );
}
