import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from './text';
import { DAY_SHORT } from '../lib/format';
import { colors, gradients, type Period, PERIODS } from '../theme';
import { At, FigmaFrame, FText, useFigmaScale, useFrameHeight, useS } from './figma';
import { DosageWheel } from './time-wheel';

/** Reminder sounds (same keys as the API's ALARM_SOUNDS). */
export const SOUNDS = [
  { key: 'radial', label: 'Radial' },
  { key: 'chimes', label: 'Chimes' },
  { key: 'beacon', label: 'Beacon' },
  { key: 'bulletin', label: 'Bulletin' },
  { key: 'gentle', label: 'Gentle' },
] as const;

const ALL = [1, 2, 3, 4, 5, 6, 7];
const CHIP_X = [96, 170, 245, 318];

type Props = {
  times: Partial<Record<Period, string>>;
  editing: Period;
  onTogglePeriod(p: Period): void;
  onTime(v: string): void;
  everyDay: boolean;
  onEveryDay(v: boolean): void;
  days: number[];
  onDays(d: number[]): void;
  sound: string;
  onSound(s: string): void;
  onBack(): void;
  onSave(): void;
  busy: boolean;
  disabled?: boolean;
  error: string;
};

/** Figma "pebble(a) - Alarm …" frames: set the times for one medicine. */
export function DosageTimes(p: Props) {
  const s = useS();
  const frameH = useFrameHeight(useFigmaScale());
  const [picking, setPicking] = useState(false);
  const editingTime = p.times[p.editing];
  const selected = PERIODS.filter((x) => p.times[x.key]).length;
  const soundLabel = SOUNDS.find((x) => x.key === p.sound)?.label ?? 'Radial';
  const footerTop = p.everyDay ? 816 : 836;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ backgroundColor: colors.bg }} bounces={false}>
      <FigmaFrame style={{ backgroundColor: colors.bg, height: frameH }}>
        {/* back */}
        <At left={32} top={93} width={40} height={40}>
          <Pressable onPress={p.onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={s(22)} color={colors.ink} />
          </Pressable>
        </At>

        {/* save (the design has no button; kept small, top-right) */}
        <At right={24} top={97} height={32}>
          <Pressable
            onPress={p.onSave}
            disabled={p.busy || p.disabled}
            accessibilityRole="button"
            accessibilityLabel="บันทึก"
            style={{
              flex: 1,
              paddingHorizontal: s(16),
              borderRadius: s(16),
              backgroundColor: colors.primary,
              justifyContent: 'center',
              opacity: p.disabled ? 0.4 : 1,
            }}>
            {p.busy ? (
              <ActivityIndicator color={colors.primaryText} size="small" />
            ) : (
              <Text style={{ color: colors.primaryText, fontSize: s(15), fontWeight: '600' }}>บันทึก</Text>
            )}
          </Pressable>
        </At>

        {/* clock + title */}
        <At left={165} top={94} width={71} height={71} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="clock-outline" size={s(71)} color={colors.ink} />
        </At>
        <FText left={0} width={402} top={170} size={30} weight="700" align="center" style={{ lineHeight: s(37) }}>
          {'ตั้งเวลา\nกินยา'}
        </FText>

        {/* wheel */}
        {editingTime ? (
          <DosageWheel value={editingTime} onChange={p.onTime} />
        ) : (
          <FText left={0} width={402} top={372} size={15} weight="500" color={colors.faint} align="center">
            เลือกช่วงเวลาด้านล่างก่อน
          </FText>
        )}

        <FText left={0} width={402} top={529} size={15} weight="500" align="center" style={{ lineHeight: s(28) }}>
          กินยาช่วงไหน
        </FText>

        {/* morning / noon / evening / night */}
        {PERIODS.map((x, i) => {
          const on = !!p.times[x.key];
          const night = x.key === 'night';
          const outline = on && selected > 1 && p.editing === x.key;
          return (
            <At key={x.key} left={CHIP_X[i] - 37} top={571} width={74} height={66}>
              <Pressable
                onPress={() => p.onTogglePeriod(x.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${x.label}${on ? ` ${p.times[x.key]}` : ''}`}
                style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: s(52),
                    height: s(36),
                    borderRadius: s(14),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? (night ? '#194AA4' : '#FFCF33') : '#D2D2D2',
                    ...(on && !night && { backgroundImage: gradients.sun }),
                    ...(outline && { borderWidth: 2, borderColor: colors.ink }),
                  }}>
                  <MaterialCommunityIcons name={x.icon} size={s(22)} color="#FFF" />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: s(15), lineHeight: s(28), fontWeight: '500', color: on ? colors.ink : colors.faint }}>
                  {x.label}
                </Text>
              </Pressable>
            </At>
          );
        })}

        {p.error ? (
          <FText left={20} width={362} top={640} size={13} weight="500" color="#E5484D" align="center">
            {p.error}
          </FText>
        ) : null}

        {/* Sound */}
        <At left={24} top={666} width={348} height={50}>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`เสียงเตือน ${soundLabel}`}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: s(11), backgroundColor: colors.fill, paddingLeft: s(20), paddingRight: s(12) }}>
            <Text style={{ flex: 1, fontSize: s(15), fontWeight: '500', color: colors.ink }}>เสียงเตือน</Text>
            <Text style={{ fontSize: s(15), fontWeight: '500', color: colors.ink }}>{soundLabel}</Text>
            <Ionicons name="chevron-forward" size={s(18)} color={colors.ink} style={{ marginLeft: s(4) }} />
          </Pressable>
        </At>

        {/* Repeat */}
        <At left={24} top={723} width={348} height={50}>
          <Pressable
            onPress={() => p.onEveryDay(!p.everyDay)}
            accessibilityRole="switch"
            accessibilityState={{ checked: p.everyDay }}
            accessibilityLabel="กินทุกวัน"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: s(11), backgroundColor: colors.fill, paddingLeft: s(20), paddingRight: s(14) }}>
            <Text style={{ flex: 1, fontSize: s(15), fontWeight: '500', color: colors.ink }}>กินทุกวัน</Text>
            <View
              style={{
                width: s(64),
                height: s(28),
                borderRadius: 999,
                padding: s(2),
                backgroundColor: p.everyDay ? '#34C759' : '#D9D9DE',
                alignItems: p.everyDay ? 'flex-end' : 'flex-start',
              }}>
              <View style={{ width: s(38), height: s(24), borderRadius: 999, backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            </View>
          </Pressable>
        </At>

        {/* Repeat off: pick the days */}
        {!p.everyDay && (
          <At left={24} top={781} width={348} height={40} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {ALL.map((d) => {
              const on = p.days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => p.onDays(on ? p.days.filter((y) => y !== d) : [...p.days, d].sort())}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{
                    width: s(40),
                    height: s(40),
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.primary : colors.fill,
                  }}>
                  <Text style={{ fontSize: s(14), fontWeight: '600', color: on ? colors.primaryText : colors.ink }}>{DAY_SHORT[d]}</Text>
                </Pressable>
              );
            })}
          </At>
        )}

        {/* "· pebble" footer */}
        <At left={157} top={footerTop - 1} width={22} height={22}>
          <Image source={require('../../assets/images/splash-logo.png')} style={{ width: s(22), height: s(22) }} resizeMode="contain" />
        </At>
        <At left={185} top={footerTop + 9} width={4} height={4} style={{ borderRadius: 999, backgroundColor: colors.primary }} />
        <FText left={194} top={footerTop} size={15} weight="700">
          pebble
        </FText>
      </FigmaFrame>

      <SoundSheet
        visible={picking}
        value={p.sound}
        onPick={(k) => {
          p.onSound(k);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  );
}

function SoundSheet({ visible, value, onPick, onClose }: { visible: boolean; value: string; onPick(k: string): void; onClose(): void }) {
  const s = useS();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }} accessibilityLabel="ปิด">
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, borderTopLeftRadius: s(24), borderTopRightRadius: s(24), padding: s(20), paddingBottom: s(40), gap: s(8) }}>
          <Text style={{ fontSize: s(17), fontWeight: '700', textAlign: 'center', marginBottom: s(6) }}>เสียงเตือน</Text>
          {SOUNDS.map((x) => (
            <Pressable
              key={x.key}
              onPress={() => onPick(x.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: x.key === value }}
              style={{ height: s(50), borderRadius: s(11), backgroundColor: colors.fill, flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(20) }}>
              <Text style={{ flex: 1, fontSize: s(15), fontWeight: '500' }}>{x.label}</Text>
              {x.key === value && <Ionicons name="checkmark" size={s(20)} color="#34C759" />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
