import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Platform, Pressable, type TextInputInstance, View } from 'react-native';
import { Alert, Text } from '../components/text';
import { At, FField, FText, useS } from '../components/figma';
import { Avatar, LightScreen } from '../components/setup';
import { say } from '../lib/about';
import { api, errorText } from '../lib/api';
import { changeAvatar } from '../lib/avatar';
import { useAuth } from '../lib/auth';
import { termsFlow } from '../lib/terms-flow';
import type { Sex } from '../lib/types';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

const SEX_LABEL: Record<Sex, string> = { male: 'ชาย', female: 'หญิง', other: 'ไม่ระบุ' };
const SEXES = Object.keys(SEX_LABEL) as Sex[];
const THIS_YEAR = new Date().getFullYear();
/** Longest name that still fits on one line under the avatar. */
const NAME_MAX = 20;

const POLICY = {
  privacy: {
    title: 'Privacy Policy',
    text: 'Pebble ประมวลผลข้อมูลสุขภาพของคุณ (ตารางยา การกินยา และอารมณ์จากบทสนทนา) เพื่อเตือนกินยาและดูแลคุณ ชื่อยาและสรุปบทสนทนาถูกเข้ารหัสก่อนเก็บ ข้อความแชตจะถูกส่งไปประมวลผลที่ผู้ให้บริการ AI และคุณขอลบข้อมูลได้ทุกเมื่อ',
  },
  terms: {
    title: 'User Agreement',
    text: 'Pebble เป็นเพื่อนคุย ไม่ใช่แพทย์ และไม่ใช่บริการฉุกเฉิน หากอยู่ในอันตรายให้โทร 1669 หรือสายด่วนสุขภาพจิต 1323',
  },
} as const;

