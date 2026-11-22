import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Rise, Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { useS } from '../components/figma';
import { ErrorText, confirm } from '../components/ui';
import { SubPage } from '../components/user-ui';
import { api, errorText } from '../lib/api';
import type { ChatConversation } from '../lib/types';
import { colors, gradients } from '../theme';
import { useTheme } from '../lib/theme-mode';

const dayKey = (iso: string) => new Date(iso).toDateString();

/** "วันนี้", "เมื่อวาน", or "ส. 21 พ.ย." */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'วันนี้';
  if (d.toDateString() === y.toDateString()) return 'เมื่อวาน';
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  }).format(d);
}

export const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Every conversation with Pebbi (app + robot), newest first. */
export default function ChatHistory() {
  useTheme();
  const s = useS();
  const [list, setList] = useState<ChatConversation[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await api<ChatConversation[]>('/chat/conversations'));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function clearAll() {
    if (!(await confirm('ลบประวัติแชตทั้งหมด?', 'ข้อความทุกเรื่องจะถูกลบถาวร กู้คืนไม่ได้ (สิ่งที่ Pebbi จำเกี่ยวกับคุณยังอยู่)', 'ลบทั้งหมด'))) return;
    try {
      await api('/chat/conversations', { method: 'DELETE' });
      setList([]);
    } catch (e) {
      setError(errorText(e));
    }
  }

  // group by day
  const groups: { label: string; items: ChatConversation[] }[] = [];
  for (const c of list ?? []) {
    const last = groups[groups.length - 1];
    if (last && dayKey(last.items[0].startedAt) === dayKey(c.startedAt)) last.items.push(c);
    else groups.push({ label: dayLabel(c.startedAt), items: [c] });
  }

  let i = 0;
  return (
    <SubPage title="ประวัติแชต" icon="time-outline">
      <View style={{ paddingHorizontal: s(36), gap: s(8) }}>
        {list === null && !error && <ActivityIndicator style={{ marginTop: s(40) }} color={colors.muted} />}
        <ErrorText>{error}</ErrorText>

        {list && list.length === 0 && (
          <Rise>
            <View style={{ alignItems: 'center', gap: s(8), marginTop: s(60) }}>
              <MaterialCommunityIcons name="chat-outline" size={s(44)} color={colors.faint} />
              <Text style={{ fontSize: s(15), fontWeight: '600', color: colors.muted }}>ยังไม่มีประวัติแชต</Text>
              <Text style={{ fontSize: s(12), color: colors.faint, textAlign: 'center' }}>
                คุยกับ Pebbi ในแอปหรือที่หุ่น แล้วจะย้อนกลับมาอ่านได้ที่นี่
              </Text>
            </View>
          </Rise>
        )}

        {groups.map((g) => (
          <View key={g.label} style={{ gap: s(8) }}>
            <Rise i={i++}>
              <Text style={{ fontSize: s(12), fontWeight: '600', color: colors.muted, marginTop: s(10), marginLeft: s(4) }}>{g.label}</Text>
            </Rise>
            {g.items.map((c) => (
              <Rise key={c.id} i={i++}>
                <Pressable
                  onPress={() => router.push({ pathname: '/chat-log', params: { id: c.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`แชต ${timeLabel(c.startedAt)} ${c.preview ?? ''}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: s(12),
                    padding: s(14),
                    borderRadius: s(20),
                    backgroundColor: colors.surface,
                    backgroundImage: gradients.cardFaint,
                    boxShadow: '0 -2px 18px rgba(0,0,0,0.07)',
                  }}>
                  <View
                    style={{
                      width: s(38),
                      height: s(38),
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.fill,
                    }}>
                    {c.fromRobot ? (
                      <MaterialCommunityIcons name="robot-happy-outline" size={s(20)} color={colors.blue} />
                    ) : (
                      <Ionicons name="phone-portrait-outline" size={s(18)} color={colors.ink} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: s(2) }}>
                    <Text numberOfLines={1} style={{ fontSize: s(14), fontWeight: '700', color: colors.ink }}>
                      {c.preview ?? 'บทสนทนากับ Pebbi'}
                    </Text>
                    {c.summary ? (
                      <Text numberOfLines={2} style={{ fontSize: s(11.5), color: colors.muted }}>
                        {c.summary}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: s(10.5), color: colors.faint }}>
                      {timeLabel(c.startedAt)} · {c.fromRobot ? 'คุยที่หุ่น' : 'คุยในแอป'} · คุย {c.messages} รอบ
                      {!c.endedAt ? ' · กำลังคุย' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={s(16)} color={colors.faint} />
                </Pressable>
              </Rise>
            ))}
          </View>
        ))}

        {list && list.length > 0 && (
          <Pressable onPress={clearAll} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: s(24), padding: s(8) }}>
            <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.danger }}>ลบประวัติแชตทั้งหมด</Text>
          </Pressable>
        )}
        <Text style={{ fontSize: s(10.5), color: colors.faint, textAlign: 'center', marginTop: s(6) }}>
          แชตถูกเข้ารหัสและเห็นได้เฉพาะคุณ ผู้ดูแลมองไม่เห็นข้อความ
        </Text>
      </View>
    </SubPage>
  );
}
