import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Alert, Text } from '../components/text';
import { At, FigmaFrame, FText, useS } from '../components/figma';
import { api } from '../lib/api';
import { type HealthToday, readHealthToday } from '../lib/health';
import type { Dose, MoodList, TodayDoses } from '../lib/types';
import { useTheme } from '../lib/theme-mode';

/** English names for the 7 check-in faces (Figma uses English on this screen). */
const MOOD_TEXT: Record<number, { emoji: string; name: string; text: string }> = {
  1: { emoji: '😭', name: 'Heavy', text: 'Today feels heavy. Be gentle with yourself, Pebbi is here whenever you want to talk.' },
  2: { emoji: '🥹', name: 'Sad', text: "It's okay to feel sad. Take it slow today, you don't have to carry it alone." },
  3: { emoji: '😢', name: 'Low', text: 'A low day happens. A small break or a chat with Pebbi might help a little.' },
  4: { emoji: '😌', name: 'Peaceful', text: 'Peaceful feeling coming right up to you today! It’s so wonderful! don’t you think?' },
  5: { emoji: '☺️', name: 'Calm', text: 'A calm and steady day. Keep that gentle pace going!' },
  6: { emoji: '😊', name: 'Good', text: 'You’re feeling good today! Hold on to that little sunshine.' },
  7: { emoji: '🥰', name: 'Wonderful', text: 'What a lovely day! Thank you for sharing the good vibes.' },
};

const clock = (iso: string) => {
  const t = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
  const [hm, ap] = t.split(' ');
  return { hm, ap: ap ?? '' };
};

