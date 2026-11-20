import { router } from 'expo-router';
import { useState } from 'react';
import { FButton, FORGOT_BG, ForgotScreen, PwIcon } from '../components/forgot';
import { FField, FText } from '../components/figma';
import { say } from '../lib/about';
import { api, errorText } from '../lib/api';
import { resetFlow } from '../lib/reset-flow';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Forget Password Email" from Figma, 1:1. */
export default function ForgotEmail() {
  useTheme();
  const [email, setEmail] = useState(resetFlow.email);
  const [busy, setBusy] = useState(false);

  async function send() {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return say('Forget Password', 'ใส่อีเมลที่ใช้สมัคร Pebble นะ');
    setBusy(true);
    try {
      const r = await api<{ resendAfter: number }>('/auth/password/forgot', {
        method: 'POST',
        auth: false,
        body: { email: value },
      });
      resetFlow.email = value;
      resetFlow.resendAt = Date.now() + r.resendAfter * 1000;
      router.push('/forgot-verify');
    } catch (e) {
      say('Forget Password', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForgotScreen bg={FORGOT_BG.email}>
      <PwIcon left={29} top={285} size={70} q={{ cx: 67.3, cy: 51.5, font: 18 }} />

      <FText left={35} top={348} size={28} weight="700">
        Forget your Password?
      </FText>
      <FText left={36} top={379} size={16}>
        put in your email address
      </FText>

      <FField
        left={35}
        top={409}
        fontSize={14}
        padLeft={9}
        placeholder="you@example.com"
        placeholderColor={colors.ink}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={send}
        accessibilityLabel="Email"
      />

      <FButton left={35} top={467} width={155} label="Send a request" onPress={send} busy={busy} />
      <FButton left={200} top={467} width={167} label="Cancel" bg="#FF4141" onPress={() => router.dismissTo('/sign-in')} />
    </ForgotScreen>
  );
}
