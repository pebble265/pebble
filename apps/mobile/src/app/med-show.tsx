import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { useS } from '../components/figma';
import { type MedItem, NextCard, PillBadge } from '../components/med-cards';
import { confirm } from '../components/ui';
import { refreshMedAlarms } from '../lib/med-alarms';
import { api, errorText } from '../lib/api';
import { colors, periodOf, PERIODS } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** The backend refuses "taken" more than 1 hour early. */
const EARLY_MS = 60 * 60 * 1000;

/** Figma "pebble(a) - Med Show": the tapped medicine lifted over a blurred page, with its big photo card. */
export default function MedShow() {
  useTheme();
  const s = useS();
  const params = useLocalSearchParams<{ item?: string; at?: string }>();
  const item: MedItem | null = params.item ? JSON.parse(params.item) : null;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (!item) return null;

  const p = PERIODS.find((x) => x.key === periodOf(item.time))!;
  const [dose1, dose2] = (item.dosage ?? '').split('/').map((x) => x.trim());
  // a dose today that can be confirmed now (overdue, or due within the hour)
  const [h, m] = item.time.split(':').map(Number);
  const dueAt = new Date();
  dueAt.setHours(h, m, 0, 0);
  const canTake = !!item.doseId && !done && (item.missed || dueAt.getTime() - Date.now() <= EARLY_MS);

  async function take() {
    if (!item?.doseId) return;
    const ok = await confirm(`กิน ${item.name} แล้ว?`, item.dosage ?? 'บันทึกว่ากินยารอบนี้แล้ว', 'กินแล้ว');
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await api(`/doses/${item.doseId}/take`, { method: 'POST', body: { via: 'app' } });
      void refreshMedAlarms(); // taken before its time: today's alarm for it is dropped
      setDone(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="ปิด">
        <BlurView intensity={22} tint="default" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.14)' }} />
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="ย้อนกลับ"
        style={{ position: 'absolute', left: s(40), top: s(100) }}>
        <Ionicons name="chevron-back" size={s(24)} color={colors.ink} />
      </Pressable>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: s(35), top: s(191) }}>
        <NextCard item={item} lifted />
      </View>

      {/* big card */}
      <View
        style={{
          position: 'absolute',
          left: s(36),
          top: s(278),
          width: s(328),
          height: s(370),
          borderRadius: s(24),
          overflow: 'hidden',
          backgroundColor: '#DCA03A',
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}>
        <Image source={require('../../assets/images/med-show.jpg')} style={{ position: 'absolute', left: s(-22), top: 0, width: s(373), height: s(370) }} />
        {/* the medicine's own name printed on the box */}
        <View style={{ position: 'absolute', left: s(55), top: s(133), flexDirection: 'row', alignItems: 'center', gap: s(2) }}>
          <MaterialCommunityIcons name="pill" size={s(10)} color="#5BB8C4" />
          <Text style={{ fontSize: s(8.5), fontWeight: '600', color: '#5BB8C4' }}>pebble</Text>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ position: 'absolute', left: s(55), top: s(152), width: s(134), fontSize: s(12.5), fontWeight: '700', color: colors.ink }}>
          {item.name}
        </Text>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundImage: 'linear-gradient(180deg, rgba(220,160,58,0) 62%, rgba(206,140,36,0.65) 100%)' }}
        />

        <Text style={{ position: 'absolute', left: s(28), top: s(26), fontSize: s(32), lineHeight: s(27), fontWeight: '600', color: '#FFF' }}>
          {item.when ? item.when : 'next\nup'}
        </Text>
        <View style={{ position: 'absolute', right: s(20), top: s(22) }}>
          <PillBadge />
        </View>

        <Text numberOfLines={1} style={{ position: 'absolute', left: s(28), right: s(150), top: s(288), fontSize: s(24), fontWeight: '600', color: '#FFF' }}>
          {item.name}
        </Text>
        <Text numberOfLines={2} style={{ position: 'absolute', left: s(28), width: s(150), top: s(320), fontSize: s(15), lineHeight: s(15), fontWeight: '600', color: '#FFF' }}>
          {[dose1, dose2].filter(Boolean).join('\n')}
        </Text>
        <View style={{ position: 'absolute', right: s(30), top: s(318), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
          <MaterialCommunityIcons name={p.icon} size={s(24)} color="#FFF" />
          <Text style={{ fontSize: s(20), fontWeight: '600', color: '#FFF' }}>{item.time}</Text>
        </View>
      </View>

      {(canTake || done || error) && (
        <View style={{ position: 'absolute', left: s(36), width: s(328), top: s(668), alignItems: 'center', gap: s(8) }}>
          {error ? <Text style={{ color: '#E5484D', fontSize: s(13), fontWeight: '600' }}>{error}</Text> : null}
          <Pressable
            onPress={take}
            disabled={busy || done}
            accessibilityRole="button"
            style={{ height: s(48), paddingHorizontal: s(28), borderRadius: 999, backgroundColor: done ? '#34C759' : colors.primary, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            {busy ? <ActivityIndicator color={colors.primaryText} /> : <Ionicons name={done ? 'checkmark-circle' : 'checkmark'} size={s(20)} color={done ? '#FFF' : colors.primaryText} />}
            <Text style={{ color: done ? '#FFF' : colors.primaryText, fontSize: s(16), fontWeight: '700' }}>{done ? 'บันทึกแล้ว' : 'กินแล้ว'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