/** White pill with the dose time, medicine and amount (Figma: Rectangle 71). */
function DoseCard({ dose }: { dose: Dose }) {
  const s = useS();
  const { hm, ap } = clock(dose.scheduledAt);
  const done = dose.status === 'taken';
  return (
    <>
      <At
        left={47}
        top={291}
        width={303}
        height={67}
        style={{
          borderRadius: s(23),
          backgroundColor: '#FFF',
          backgroundImage: 'linear-gradient(180deg, #FFF 68.61%, #999 232.85%)',
          boxShadow: '0 -4px 28.1px 0 rgba(0, 0, 0, 0.10)',
        }}
      />
      <At
        left={66}
        top={302}
        width={28}
        height={46}
        style={{ borderRadius: s(31), backgroundImage: 'linear-gradient(180deg, #FFEDC3 0%, #FB0 100%)', alignItems: 'center' }}>
        <MaterialCommunityIcons name={done ? 'check-bold' : 'weather-sunset-up'} size={s(12)} color="#FFF" style={{ marginTop: s(5) }} />
        <Text style={{ color: '#FFF', fontSize: s(8), fontWeight: '600', lineHeight: s(9), textAlign: 'center', marginTop: s(2) }}>
          {`${hm}\n${ap}`}
        </Text>
      </At>
      <At left={106} top={309} width={29} height={29} style={{ borderRadius: s(12), backgroundColor: '#51A2F8', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="pill" size={s(17)} color="#FFF" />
      </At>
      <FText color="#000" left={154} top={314} width={120} size={16} weight="600" style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
        {dose.medication.name}
      </FText>
      {!!dose.medication.dosage && (
        <FText color="#000" right={402 - 322.5} top={318} width={80} size={12} weight="600" align="right">
          {dose.medication.dosage}
        </FText>
      )}
    </>
  );
}

/** "pebble(a) - Main Brief" from Figma: Today Summary. */
function Brief() {
  const s = useS();
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [mood, setMood] = useState<MoodList['today']>(null);
  const [health, setHealth] = useState<HealthToday | null>(null);

  const loadHealth = useCallback((ask: boolean) => readHealthToday(ask).then(setHealth), []);

  useFocusEffect(
    useCallback(() => {
      api<TodayDoses>('/doses/today').then((t) => setDoses(t.doses)).catch(() => setDoses([]));
      api<MoodList>('/moods?days=1').then((m) => setMood(m.today)).catch(() => {});
      loadHealth(true); // first visit shows the Health permission sheet
    }, [loadHealth]),
  );

  const list = doses ?? [];
  const taken = list.filter((d) => d.status === 'taken').length;
  const pending = list.filter((d) => d.status === 'pending');
  const front = pending[0] ?? list[list.length - 1];
  const behind = pending[1];
  const medText =
    doses === null
      ? ''
      : list.length === 0
        ? 'No medicine scheduled for today.'
        : taken === list.length
          ? `You took all ${list.length} of today’s medicine. Well done!`
          : `Today you only take ${taken} time medicine you need\nto take ${list.length} times a day.`;

  const m = mood ? MOOD_TEXT[mood.score] : null;
  const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('en-US'));

  function healthHelp() {
    if (!health?.available) {
      return Alert.alert('Steps', Platform.OS === 'web' ? 'Steps come from Apple Health or Health Connect on your phone.' : 'This device has no health data to read.');
    }
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Apple Health',
        'ถ้าจำนวนก้าวไม่ขึ้น ให้เปิดแอป Health → รูปโปรไฟล์ → Apps → Pebble แล้วเปิด Steps และ Heart Rate',
        [{ text: 'ปิด', style: 'cancel' }, { text: 'เปิด Health', onPress: () => Linking.openURL('x-apple-health://') }],
      );
    } else {
      loadHealth(true);
    }
  }

  return (
    <FigmaFrame style={{ backgroundColor: '#1C3047', backgroundImage: 'linear-gradient(172deg, #1C3047 -4.35%, #FFABAB 100.23%)' }}>
      <At left={36} top={86} width={32} height={32}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="กลับ" hitSlop={10} style={{ flex: 1, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={s(22)} color="#FFF" />
        </Pressable>
      </At>

      <FText left={48} top={128.5} size={32} weight="700" color="#FFF">
        Today Summary
      </FText>
      <FText left={53} top={165} size={20} weight="500" color="#FFF">
        Get today Highlight
      </FText>
      <At left={310} top={148} width={30} height={30} style={{ pointerEvents: 'none' }}>
        <MaterialCommunityIcons name="weather-sunset" size={s(30)} color="#FFF" />
      </At>

      <FText left={53.5} top={217.5} size={24} weight="700" color="#FFF">
        Medicine Taken
      </FText>
      <FText left={53.5} top={246} width={300} size={13} weight="500" color="#FFF">
        {medText}
      </FText>

      {/* soft light behind the cards (Figma "Mask group") */}
      <At
        left={40}
        top={330}
        width={322}
        height={170}
        style={{ pointerEvents: 'none', backgroundImage: 'radial-gradient(ellipse at center, rgba(160,190,255,0.35) 0%, rgba(160,190,255,0) 70%)' }}
      />
      {behind && (
        <At left={97} top={377} width={207} height={52} style={{ borderRadius: s(20), backgroundColor: '#51A2F8', opacity: 0.22, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={{ color: '#FFF', fontSize: s(16), fontWeight: '600', textAlign: 'center' }}>
            {behind.medication.name}
            {behind.medication.dosage ? ` | ${behind.medication.dosage}` : ''}
          </Text>
        </At>
      )}
      {front && <DoseCard dose={front} />}
      {front && <At left={167} top={366} width={68} height={3} style={{ borderRadius: s(14), backgroundColor: '#D9D9D9' }} />}

      <FText left={0} width={402} top={432} size={77} align="center">
        {m?.emoji ?? '🫥'}
      </FText>
      <FText left={0} width={402} top={515} size={32} weight="700" color="#FFF" align="center">
        {m?.name ?? 'No check-in yet'}
      </FText>
      <FText left={81} width={240} top={556} size={16} weight="500" color="#FFF" align="center">
        {m?.text ?? 'Tell us how you feel on the Home screen, it only takes a tap.'}
      </FText>
      <At left={176} top={639} width={47} height={2} style={{ borderRadius: s(21), backgroundColor: '#FFF' }} />

      {/* Steps + heart rate from Apple Health / Health Connect */}
      <At left={60} top={660} width={280} height={70}>
        <Pressable onPress={healthHelp} accessibilityRole="button" accessibilityLabel={`ก้าวเดินวันนี้ ${fmt(health?.steps)} ก้าว หัวใจ ${fmt(health?.bpm)} ครั้งต่อนาที`} style={{ flex: 1 }} />
      </At>
      <At left={70} top={672} width={54} height={54} style={{ pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="shoe-sneaker" size={s(50)} color="#FFF" style={{ transform: [{ rotate: '-30deg' }] }} />
      </At>
      <FText left={132} top={682} size={20} weight="800" color="#FFF" style={{ pointerEvents: 'none' }}>
        {fmt(health?.steps)}
      </FText>
      <FText left={132.5} top={701} size={15} color="#FFF" style={{ pointerEvents: 'none' }}>
        steps
      </FText>
      <At left={206} top={669} width={59} height={59} style={{ pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="heart-pulse" size={s(54)} color="#FFF" />
      </At>
      <FText left={271.5} top={682} size={20} weight="800" color="#FFF" style={{ pointerEvents: 'none' }}>
        {fmt(health?.bpm)}
      </FText>
      <FText left={274} top={703} size={15} color="#FFF" style={{ pointerEvents: 'none' }}>
        BPM
      </FText>
      <FText left={81} width={240} top={729} size={13} weight="500" color="#FFF" align="center">
        {health && !health.available && Platform.OS === 'web'
          ? `Steps sync from Apple Health on your iPhone.`
          : (health?.steps ?? 0) >= 3000
            ? 'You did such a great job today!'
            : 'Every step counts, keep going!'}
      </FText>
    </FigmaFrame>
  );
}

export default function BriefScreen() {
  useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FFABAB' }} contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" />
      <Brief />
    </ScrollView>
  );
}
