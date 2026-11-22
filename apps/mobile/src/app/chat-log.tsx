import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';
import { Animated, Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { useS } from '../components/figma';
import { ErrorText, confirm } from '../components/ui';
import { SubPage } from '../components/user-ui';
import { api, errorText } from '../lib/api';
import type { ChatLog } from '../lib/types';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';
import { dayLabel, timeLabel } from './chat-history';

/** One past conversation, read-only, with a delete button. */
export default function ChatLogScreen() {
  useTheme();
  const s = useS();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [log, setLog] = useState<ChatLog | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api<ChatLog>(`/chat/conversations/${id}/messages`).then(setLog, (e) => setError(errorText(e)));
  }, [id]);

  async function remove() {
    if (!(await confirm('ลบแชตนี้?', 'ข้อความในเรื่องนี้จะถูกลบถาวร กู้คืนไม่ได้', 'ลบ'))) return;
    try {
      await api(`/chat/conversations/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const title = log ? `${dayLabel(log.startedAt)} · ${timeLabel(log.startedAt)}` : 'แชต';
  return (
    <SubPage title={title} icon={log?.fromRobot ? 'hardware-chip-outline' : 'chatbubbles-outline'}>
      <View style={{ paddingHorizontal: s(24), gap: s(8) }}>
        {!log && !error && <ActivityIndicator style={{ marginTop: s(40) }} color={colors.muted} />}
        <ErrorText>{error}</ErrorText>
        {log && (
          <Text style={{ fontSize: s(11), color: colors.faint, textAlign: 'center', marginBottom: s(6) }}>
            {log.fromRobot ? 'คุยกับ Pebbi ที่หุ่น' : 'คุยกับ Pebbi ในแอป'}
            {log.open ? ' · ยังคุยอยู่' : ''}
          </Text>
        )}
        {log?.messages.length === 0 && (
          <Text style={{ fontSize: s(13), color: colors.muted, textAlign: 'center', marginTop: s(20) }}>
            แชตนี้เก่ากว่าตอนที่เริ่มเก็บประวัติ เลยไม่มีข้อความให้อ่าน
          </Text>
        )}
        {log?.messages.map((m, i) =>
          m.role === 'user' ? (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(Math.min(i, 12) * 40).springify().damping(17)}
              style={{ alignSelf: 'flex-end', maxWidth: '80%', alignItems: 'flex-end', gap: s(2) }}>
              <View style={{ backgroundColor: colors.blue, paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(16), borderBottomRightRadius: s(5) }}>
                <Text style={{ fontSize: s(14), color: '#FFF' }}>{m.text}</Text>
              </View>
              <Text style={{ fontSize: s(9.5), color: colors.faint }}>{timeLabel(m.at)}</Text>
            </Animated.View>
          ) : (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(Math.min(i, 12) * 40).springify().damping(17)}
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(6), maxWidth: '86%' }}>
              <Image source={require('../../assets/images/setup/avatar.png')} style={{ width: s(24), height: s(24), borderRadius: 999 }} />
              <View style={{ gap: s(2), flexShrink: 1 }}>
                <View style={{ backgroundColor: colors.surface, paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(16), borderBottomLeftRadius: s(5), boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                  <Text style={{ fontSize: s(14), color: colors.ink }}>{m.text}</Text>
                </View>
                <Text style={{ fontSize: s(9.5), color: colors.faint }}>{timeLabel(m.at)}</Text>
              </View>
            </Animated.View>
          ),
        )}
        {log && (
          <Pressable onPress={remove} accessibilityRole="button" style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(24), padding: s(8) }}>
            <Ionicons name="trash-outline" size={s(15)} color={colors.danger} />
            <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.danger }}>ลบแชตนี้</Text>
          </Pressable>
        )}
      </View>
    </SubPage>
  );
}
