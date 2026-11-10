import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE, useKeyboardVisible } from '../../components/tab-bar';
import { ErrorText, RobotFace } from '../../components/ui';
import { ApiError, api, errorText } from '../../lib/api';
import type { ChatReply } from '../../lib/types';
import { colors, gradients, radius, shadow, space, type } from '../../theme';

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

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: 'pebble', text: 'สวัสดี วันนี้เป็นยังไงบ้าง เล่าให้ฟังได้เลยนะ' },
  ]);
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
    setMessages([{ id: nextId.current++, from: 'pebble', text: 'เริ่มคุยเรื่องใหม่ได้เลยนะ' }]);
    if (id) await api(`/chat/conversations/${id}/end`, { method: 'POST' }).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <RobotFace size={42} awake />
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>Pebbi</Text>
          <Text style={type.small}>{sending ? 'กำลังพิมพ์…' : 'อยู่ตรงนี้เสมอ'}</Text>
        </View>
        <Pressable onPress={endConversation} accessibilityRole="button" style={styles.newBtn}>
          <Ionicons name="refresh" size={16} color={colors.blue} />
          <Text style={{ color: colors.blue, fontWeight: '600' }}>เรื่องใหม่</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        {crisis && <CrisisBanner contacts={crisis} />}

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.from === 'me' ? styles.mine : styles.theirs]}>
              <Text style={{ fontSize: 16, color: m.from === 'me' ? colors.primaryText : colors.text }}>
                {m.text}
              </Text>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubble, styles.theirs]}>
              <ActivityIndicator color={colors.muted} />
            </View>
          )}
          <ErrorText>{error}</ErrorText>
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="พิมพ์ข้อความ…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={Platform.OS === 'web' ? () => send() : undefined}
            blurOnSubmit={Platform.OS === 'web'}
          />
          <Pressable
            onPress={() => send()}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="ส่ง"
            style={[styles.send, (!input.trim() || sending) && { opacity: 0.4 }]}>
            <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={[styles.disclaimer, { marginBottom: keyboard ? 0 : TAB_BAR_SPACE - 14 }]}>Pebbi เป็นเพื่อนคุย ไม่ใช่แพทย์ · ฉุกเฉินโทร 1669</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newBtn: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.blueSoft,
  },
  list: { padding: space.lg, gap: space.sm, maxWidth: 680, width: '100%', alignSelf: 'center' },
  bubble: { maxWidth: '82%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.blue, backgroundImage: gradients.pill, borderBottomRightRadius: 6 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    boxShadow: shadow.soft,
    borderBottomLeftRadius: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: space.sm },
  crisis: {
    margin: space.lg,
    marginBottom: 0,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F5C2BD',
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
});