/** Small checkbox + grey label; the label opens the policy text. */
function Agree({
  checked,
  onToggle,
  box,
  label,
  kind,
}: {
  checked: boolean;
  onToggle(v: boolean): void;
  box: { left: number; top: number };
  label: { left: number; top: number };
  kind: keyof typeof POLICY;
}) {
  const s = useS();
  const p = POLICY[kind];
  // Both the label and ticking an empty box open the full Terms sheet, so nobody agrees unseen.
  const read = () => router.push('/terms');
  return (
    <>
      <At left={box.left - 6} top={box.top - 6} width={label.left - box.left + 6} height={23}>
        <Pressable
          onPress={() => (checked ? onToggle(false) : read())}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={p.title}
          hitSlop={6}
          style={{ flex: 1, paddingLeft: s(6), paddingTop: s(6) }}>
          <MaterialCommunityIcons
            name={checked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
            size={s(13)}
            color="#8B8B8B"
            style={{ marginLeft: -s(1), marginTop: -s(1) }}
          />
        </Pressable>
      </At>
      <At left={label.left} top={label.top - 4} height={20}>
        <Pressable onPress={read} accessibilityRole="link" hitSlop={4} style={{ paddingTop: s(4) }}>
          <Text style={{ fontSize: s(10), color: '#8B8B8B', letterSpacing: -0.2 }}>{p.title}</Text>
        </Pressable>
      </At>
    </>
  );
}

/** "pebble(a) - Create Account Setup" from Figma, 1:1. */
export default function CreateAccount() {
  useTheme();
  const s = useS();
  const { user, reloadUser } = useAuth();
  const consented = !!user?.onboardedAt;
  const [name, setName] = useState((user?.displayName ?? '').slice(0, NAME_MAX));
  const [pron, setPron] = useState((user?.pronunciation ?? '').slice(0, NAME_MAX));
  const [sex, setSex] = useState<Sex | null>(user?.sex ?? null);
  const [age, setAge] = useState(user?.birthYear ? String(THIS_YEAR - user.birthYear) : '');
  const [privacy, setPrivacy] = useState(consented);
  const [terms, setTerms] = useState(consented);
  const [busy, setBusy] = useState(false);
  const pronRef = useRef<TextInputInstance>(null);
  const ageRef = useRef<TextInputInstance>(null);

  function pickSex() {
    const options = SEXES.map((k) => SEX_LABEL[k]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, 'ยกเลิก'], cancelButtonIndex: options.length, title: 'Sex' },
        (i) => i < options.length && setSex(SEXES[i]),
      );
    } else if (Platform.OS === 'web') {
      const v = window.prompt(`Sex: ${options.map((o, i) => `${i + 1}=${o}`).join(', ')}`);
      const i = Number(v) - 1;
      if (SEXES[i]) setSex(SEXES[i]);
    } else {
      Alert.alert('Sex', undefined, [...SEXES.map((k) => ({ text: SEX_LABEL[k], onPress: () => setSex(k) })), { text: 'ยกเลิก', style: 'cancel' as const }]);
    }
  }

  const createRef = useRef<(agreedNow?: boolean) => void>(() => {});
  // Coming back from the Terms sheet.
  useFocusEffect(
    useCallback(() => {
      const a = termsFlow.answer;
      if (a === null) return;
      termsFlow.answer = null;
      setPrivacy(a);
      setTerms(a);
      if (a && termsFlow.continueCreate) {
        termsFlow.continueCreate = false;
        createRef.current(true); // latest form values, not the ones from the first render
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function create(agreedNow = false) {
    const years = Number(age);
    if (!name.trim()) return say('Create', 'ใส่ชื่อที่อยากให้ pebble เรียกคุณ');
    if (!sex) return say('Create', 'เลือกเพศก่อนนะ');
    if (!Number.isInteger(years) || years < 1 || years > 120) return say('Create', 'ใส่อายุเป็นตัวเลข');
    if (!agreedNow && (!privacy || !terms)) {
      termsFlow.continueCreate = true;
      return router.push('/terms');
    }
    setBusy(true);
    try {
      await api('/users/me/onboarding', {
        method: 'POST',
        body: {
          acceptTerms: true,
          acceptHealthData: true,
          displayName: name.trim(),
          pronunciation: pron.trim(),
          sex,
          birthYear: THIS_YEAR - years,
        },
      });
      await reloadUser();
      router.replace('/connect');
    } catch (e) {
      say('Create', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  createRef.current = create;

  const field = { borderColor: '#C6C6C6', radius: 10, height: 40, fontSize: 15, placeholderColor: '#BABABA' } as const;

  return (
    <LightScreen>
      <Avatar
        left={141}
        top={190}
        uri={user?.avatar}
        onPress={() => changeAvatar({ hasPhoto: !!user?.avatar, done: reloadUser })}
        badge={
          <View
            style={{
              position: 'absolute',
              left: s(227 - 141),
              top: s(280 - 190),
              width: s(20),
              height: s(20),
              borderRadius: 999,
              backgroundColor: '#FFBF3F',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <MaterialCommunityIcons name="pencil-outline" size={s(12)} color="#FFF" />
          </View>
        }
      />

      <FText left={0} width={402} top={315} size={24} weight="600" align="center" style={{ pointerEvents: 'none' }}>
        {name.trim() || 'Username'}
      </FText>
      <FText left={0} width={402} top={343} size={15} align="center" style={{ pointerEvents: 'none' }}>
        {pron.trim() || 'Pronounce'}
      </FText>

      <FField
        left={64}
        top={399}
        width={275}
        padLeft={17}
        {...field}
        placeholder="Username"
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX}
        autoComplete="name"
        textContentType="nickname"
        returnKeyType="next"
        onSubmitEditing={() => pronRef.current?.focus()}
        accessibilityLabel="Username"
      />
      <FField
        left={64}
        top={449}
        width={275}
        padLeft={17}
        {...field}
        inputRef={pronRef}
        placeholder="Pronunciation"
        value={pron}
        onChangeText={setPron}
        maxLength={NAME_MAX}
        returnKeyType="next"
        onSubmitEditing={pickSex}
        accessibilityLabel="Pronunciation"
      />

      {/* Sex: opens a picker */}
      <At left={64} top={497} width={135} height={40}>
        <Pressable
          onPress={pickSex}
          accessibilityRole="button"
          accessibilityLabel="Sex"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#C6C6C6',
            borderRadius: s(10),
            backgroundColor: colors.surface,
            justifyContent: 'center',
            paddingLeft: s(17),
          }}>
          <Text style={{ fontSize: s(15), color: sex ? '#000' : '#BABABA' }}>{sex ? SEX_LABEL[sex] : 'Sex'}</Text>
        </Pressable>
      </At>
      <At left={172} top={510} width={14} height={14} style={{ pointerEvents: 'none' }}>
        <MaterialCommunityIcons name="arrow-down-drop-circle-outline" size={s(14)} color="#BABABA" />
      </At>

      <FField
        left={204}
        top={497}
        width={135}
        padLeft={15}
        {...field}
        inputRef={ageRef}
        placeholder="Age"
        value={age}
        onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel="Age"
      />
      <At left={308} top={509} width={16} height={16} style={{ pointerEvents: 'none' }}>
        <Ionicons name="calendar-clear-outline" size={s(16)} color="#BABABA" />
      </At>

      <Agree kind="privacy" checked={privacy} onToggle={setPrivacy} box={{ left: 67, top: 545 }} label={{ left: 81, top: 544.5 }} />
      <Agree kind="terms" checked={terms} onToggle={setTerms} box={{ left: 146, top: 545 }} label={{ left: 160, top: 544.5 }} />

      <At left={67} top={570} width={138} height={37}>
        <Pressable
          onPress={() => create()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Create"
          style={({ pressed }) => ({ flex: 1, borderRadius: s(8), backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, justifyContent: 'center' })}>
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <>
              <View style={{ position: 'absolute', left: s(12), top: s(7) }}>
                <Ionicons name="arrow-forward" size={s(24)} color={colors.primaryText} />
              </View>
              <Text style={{ position: 'absolute', left: s(81), color: colors.primaryText, fontSize: s(16) }}>Create</Text>
            </>
          )}
        </Pressable>
      </At>
    </LightScreen>
  );
}
