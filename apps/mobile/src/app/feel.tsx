import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Keyboard, Platform, useWindowDimensions, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text, TextInput } from '../components/text';
import { GradientText } from '../components/setup';
import { api, errorText } from '../lib/api';
import { MOODS } from '../lib/format';
import { moodFlow } from '../lib/mood-flow';
import { useTheme } from '../lib/theme-mode';

/** Words for each check-in face. Positive ones celebrate, low ones comfort. */
const FEEL: Record<number, { line1: string; word: string; sub: string; low?: boolean }> = {
  7: { line1: 'Great To Feel', word: 'LOVED', sub: 'I hope you get this feeling everyday!' },
  6: { line1: 'Great To Feel', word: 'HAPPY', sub: 'Keep that smile, you deserve it!' },
  5: { line1: 'Great To Feel', word: 'CALM', sub: 'Enjoy this calm little moment.' },
  4: { line1: 'Nice To Feel', word: 'PEACEFUL', sub: 'Take a slow breath and enjoy it.' },
  3: { line1: "It's Okay To Feel", word: 'DOWN', sub: 'Small steps are still steps.', low: true },
  2: { line1: "It's Okay To Feel", word: 'SAD', sub: 'Pebbi is here if you want to talk.', low: true },
  1: { line1: "It's Okay To Feel", word: 'HEAVY', sub: "You're not alone. Pebbi is right here.", low: true },
};

/** Scattered emoji from Figma "Main Feel": [x center, y center, size] in the 402 x 874 frame. */
const SCATTER: [number, number, number][] = [
  [362, 29, 60], [9, 152, 56], [379, 355, 56], [53, 600, 56], [241, 851, 56],
  [90, 76, 30], [327, 121, 30], [64, 248, 30], [267, 201, 28], [166, 285, 28], [279, 316, 30], [77, 358, 28],
  [312, 426, 28], [313, 600, 30], [178, 664, 30], [380, 679, 26], [58, 763, 30], [319, 814, 30],
  [222, 111, 14], [96, 159, 14], [179, 213, 14], [337, 263, 14], [69, 297, 14], [41, 446, 14],
  [362, 511, 14], [96, 683, 14], [267, 712, 14], [136, 792, 14], [27, 855, 14], [377, 852, 14],
];

function Floating({ emoji, x, y, size, k, i }: { emoji: string; x: number; y: number; size: number; k: number; i: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 900, delay: 40 * i, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [t, i]);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 1600 + (i % 5) * 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 1600 + (i % 5) * 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, i]);
  const box = size * 1.3;
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: (x - box / 2) * k,
        top: (y - box / 2) * k,
        width: box * k,
        height: box * k,
        fontSize: size * k,
        lineHeight: box * k,
        textAlign: 'center',
        opacity: t,
        transform: [
          { translateY: Animated.add(t.interpolate({ inputRange: [0, 1], outputRange: [40 * k, 0] }), drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8 * k] })) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
        ],
      }}>
      {emoji}
    </Animated.Text>
  );
}

