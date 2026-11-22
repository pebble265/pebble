import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, type TextInputInstance } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { GoogleButton } from '../components/auth-social';
import { At, Brand, Dot, FField, FigmaFrame, FText, LearnMore, PAGE_BG, RememberMe, useS } from '../components/figma';
import { learnMore, say } from '../lib/about';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** "→  Sign-Up" (Figma: Rectangle 7, 148 x 37). */
function SignUpButton({ onPress, busy }: { onPress(): void; busy: boolean }) {
  const s = useS();
  return (
    <At left={219} top={567} width={148} height={37}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Sign-Up"
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: s(8),
          backgroundColor: colors.primary,
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}>
        {busy ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <>
            <Ionicons name="arrow-forward" size={s(22)} color={colors.primaryText} style={{ position: 'absolute', left: s(13) }} />
            <Text style={{ position: 'absolute', right: s(16), fontSize: s(16), color: colors.primaryText }}>Sign-Up</Text>
          </>
        )}
      </Pressable>
    </At>
  );
}

/** "pebble(a) - Sign-Up" (email form) from Figma, 1:1. */
function SignUpFrame() {
  const { signUp, setRemember } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [remember, setRememberState] = useState(true);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<TextInputInstance>(null);
  const pwRef = useRef<TextInputInstance>(null);
  const cpwRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.includes('@')) return say('Sign-Up', 'อีเมลไม่ถูกต้อง');
    if (!name.trim()) return say('Sign-Up', 'ใส่ Username (ชื่อที่อยากให้ Pebble เรียก)');
    if (password.length < 8) return say('Sign-Up', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if (password !== confirmPw) return say('Sign-Up', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    setBusy(true);
    try {
      await setRemember(remember);
      await signUp(name, email, password);
    } catch (e) {
      say('Sign-Up', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FigmaFrame>
      <Brand
        logo={{ left: 124, top: 93, width: 41, height: 39 }}
        dot={{ left: 174, top: 113, size: 4 }}
        word={{ left: 190, top: 99, size: 24, text: 'pebble™' }}
      />

      <FText left={35} top={163} size={32}>
        Let’s Sign-Up
      </FText>
      <FText left={36} top={201} size={32}>
        Feel free to be here!
      </FText>

      <FText left={34.5} top={248} size={12}>
        Email
      </FText>
      <FField
        left={35}
        top={267}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
        accessibilityLabel="Email"
      />

      <FText left={34.5} top={323} size={12}>
        Username
      </FText>
      <Dot left={197} top={323} size={3} />
      <FField
        left={35}
        top={342}
        inputRef={nameRef}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="nickname"
        maxLength={100}
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
        accessibilityLabel="Username"
      />

      <FText left={34.5} top={402} size={12}>
        Password
      </FText>
      <Dot left={197} top={400} size={3} />
      <FField
        left={35}
        top={421}
        inputRef={pwRef}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => cpwRef.current?.focus()}
        accessibilityLabel="Password"
      />

      <FText left={34.5} top={485} size={12}>
        Confirm Password
      </FText>
      <Dot left={197} top={483} size={3} />
      <FField
        left={35}
        top={505}
        inputRef={cpwRef}
        value={confirmPw}
        onChangeText={setConfirmPw}
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
        box={{ left: 35, top: 553 }}
        label={{ left: 52.5, top: 553 }}
      />
      <SignUpButton onPress={submit} busy={busy} />

      <FText left={186} top={620} size={12}>
        OR
      </FText>

      <GoogleButton
        label="Sign-Up with google"
        rect={{ left: 39, top: 670 }}
        icon={{ left: 70, top: 693, size: 18 }}
        textRight={17}
      />

      <LearnMore left={25} top={808} onPress={learnMore} />
    </FigmaFrame>
  );
}

export default function SignUpEmail() {
  useTheme();
  return (
    <ScrollView alwaysBounceVertical={false}
      style={{ flex: 1, backgroundColor: PAGE_BG }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: PAGE_BG }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      bounces={false}>
      <SignUpFrame />
    </ScrollView>
  );
}
