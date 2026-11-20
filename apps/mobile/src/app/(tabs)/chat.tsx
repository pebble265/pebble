import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, type ScrollViewInstance, View, StyleSheet } from 'react-native';
import { Text, TextInput } from '../../components/text';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useS } from '../../components/figma';
import { useKeyboardVisible, useTabBarHeight } from '../../components/tab-bar';
import { ErrorText } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { ApiError, api, errorText } from '../../lib/api';
import type { ChatReply } from '../../lib/types';
import { colors, gradients, isDark, radius, space, themedStyles, type } from '../../theme';
import { useTheme } from '../../lib/theme-mode';
import { UserPhoto } from '../../components/user-ui';

interface Msg {
  id: number;
  from: 'me' | 'pebble';
  text: string;
}

type Contacts = NonNullable<ChatReply['crisis']>['contacts'];

/** Shown whenever the backend flags a crisis. Always visible, never dismissed by the AI. */
function CrisisBanner({ contacts }: { contacts: Contacts }) {
  const list = contacts.length
    ? contacts
    : [
        { label: 'สายด่วนสุขภาพจิต', phone: '1323' },
        { label: 'เจ็บป่วยฉุกเฉิน', phone: '1669' },
      ];
  return (
    <View style={styles.crisis} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Ionicons name="heart" size={18} color={colors.danger} />
        <Text style={[type.label, { color: colors.danger, flex: 1 }]}>
          คุณไม่ได้อยู่คนเดียว มีคนพร้อมคุยกับคุณตอนนี้
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {list.map((c) => (
          <Pressable
            key={c.phone}
            onPress={() => Linking.openURL(`tel:${c.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`โทร ${c.label} ${c.phone}`}
            style={styles.callBtn}>
            <Ionicons name="call" size={16} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontWeight: '700' }}>
              {c.phone} · {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Starters shown over the input while typing (faint to strong, like the design). */
const STARTERS = ['ไม่มีใครคุยด้วยเลย', 'วันนี้เหนื่อยมาก', 'สวัสดี Pebbi ตอนนี้เครียดมาก'];

/** Figma "pebble(a) - Pebbi / Pebbi Chat / Pebbi Chat Send". */
export default function Chat() {
  useTheme();
  const s = useS();
  const barHeight = useTabBarHeight();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [crisis, setCrisis] = useState<Contacts | null>(null);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const keyboard = useKeyboardVisible();

  // A message typed into "Quick chat" on the Home screen arrives as ?q=...
  const { q, t } = useLocalSearchParams<{ q?: string; t?: string }>();
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (q && t && handled.current !== t) {
      handled.current = t;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, t]);

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || sending) return;
    if (preset === undefined) setInput('');
    setError('');
    setMessages((m) => [...m, { id: nextId.current++, from: 'me', text }]);
    setSending(true);
    try {
      const body = { message: text, ...(conversationId.current && { conversationId: conversationId.current }) };
      let r: ChatReply;
      try {
        r = await api<ChatReply>('/chat/messages', { method: 'POST', body });
      } catch (e) {
        // Conversation closed on the server (idle 30 min / restart): start a new one.
        if (e instanceof ApiError && e.status === 404 && conversationId.current) {
          conversationId.current = null;
          r = await api<ChatReply>('/chat/messages', { method: 'POST', body: { message: text } });
        } else throw e;
      }
      conversationId.current = r.conversationId;
      if (r.crisis) setCrisis(r.crisis.contacts);
      setMessages((m) => [...m, { id: nextId.current++, from: 'pebble', text: r.reply }]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  async function endConversation() {
    const id = conversationId.current;
    conversationId.current = null;
    setCrisis(null);
    setMessages([]);
    if (id) await api(`/chat/conversations/${id}/end`, { method: 'POST' }).catch(() => {});
  }

  const empty = messages.length === 0;
  const name = user?.displayName?.trim();

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: s(102), paddingLeft: s(45), paddingRight: s(37) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: s(18), fontWeight: '500', color: colors.ink }}>ใจของคุณ ปลอดภัยที่นี่</Text>
            <Text style={{ fontSize: s(36), fontWeight: '700', color: colors.ink, letterSpacing: -0.5 }}>Pebbi</Text>
          </View>
          {!empty && (
            <Pressable onPress={endConversation} hitSlop={8} accessibilityRole="button" accessibilityLabel="เริ่มเรื่องใหม่" style={styles.newBtn}>
              <Ionicons name="refresh" size={s(15)} color={colors.ink} />
              <Text style={{ fontSize: s(12), fontWeight: '600' }}>เรื่องใหม่</Text>
            </Pressable>
          )}
          <UserPhoto px={s(42)} />
        </View>

        {crisis && <CrisisBanner contacts={crisis} />}

        <ScrollView alwaysBounceVertical={false}
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.list, empty && { flexGrow: 1, justifyContent: 'center' }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {empty && !keyboard && (
            <View style={{ alignItems: 'center', gap: s(6), paddingBottom: s(60) }}>
              <MaterialCommunityIcons name="star-four-points" size={s(40)} color={colors.ink} style={{ transform: [{ rotate: '-14deg' }] }} />
              <Text style={{ fontSize: s(32), fontWeight: '500', color: colors.muted, textAlign: 'center', lineHeight: s(40) }}>
                {`วันนี้คิดอะไรอยู่\n${name ? `${name}?` : 'บ้าง?'}`}
              </Text>
              <Text style={{ fontSize: s(11), color: colors.faint, marginTop: s(10) }}>Pebbi เป็นเพื่อนคุย ไม่ใช่แพทย์ · ฉุกเฉินโทร 1669</Text>
            </View>
          )}

          {empty && keyboard && (
            <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: s(10), paddingBottom: s(6) }}>
              {STARTERS.map((text, i) => (
                <Pressable key={text} onPress={() => send(text)} accessibilityRole="button" hitSlop={4}>
                  <Text style={{ fontSize: s(13 + i), color: colors.ink, opacity: [0.35, 0.6, 0.9][i] }}>{text}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {messages.map((m) =>
            m.from === 'me' ? (
              <View key={m.id} style={[styles.bubble, styles.mine]}>
                <Text style={{ fontSize: s(14), color: '#FFF' }}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.theirsRow}>
                <Image source={require('../../../assets/images/setup/avatar.png')} style={{ width: s(26), height: s(26), borderRadius: 999 }} />
                <View style={[styles.bubble, styles.theirs]}>
                  <Text style={{ fontSize: s(14), color: colors.ink }}>{m.text}</Text>
                </View>
              </View>
            ),
          )}
          {sending && (
            <View style={styles.theirsRow}>
              <Image source={require('../../../assets/images/setup/avatar.png')} style={{ width: s(26), height: s(26), borderRadius: 999 }} />
              <View style={[styles.bubble, styles.theirs]}>
                <ActivityIndicator color={colors.muted} size="small" />
              </View>
            </View>
          )}
          <ErrorText>{error}</ErrorText>
        </ScrollView>

        {/* input + send */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(12),
            paddingLeft: s(36),
            paddingRight: s(46),
            paddingTop: s(8),
            // sits just above the nav bar, same bar as every other tab
            paddingBottom: keyboard ? s(10) : barHeight + 10,
          }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="คุยกับ Pebbi"
            placeholderTextColor={colors.ink}
            style={[styles.input, { fontSize: s(13), minHeight: s(38), borderRadius: s(19), paddingHorizontal: s(16) }]}
            multiline
            maxLength={2000}
            onSubmitEditing={Platform.OS === 'web' ? () => send() : undefined}
            blurOnSubmit={Platform.OS === 'web'}
            accessibilityLabel="คุยกับ Pebbi"
          />
          <Pressable
            onPress={() => send()}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="ส่ง"
            style={[styles.send, { width: s(38), height: s(38), opacity: input.trim() && !sending ? 1 : 0.45 }]}>
<Ionicons name="arrow-up" size={s(20)} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.page,
    // the soft pink / lilac glow at the bottom of the design
    backgroundImage: gradients.glow,
  },
  newBtn: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  list: { paddingHorizontal: 40, paddingTop: 24, paddingBottom: 12, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#3B8BEF', borderBottomRightRadius: 4 },
  theirsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '88%' },
  theirs: { backgroundColor: colors.fill, borderBottomLeftRadius: 4, maxWidth: '100%' },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.ink,
    backgroundColor: colors.surface,
    backgroundImage: gradients.cardFaint,
    boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
    outlineWidth: 0,
  },
  send: {
    borderRadius: 999,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
  },
  crisis: {
    margin: space.lg,
    marginBottom: 0,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: isDark() ? '#6B2C27' : '#F5C2BD',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
}));
