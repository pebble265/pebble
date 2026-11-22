import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, ScrollView, type ScrollViewInstance, useWindowDimensions, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text, TextInput } from '../components/text';
import { ApiError, api, errorText } from '../lib/api';
import type { ChatReply } from '../lib/types';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** Figma "pebble(a) - Quick chat" / "Quick chat send" (402-wide frame). */
const FRAME_W = 402;

interface Msg {
  id: number;
  from: 'me' | 'pebbi';
  text: string;
}

type Contacts = NonNullable<ChatReply['crisis']>['contacts'];

/** Height of the on-screen keyboard (0 when hidden). */
function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

function Bubble({ msg, s }: { msg: Msg; s(n: number): number }) {
  const me = msg.from === 'me';
  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        paddingHorizontal: s(13),
        paddingVertical: s(8),
        borderRadius: s(18),
        ...(me ? { borderBottomRightRadius: s(5) } : { borderBottomLeftRadius: s(5) }),
        backgroundColor: me ? '#1385FF' : 'rgba(255,255,255,0.95)',
        ...(me && { backgroundImage: 'linear-gradient(180deg, #2E95FF 0%, #0A7BFF 100%)' }),
      }}>
      <Text style={{ fontSize: s(14), color: me ? '#FFF' : '#1B1B1F', lineHeight: s(19) }}>{msg.text}</Text>
    </View>
  );
}

export default function QuickChat() {
  useTheme();
  const { width } = useWindowDimensions();
  const k = width / FRAME_W;
  const s = (n: number) => n * k;
  const keyboard = useKeyboardHeight();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [crisis, setCrisis] = useState<Contacts | null>(null);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const list = useRef<ScrollViewInstance>(null);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    setMessages((m) => [...m, { id: nextId.current++, from: 'me', text }]);
    setSending(true);
    try {
      const body = { message: text, ...(conversationId.current && { conversationId: conversationId.current }) };
      let r: ChatReply;
      try {
        r = await api<ChatReply>('/chat/messages', { method: 'POST', body });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && conversationId.current) {
          conversationId.current = null;
          r = await api<ChatReply>('/chat/messages', { method: 'POST', body: { message: text } });
        } else throw e;
      }
      conversationId.current = r.conversationId;
      if (r.crisis) setCrisis(r.crisis.contacts);
      setMessages((m) => [...m, { id: nextId.current++, from: 'pebbi', text: r.reply }]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  const hasChat = messages.length > 0 || sending || !!error;
  // Figma: input bottom sits 16 pt above the keyboard (or above the home bar when it's closed).
  const bottom = keyboard ? keyboard + s(16) : s(60);
  const contacts = crisis?.length ? crisis : crisis ? [{ label: 'สายด่วนสุขภาพจิต', phone: '1323' }, { label: 'เจ็บป่วยฉุกเฉิน', phone: '1669' }] : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Home, blurred and dimmed (Figma: blur 5 + 36% black). Tap to close. */}
      <Pressable
        style={{ position: 'absolute', inset: 0 }}
        onPress={() => (Keyboard.isVisible() ? Keyboard.dismiss() : router.back())}
        accessibilityLabel="ปิด Quick Chat"
        accessibilityRole="button">
        <BlurView intensity={18} tint="default" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.36)' }} />
        </BlurView>
      </Pressable>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom }}>
        {/* Title with the black sparkle */}
        <View pointerEvents="none" style={{ alignItems: 'center', marginBottom: s(hasChat ? 23 : 31) }}>
          <MaterialCommunityIcons
            name="star-four-points"
            size={s(40)}
            color="#262626"
            style={{ position: 'absolute', left: s(75), top: s(-20), transform: [{ rotate: '32deg' }] }}
          />
          <Text
            style={{
              width: s(236),
              textAlign: 'center',
              color: '#FFF',
              fontSize: s(32),
              fontWeight: '700',
              lineHeight: s(28),
              paddingTop: s(4),
            }}>
            {'Quick Chat?\nTalk to pebbi!'}
          </Text>
        </View>

        {contacts && (
          <View style={{ marginHorizontal: s(17), marginBottom: s(12), padding: s(12), borderRadius: s(16), backgroundColor: colors.surface, gap: s(8) }} accessibilityRole="alert">
            <Text style={{ fontSize: s(14), fontWeight: '700', color: '#D93636' }}>คุณไม่ได้อยู่คนเดียว มีคนพร้อมคุยกับคุณตอนนี้</Text>
            <View style={{ flexDirection: 'row', gap: s(8), flexWrap: 'wrap' }}>
              {contacts.map((c) => (
                <Pressable
                  key={c.phone}
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`โทร ${c.label} ${c.phone}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: 999, backgroundColor: '#FF6868' }}>
                  <Ionicons name="call" size={s(14)} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: s(13) }}>
                    {c.phone} · {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {hasChat && (
          <ScrollView alwaysBounceVertical={false}
            ref={list}
            style={{ maxHeight: s(230), marginBottom: s(20) }}
            contentContainerStyle={{ paddingHorizontal: s(31), gap: s(8), flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} s={s} />
            ))}
            {sending && <Bubble msg={{ id: -1, from: 'pebbi', text: '…' }} s={s} />}
            {!!error && <Text style={{ color: '#FFD1D1', fontSize: s(13), textAlign: 'center' }}>{error}</Text>}
          </ScrollView>
        )}

        {/* Input pill (Rectangle 86 / 88 / 87) */}
        <View
          style={{
            marginLeft: s(17),
            width: s(369),
            height: s(57),
            borderRadius: s(28),
            backgroundColor: '#F2F7FF',
            backgroundImage: 'linear-gradient(122deg, #FFF 28.7%, #A9D1FF 177.24%)',
            boxShadow: '0 2px 34.4px 5px rgba(0, 0, 0, 0.15)',
          }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Your space Your thought."
            placeholderTextColor={colors.faint}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
            submitBehavior="submit"
            maxLength={2000}
            accessibilityLabel="พิมพ์ข้อความถึง Pebbi"
            style={{
              position: 'absolute',
              left: s(30 - 17),
              top: s(478 - 465),
              width: s(298),
              height: s(28),
              borderRadius: s(19),
              backgroundColor: colors.surface,
              backgroundImage: 'linear-gradient(202deg, #FFF 46.94%, #FF9A9A 321.72%)',
              paddingLeft: s(14),
              paddingRight: s(10),
              paddingVertical: 0,
              fontSize: s(13),
              color: colors.ink,
              outlineWidth: 0,
            }}
          />
          <Pressable
            onPress={send}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="ส่ง"
            hitSlop={8}
            style={({ pressed }) => ({
              position: 'absolute',
              left: s(336 - 17),
              top: s(478 - 465),
              width: s(28),
              height: s(28),
              borderRadius: s(10),
              backgroundColor: '#FF6868',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed || sending ? 0.7 : 1,
            })}>
            <Ionicons name="paper-plane" size={s(15)} color="#FFF" style={{ transform: [{ rotate: '-8deg' }] }} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
