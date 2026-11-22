import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type TextInputInstance } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text, TextInput } from '../components/text';
import { FButton, FORGOT_BG, ForgotScreen, OtpBoxes, PwIcon } from '../components/forgot';
import { At, FText, useS } from '../components/figma';
import { say } from '../lib/about';
import { api, errorText } from '../lib/api';
import { resetFlow } from '../lib/reset-flow';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

const secondsLeft = () => Math.max(0, Math.ceil((resetFlow.resendAt - Date.now()) / 1000));

/** "pebble(a) - Forget Password Verify" from Figma, 1:1. */
export default function ForgotVerify() {
  useTheme();
  const s = useS();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(secondsLeft);
  const input = useRef<TextInputInstance>(null);
  const email = resetFlow.email;

  useEffect(() => {
    if (!email) router.replace('/forgot-email');
  }, [email]);

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  async function confirm(value = code) {
    if (value.length !== 5) return say('Verification', 'ใส่รหัส 5 หลักที่ส่งไปทางอีเมล');
    setBusy(true);
    try {
      const r = await api<{ resetToken: string }>('/auth/password/verify', {
        method: 'POST',
        auth: false,
        body: { email, code: value },
      });
      resetFlow.resetToken = r.resetToken;
      router.replace('/forgot-new');
    } catch (e) {
      setCode('');
      say('Verification', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (left > 0) return;
    try {
      const r = await api<{ resendAfter: number }>('/auth/password/forgot', {
        method: 'POST',
        auth: false,
        body: { email },
      });
      resetFlow.resendAt = Date.now() + r.resendAfter * 1000;
      setLeft(secondsLeft());
      setCode('');
      say('Verification', 'ส่งรหัสใหม่ไปที่อีเมลแล้ว');
    } catch (e) {
      say('Verification', errorText(e));
    }
  }

  return (
    <ForgotScreen bg={FORGOT_BG.verify}>
      <PwIcon left={39} top={131} size={70} q={{ cx: 68.3, cy: 48, font: 18 }} />

      <FText left={45} top={193} size={36}>
        Verification
      </FText>
      <FText left={48} top={243} width={334} size={14}>
        {`We’ve send OTP to ${email || 'you@example.com'} Please enter\n5 digits code you receive.`}
      </FText>

      {/* one real input behind the five boxes, so paste and SMS/email autofill work */}
      <At left={47} top={296} width={307} height={65}>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 5);
            setCode(digits);
            if (digits.length === 5) confirm(digits);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={5}
          autoFocus
          caretHidden
          accessibilityLabel="รหัสยืนยัน 5 หลัก"
          style={{ flex: 1, opacity: 0.011, color: 'transparent', fontSize: s(1) }}
        />
      </At>
      <OtpBoxes left={47} top={296} value={code} focused={focused} onPress={() => input.current?.focus()} />

      <FText left={48} top={371} size={14} color="#6C6969">
        {left > 0 ? `didn’t receive the code? Resend in ${left}s` : 'didn’t receive the code?'}
      </FText>
      <At left={49} top={390} height={18}>
        <Pressable onPress={resend} disabled={left > 0} accessibilityRole="button" accessibilityLabel="Resend" hitSlop={8}>
          <Text style={{ fontSize: s(15), color: colors.ink, textDecorationLine: 'underline' }}>Resend</Text>
        </Pressable>
      </At>

      <FButton left={44} top={428} width={155} label="Confirm" onPress={() => confirm()} busy={busy} />
    </ForgotScreen>
  );
}
