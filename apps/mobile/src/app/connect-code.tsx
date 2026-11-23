import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Keyboard, Platform, useWindowDimensions, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { At, useS } from '../components/figma';
import { DarkScreen, GradientText, SETUP_BG } from '../components/setup';
import { Text, TextInput } from '../components/text';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { firstSetup } from '../lib/first-setup';
import { useTheme } from '../lib/theme-mode';

const LEN = 6;

/**
 * First-time pairing: type the 6-digit code shown on the robot's screen.
 * (No Bluetooth: the robot asks the server for the code and shows it on its Setup screen.)
 */
export default function ConnectCode() {
  useTheme();
  return (
    <Lift>
      <DarkScreen bg={SETUP_BG.code}>
        <CodeForm />
      </DarkScreen>
    </Lift>
  );
}

/** Moves the whole screen up while the number pad is open, so the button stays visible. */
function Lift({ children }: { children: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const k = width / 402;
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const bottom = 790 * k; // under the Connect button
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const room = height - e.endCoordinates.height - 12;
      Animated.timing(lift, { toValue: -Math.max(0, bottom - room), duration: e.duration || 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      Animated.timing(lift, { toValue: 0, duration: e?.duration || 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [height, k, lift]);
  return <Animated.View style={{ flex: 1, backgroundColor: '#000', transform: [{ translateY: lift }] }}>{children}</Animated.View>;
}

function CodeForm() {
  const s = useS();
  const { reloadUser } = useAuth();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      Keyboard.dismiss();
      firstSetup.start(); // next: pick medicines -> All Set -> Home
      await reloadUser(); // robotSetupAt is set -> the app leaves the setup screens
    } catch (e) {
      setError(errorText(e));
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  const connect = (value = code) => {
    if (value.length !== LEN || busy) return;
    run(() => api('/devices/pair', { method: 'POST', body: { code: value } }));
  };
  const skip = () => run(() => api('/users/me/robot-setup', { method: 'POST', body: { skipped: true } }));

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, LEN);
    setCode(digits);
    setError('');
    if (digits.length === LEN) connect(digits);
  }

  const BOX = 44;
  const GAP = 8;
  const rowLeft = (402 - (BOX * LEN + GAP * (LEN - 1))) / 2;

  return (
    <>
      <GradientText left={35} top={536} width={340} size={32}>
        Enter your code
      </GradientText>
      <At left={35} top={584} width={340}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: s(13.5) }}>พิมพ์รหัส 6 หลักที่ขึ้นบนจอหุ่น pebble(a) ของคุณ</Text>
      </At>

      {/* six boxes; one hidden input underneath does the typing */}
      <At left={rowLeft} top={622} width={BOX * LEN + GAP * (LEN - 1)} height={58}>
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel="ช่องใส่รหัส 6 หลัก" style={{ flex: 1, flexDirection: 'row', gap: s(GAP) }}>
          {Array.from({ length: LEN }, (_, i) => {
            const active = i === code.length && !busy;
            return (
              <View
                key={i}
                style={{
                  width: s(BOX),
                  height: s(58),
                  borderRadius: s(14),
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FFF' : 'rgba(255,255,255,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: '#FFF', fontSize: s(26), fontWeight: '700' }}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LEN}
          autoFocus
          caretHidden
          editable={!busy}
          accessibilityLabel="รหัส 6 หลัก"
          style={{ position: 'absolute', inset: 0, opacity: 0.02, color: 'transparent' }}
        />
      </At>

      {!!error && (
        <At left={35} top={690} width={332}>
          <Text style={{ color: '#FFD1CF', fontSize: s(12.5), textAlign: 'center' }}>{error}</Text>
        </At>
      )}

      <At left={81} top={714} width={240} height={53}>
        <Pressable
          onPress={() => connect()}
          disabled={busy || code.length !== LEN}
          accessibilityRole="button"
          accessibilityLabel="Connect"
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: 999,
            backgroundColor: '#FFF',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: code.length === LEN || busy ? (pressed ? 0.85 : 1) : 0.45,
          })}>
          {busy ? <ActivityIndicator color="#111" /> : <Text style={{ color: '#111', fontSize: s(16), fontWeight: '700' }}>Connect</Text>}
        </Pressable>
      </At>

      <At left={101} top={772} width={200} height={26}>
        <Pressable onPress={skip} disabled={busy} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: s(12.5), textDecorationLine: 'underline' }}>ยังไม่มีหุ่น? ข้ามไปก่อน</Text>
        </Pressable>
      </At>
    </>
  );
}
