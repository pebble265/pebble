import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, type TextInputInstance } from 'react-native';
import { Text } from '../components/text';
import { GoogleButton } from '../components/auth-social';
import { At, Brand, Dot, FField, FigmaFrame, FText, LearnMore, PAGE_BG, RememberMe, useS } from '../components/figma';
import { learnMore, say } from '../lib/about';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** Black 334 x 37 "Continue" button (Figma: Rectangle 7). */
function ContinueButton({ onPress, busy }: { onPress(): void; busy: boolean }) {
  const s = useS();
  return (
    <At left={36} top={483} width={334} height={37}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: s(8),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}>
        {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={{ color: colors.primaryText, fontSize: s(16) }}>Continue</Text>}
      </Pressable>
    </At>
  );
}

/** "pebble(a) - Sign-In" from Figma, 1:1. */
function SignInFrame() {
  const { signIn, setRemember } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRememberState] = useState(true);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) return say('Sign-In', 'กรอกอีเมลและรหัสผ่าน');
    if (!email.includes('@')) return say('Sign-In', 'ตอนนี้เข้าสู่ระบบด้วยอีเมลที่ใช้สมัครนะ');
    setBusy(true);
    try {
      await setRemember(remember);
      await signIn(email, password);
    } catch (e) {
      say('Sign-In', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FigmaFrame>
      <Brand
        logo={{ left: 111, top: 101, width: 52, height: 50 }}
        dot={{ left: 175, top: 122, size: 7 }}
        word={{ left: 194, top: 103, size: 32, text: 'pebble' }}
      />

      <FText left={37} top={206} size={32}>
        Come on in!
      </FText>
      <FText left={201} top={202} size={40}>
        😎
      </FText>
      <FText left={37} top={244} size={32}>
        Sign-In First, Worry Later
      </FText>

      <FText left={37.5} top={295} size={12}>
        Username or Email
      </FText>
      <FField
        left={38}
        top={314}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        accessibilityLabel="Username or Email"
      />
      <Dot left={200} top={370} size={3} />

      <FText left={37.5} top={372} size={12}>
        Password
      </FText>
      <FField
        left={38}
        top={391}
        inputRef={passwordRef}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        accessibilityLabel="Password"
      />

      <RememberMe
        checked={remember}
        onToggle={() => setRememberState((r) => !r)}
        box={{ left: 43, top: 441 }}
        label={{ left: 60.5, top: 441 }}
      />
      <Dot left={200} top={446} size={3} />
      <At right={35} top={437} height={22}>
        <Pressable
          onPress={() => router.push('/forgot')}
          accessibilityRole="button"
          accessibilityLabel="Forget Password"
          hitSlop={8}
          style={{ paddingTop: 4 }}>
          <ForgetText />
        </Pressable>
      </At>

      <ContinueButton onPress={submit} busy={busy} />

      <FText left={0} width={402} top={544} size={12} align="center">
        OR
      </FText>

      <GoogleButton
        label="Sign-In with google"
        rect={{ left: 42, top: 590 }}
        icon={{ left: 73, top: 613, size: 18 }}
        textRight={26}
      />

      <At left={0} width={402} top={733} height={22}>
        <Pressable
          onPress={() => router.push('/sign-up')}
          accessibilityRole="button"
          accessibilityLabel="First time Here! Sign up"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <FirstTimeText />
        </Pressable>
      </At>

      <LearnMore left={25} top={808} onPress={learnMore} />
    </FigmaFrame>
  );
}

function ForgetText() {
  const s = useS();
  return <Text style={{ fontSize: s(12), color: colors.ink }}>Forget Password</Text>;
}

function FirstTimeText() {
  const s = useS();
  return <Text style={{ fontSize: s(12), color: colors.ink }}>First time Here!</Text>;
}

export default function SignIn() {
  useTheme();
  return (
    <ScrollView alwaysBounceVertical={false}
      style={{ flex: 1, backgroundColor: PAGE_BG }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: PAGE_BG }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      bounces={false}>
      <SignInFrame />
    </ScrollView>
  );
}
