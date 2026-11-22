import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../../../components/text';
import { useS } from '../../../components/figma';
import { Initial, Section } from '../../../components/care-ui';
import { confirm } from '../../../components/ui';
import { SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import { locale } from '../../../lib/i18n';
import { moodOf } from '../../../lib/format';
import type { CareAlert, CareOverview } from '../../../lib/types';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

function Box({ children }: { children: ReactNode }) {
  const s = useS();
  return (
    <View style={{ marginHorizontal: s(30), padding: s(14), borderRadius: s(16), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: s(8) }}>
      {children}
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const s = useS();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: s(20), fontWeight: '800', color: color ?? colors.ink }}>{value}</Text>
      <Text style={{ fontSize: s(11), color: colors.muted }}>{label}</Text>
    </View>
  );
}

const ROBOT: Record<string, string> = { online: 'ออนไลน์', charging: 'กำลังชาร์จ', offline: 'ออฟไลน์', unpaired: 'ยังไม่จับคู่' };

const when = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Profile → ผู้ดูแล → a person I look after: only what they chose to share, plus their alerts. */
export default function Caring() {
  useTheme();
  const s = useS();
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const [data, setData] = useState<CareOverview | null>(null);
  const [alerts, setAlerts] = useState<CareAlert[]>([]);
  const [error, setError] = useState('');
  const [acking, setAcking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!linkId) return;
    try {
      const [o, a] = await Promise.all([
        api<CareOverview>(`/caretaking/${linkId}`),
        api<CareAlert[]>('/caretaking-alerts'),
      ]);
      setData(o);
      setAlerts(a.filter((x) => x.linkId === linkId));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [linkId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function ack(id: string) {
    setAcking(id);
    try {
      await api(`/caretaking-alerts/${id}/ack`, { method: 'POST' });
      setAlerts((list) => list.map((a) => (a.deliveryId === id ? { ...a, acknowledgedAt: new Date().toISOString() } : a)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAcking(null);
    }
  }

  async function leave() {
    if (!data) return;
    const ok = await confirm(`เลิกเป็นผู้ดูแลของ ${data.displayName}?`, 'คุณจะไม่ได้รับการแจ้งเตือนและไม่เห็นข้อมูลของเขาอีก', 'เลิกเป็นผู้ดูแล');
    if (!ok) return;
    try {
      await api(`/caretaking/${data.linkId}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const a = data?.adherence;
  const moods = data?.moodTrend ?? [];
  const avg = moods.length ? moods.reduce((t, m) => t + m.score, 0) / moods.length : null;
  const last = moods[moods.length - 1];
  const shared = data && (data.permissions.viewAdherence || data.permissions.viewMoodTrend || data.permissions.alertOnDeviceIssue);

  return (
    <SubPage title={data?.displayName ?? 'คนที่ฉันดูแล'} icon="heart-outline">
      {!data && !error ? <ActivityIndicator style={{ marginTop: s(30) }} /> : null}
      {error ? <Text style={{ marginHorizontal: s(40), fontSize: s(12), color: colors.danger }}>{error}</Text> : null}

      {data && (
        <>
          <View style={{ alignItems: 'center', gap: s(6), marginBottom: s(4) }}>
            <Initial name={data.displayName} size={64} />
            <Text style={{ fontSize: s(12), color: colors.muted }}>
              {data.relationshipLabel ? `คุณเป็น${data.relationshipLabel}ของเขา` : 'คุณเป็นผู้ดูแล'}
            </Text>
          </View>

          <Section title="การแจ้งเตือน">
            {alerts.length === 0 ? (
              <Text style={{ marginHorizontal: s(40), fontSize: s(12), color: colors.faint }}>ยังไม่มีการแจ้งเตือน</Text>
            ) : (
              alerts.slice(0, 20).map((x) => {
                const urgent = x.type === 'crisis';
                return (
                  <View
                    key={x.deliveryId}
                    style={{
                      marginHorizontal: s(30),
                      marginBottom: s(8),
                      padding: s(12),
                      borderRadius: s(14),
                      backgroundColor: urgent && !x.acknowledgedAt ? colors.dangerSoft : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(10),
                    }}>
                    <Ionicons name={urgent ? 'warning' : x.type === 'missed_dose' ? 'medkit-outline' : 'hardware-chip-outline'} size={s(18)} color={urgent ? colors.danger : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: s(13), color: colors.ink, fontWeight: x.acknowledgedAt ? '400' : '600' }}>{x.message}</Text>
                      <Text style={{ fontSize: s(10.5), color: colors.muted, marginTop: s(2) }}>{when(x.createdAt)}</Text>
                    </View>
                    {x.acknowledgedAt ? (
                      <Text style={{ fontSize: s(11), color: colors.faint }}>รับทราบแล้ว</Text>
                    ) : (
                      <Pressable
                        onPress={() => ack(x.deliveryId)}
                        disabled={acking === x.deliveryId}
                        accessibilityRole="button"
                        style={{ paddingHorizontal: s(12), height: s(30), borderRadius: 999, backgroundColor: colors.primary, justifyContent: 'center' }}>
                        {acking === x.deliveryId ? (
                          <ActivityIndicator size="small" color={colors.primaryText} />
                        ) : (
                          <Text style={{ fontSize: s(12), fontWeight: '600', color: colors.primaryText }}>รับทราบ</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
            {alerts.some((x) => x.type === 'crisis' && !x.acknowledgedAt) && (
              <Text style={{ marginHorizontal: s(40), fontSize: s(11), lineHeight: s(16), color: colors.danger }}>
                กรุณาติดต่อเขาโดยเร็ว ถ้าเป็นเหตุฉุกเฉินโทร 1669 หรือสายด่วนสุขภาพจิต 1323 (24 ชั่วโมง)
              </Text>
            )}
          </Section>

          {data.permissions.viewAdherence && a && (
            <Section title="การกินยา 7 วันล่าสุด">
              <Box>
                <View style={{ flexDirection: 'row' }}>
                  <Stat value={a.rate == null ? '–' : `${Math.round(a.rate * 100)}%`} label="กินตรงเวลา" color={colors.blue} />
                  <Stat value={String(a.taken)} label="กินแล้ว" color={colors.success} />
                  <Stat value={String(a.missed)} label="ลืมกิน" color={a.missed ? colors.danger : undefined} />
                  <Stat value={String(a.skipped)} label="ข้าม" />
                </View>
              </Box>
            </Section>
          )}

          {data.permissions.viewMoodTrend && (
            <Section title="อารมณ์ 14 วันล่าสุด">
              <Box>
                {moods.length === 0 ? (
                  <Text style={{ fontSize: s(12), color: colors.faint }}>ยังไม่มีการเช็กอิน</Text>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row' }}>
                      <Stat value={`${moodOf(Math.round(avg!))?.emoji ?? ''} ${avg!.toFixed(1)}`} label="เฉลี่ย (เต็ม 7)" />
                      <Stat value={`${moodOf(last.score)?.emoji ?? ''} ${moodOf(last.score)?.label ?? ''}`} label={`ล่าสุด · ${when(last.at)}`} />
                    </View>
                    {/* one bar per check-in, tallest = 7 */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(3), height: s(44), marginTop: s(4) }}>
                      {moods.slice(-28).map((m, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: s(6 + (m.score / 7) * 38),
                            borderRadius: s(3),
                            backgroundColor: m.score <= 2 ? colors.danger : m.score <= 4 ? colors.sun : colors.online,
                          }}
                        />
                      ))}
                    </View>
                  </>
                )}
              </Box>
            </Section>
          )}

          {data.permissions.alertOnDeviceIssue && (
            <Section title="หุ่น pebble(a)">
              <Box>
                {(data.robots ?? []).length === 0 ? (
                  <Text style={{ fontSize: s(12), color: colors.faint }}>ยังไม่ได้จับคู่หุ่น</Text>
                ) : (
                  data.robots!.map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                      <View style={{ width: s(8), height: s(8), borderRadius: 999, backgroundColor: r.status === 'online' || r.status === 'charging' ? colors.online : colors.muted }} />
                      <Text style={{ flex: 1, fontSize: s(13), color: colors.ink }}>{ROBOT[r.status] ?? r.status}</Text>
                      <Text style={{ fontSize: s(12), color: colors.muted }}>{r.batteryLevel != null ? `แบต ${r.batteryLevel}%` : ''}</Text>
                    </View>
                  ))
                )}
              </Box>
            </Section>
          )}

          {!shared && (
            <Text style={{ marginHorizontal: s(40), marginTop: s(16), fontSize: s(12), color: colors.faint }}>
              {data.displayName} เลือกให้คุณรับแค่การแจ้งเตือน ไม่ได้แชร์สถิติ
            </Text>
          )}

          <Pressable onPress={leave} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: s(24), padding: s(8) }}>
            <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.danger }}>เลิกเป็นผู้ดูแล</Text>
          </Pressable>
        </>
      )}
    </SubPage>
  );
}