/** "pebble(a) - Main Feel": celebration (or comfort) after a quick emotional check-in. */
export default function Feel() {
  useTheme();
  const { score } = useLocalSearchParams<{ score?: string }>();
  const n = Number(score);
  const mood = MOODS.find((m) => m.score === n) ?? MOODS[6];
  const feel = FEEL[mood.score];
  const { width, height } = useWindowDimensions();
  const k = width / 402;

  // Lift the content above the keyboard while the note is being written: everything here is absolutely
  // positioned, so KeyboardAvoidingView can't move it.
  const lift = useRef(new Animated.Value(0)).current;
  const noteBottom = ((feel.low ? 608 : 560) + 44 + 28) * k;
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const room = height - e.endCoordinates.height - 16;
      Animated.timing(lift, { toValue: -Math.max(0, noteBottom - room), duration: e.duration || 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      Animated.timing(lift, { toValue: 0, duration: e?.duration || 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [height, noteBottom, lift]);

  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    // Happy moods close by themselves (unless a note is being written); low moods stay until the user chooses.
    if (feel.low || writing) return;
    const t = setTimeout(() => router.back(), 4500);
    return () => clearTimeout(t);
  }, [pop, feel.low, writing]);

  async function saveNote() {
    const text = note.trim();
    if (!text) return router.back();
    setSaving(true);
    setNoteError('');
    try {
      const entry = await moodFlow.pending;
      if (!entry) throw new Error('บันทึกความรู้สึกไม่สำเร็จ ลองใหม่อีกครั้ง');
      await api(`/moods/${entry.id}`, { method: 'PATCH', body: { note: text } });
      router.back();
    } catch (e) {
      setNoteError(e instanceof Error && !('status' in e) ? e.message : errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pressable style={{ flex: 1 }} onPress={() => (writing ? Keyboard.dismiss() : router.back())} accessibilityLabel="ปิด" accessibilityRole="button">
      <BlurView intensity={16} tint="default" style={{ position: 'absolute', inset: 0 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' }} />
      </BlurView>

      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {SCATTER.map(([x, y, size], i) => (
          <Floating key={i} emoji={mood.emoji} x={x} y={y} size={size} k={k} i={i} />
        ))}
      </View>

      <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 874 * k, transform: [{ translateY: lift }] }}>
        <Animated.Text
          style={{
            position: 'absolute',
            left: 0,
            width: 402 * k,
            top: (379 - 62) * k,
            fontSize: 96 * k,
            lineHeight: 124 * k,
            textAlign: 'center',
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          }}>
          {mood.emoji}
        </Animated.Text>

        <GradientText left={76} top={431} width={250} size={36} align="center" from="#FFF" fromStop={50} to="#FF9595" stop={123} angle={102}>
          {feel.line1}
        </GradientText>
        <GradientText left={76} top={463} width={250} size={36} align="center" from="#FFF" fromStop={50} to="#FF9595" stop={123} angle={102}>
          {feel.word}
        </GradientText>
        <GradientText left={51} top={516} width={300} size={15} weight="500" align="center" from="#FFF" fromStop={36} to="#FF9595" stop={133} angle={108}>
          {feel.sub}
        </GradientText>

        {feel.low && (
          <Pressable
            onPress={() => router.replace('/quick-chat')}
            accessibilityRole="button"
            style={({ pressed }) => ({
              position: 'absolute',
              left: 126 * k,
              width: 150 * k,
              top: 552 * k,
              height: 40 * k,
              borderRadius: 20 * k,
              backgroundColor: 'rgba(255,255,255,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            <Text style={{ fontSize: 15 * k, fontWeight: '600', color: '#1B1B1F' }}>คุยกับ Pebbi</Text>
          </Pressable>
        )}

        {/* optional note with this check-in (shows in Journal) */}
        {writing ? (
          <View style={{ position: 'absolute', left: 36 * k, width: 330 * k, top: (feel.low ? 608 : 560) * k, gap: 8 * k }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k, borderRadius: 22 * k, backgroundColor: 'rgba(255,255,255,0.95)', paddingLeft: 16 * k, paddingRight: 6 * k }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                autoFocus
                placeholder="วันนี้เป็นยังไงบ้าง เขียนสั้น ๆ ได้เลย"
                placeholderTextColor="#8E8E93"
                maxLength={500}
                returnKeyType="done"
                onSubmitEditing={saveNote}
                accessibilityLabel="โน้ต"
                style={{ flex: 1, minHeight: 44 * k, fontSize: 14 * k, color: '#1B1B1F', outlineWidth: 0 }}
              />
              <Pressable
                onPress={saveNote}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="บันทึกโน้ต"
                style={{ height: 34 * k, paddingHorizontal: 14 * k, borderRadius: 17 * k, backgroundColor: '#1B1B1F', alignItems: 'center', justifyContent: 'center' }}>
                {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: '#FFF', fontSize: 13 * k, fontWeight: '600' }}>บันทึก</Text>}
              </Pressable>
            </View>
            {noteError ? <Text style={{ color: '#FFD1D1', fontSize: 12 * k, textAlign: 'center' }}>{noteError}</Text> : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setWriting(true)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              position: 'absolute',
              left: 126 * k,
              width: 150 * k,
              top: (feel.low ? 604 : 556) * k,
              height: 36 * k,
              borderRadius: 18 * k,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ fontSize: 13 * k, fontWeight: '600', color: '#FFF' }}>+ เขียนโน้ต</Text>
          </Pressable>
        )}
      </Animated.View>
    </Pressable>
  );
}
