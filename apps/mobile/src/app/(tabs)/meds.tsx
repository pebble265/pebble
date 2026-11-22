import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { Tap as Pressable, Stagger } from '@/components/motion';
import { Text } from '../../components/text';
import { useS } from '../../components/figma';
import { buildSchedule, ComingBar, type MedItem, NextCard } from '../../components/med-cards';
import { TAB_BAR_SPACE } from '../../components/tab-bar';
import { ErrorText } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import { syncMedAlarms } from '../../lib/med-alarms';
import type { Medication, TodayDoses } from '../../lib/types';
import { colors, gradients } from '../../theme';
import { useTheme } from '../../lib/theme-mode';
import { UserPhoto } from '../../components/user-ui';

/** Figma "pebble(a) - Med Main": next doses as white cards, later ones as blue bars. */
export default function Meds() {
  useTheme();
  const s = useS();
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [today, setToday] = useState<TodayDoses | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, t] = await Promise.all([api<Medication[]>('/medications'), api<TodayDoses>('/doses/today')]);
      setMeds(list);
      setToday(t);
      void syncMedAlarms(list, t); // alarm-clock reminders on this phone
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

  const { next, coming } = buildSchedule(today, meds);
  const show = (item: MedItem) => router.push({ pathname: '/med-show', params: { item: JSON.stringify(item) } });

  const label = (text: string) => (
    <Text style={{ marginLeft: s(35), fontSize: s(15), fontWeight: '500', color: colors.ink }}>{text}</Text>
  );
  const divider = <View style={{ alignSelf: 'center', width: s(56), height: s(2), borderRadius: s(12), backgroundColor: colors.line }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, backgroundImage: gradients.screen }}>
      <ScrollView alwaysBounceVertical={false}
        contentContainerStyle={{ paddingTop: s(102), paddingBottom: TAB_BAR_SPACE + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Stagger>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: s(45), paddingRight: s(37) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: s(18), fontWeight: '500', color: colors.ink }}>ตารางกินยาและประวัติ</Text>
            <Text style={{ fontSize: s(36), fontWeight: '700', color: colors.ink, letterSpacing: -0.5 }}>ยาของฉัน</Text>
          </View>
          <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button" accessibilityLabel="โปรไฟล์">
            <UserPhoto px={s(52)} />
          </Pressable>
        </View>

        <View style={{ height: s(14) }} />
        {divider}
        <View style={{ height: s(14) }} />

        <ErrorText>{error}</ErrorText>

        {meds && meds.length === 0 ? (
          <View style={{ alignItems: 'center', gap: s(10), paddingHorizontal: s(40), paddingVertical: s(30) }}>
            <MaterialCommunityIcons name="pill" size={s(44)} color={colors.faint} />
            <Text style={{ fontSize: s(17), fontWeight: '700' }}>ยังไม่มียา</Text>
            <Text style={{ fontSize: s(14), color: colors.muted, textAlign: 'center' }}>เพิ่มยาที่กินประจำ แล้ว Pebble จะปลุกเตือนเมื่อถึงเวลา</Text>
          </View>
        ) : (
          <>
            {label(next[0]?.when ? `ยาถัดไป · ${next[0].when}` : 'ยาถัดไป')}
            <View style={{ alignItems: 'center', gap: s(11), marginTop: s(10) }}>
              {next.map((item) => (
                <NextCard key={item.key} item={item} onPress={() => show(item)} />
              ))}
              {meds && !next.length && <Text style={{ fontSize: s(14), color: colors.muted }}>ไม่มียาที่ต้องกินในสัปดาห์นี้</Text>}
            </View>

            {coming.length > 0 && (
              <>
                <View style={{ height: s(15) }} />
                {divider}
                <View style={{ height: s(15) }} />
                {label('ยาที่จะถึงต่อไป')}
                <View style={{ alignItems: 'center', gap: s(10), marginTop: s(10) }}>
                  {coming.map((item) => (
                    <ComingBar key={item.key} item={item} onPress={() => show(item)} />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* manage / add (not in the design: the old list lives one tap away) */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: s(10), marginTop: s(26) }}>
          {meds && meds.length > 0 && (
            <Pressable
              onPress={() => router.push('/meds-manage')}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), height: s(40), paddingHorizontal: s(18), borderRadius: 999, backgroundColor: colors.fill }}>
              <MaterialCommunityIcons name="pencil" size={s(16)} color={colors.ink} />
              <Text style={{ fontSize: s(14), fontWeight: '600' }}>จัดการยา</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/medication-new')}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), height: s(40), paddingHorizontal: s(18), borderRadius: 999, backgroundColor: colors.primary }}>
            <Ionicons name="add" size={s(18)} color={colors.primaryText} />
            <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.primaryText }}>เพิ่มยา</Text>
          </Pressable>
        </View>
        </Stagger>
      </ScrollView>
    </View>
  );
}
