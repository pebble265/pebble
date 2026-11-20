import { useEffect, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, ScrollView, type ScrollViewInstance, StyleSheet, type TextStyle, View } from 'react-native';
import { Text } from './text';
import { useS } from './figma';
import { colors, themedStyles } from '../theme';

const ITEM = 46;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

type Look = { item: number; width: number; active: TextStyle; idle: TextStyle };
const small = (): Look => ({ item: ITEM, width: 86, active: { fontSize: 36, fontWeight: '700', color: colors.text }, idle: { fontSize: 28, fontWeight: '500', color: colors.faint } });

function Column({
  values,
  value,
  onChange,
  label,
  look = small(),
}: {
  values: string[];
  value: string;
  onChange(v: string): void;
  label: string;
  look?: Look;
}) {
  const ITEM = look.item;
  const ref = useRef<ScrollViewInstance>(null);
  // Three copies so the wheel loops (00 has 59 above it); we keep to the middle copy.
  const n = values.length;
  const list = [...values, ...values, ...values];
  const index = n + Math.max(0, values.indexOf(value));
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(value);

  // Follow the value when it changes from outside (e.g. another period was selected).
  useEffect(() => {
    if (value === lastSent.current && ref.current) return;
    lastSent.current = value;
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [value, index, ITEM]);

  function pick(y: number) {
    const i = Math.min(list.length - 1, Math.max(0, Math.round(y / ITEM)));
    const v = list[i];
    // drifted into the first/last copy: jump back to the same value in the middle copy
    if (i < n || i >= 2 * n) ref.current?.scrollTo({ y: (n + (i % n)) * ITEM, animated: false });
    if (v !== lastSent.current) {
      lastSent.current = v;
      onChange(v);
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    // Web has no momentum-end event, so settle after scrolling stops.
    if (Platform.OS !== 'web') return;
    const y = e.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => pick(y), 120);
  }

  return (
    <ScrollView
      ref={ref}
      style={{ height: ITEM * 3, width: look.width }}
      contentContainerStyle={{ paddingVertical: ITEM }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: index * ITEM }}
      onLayout={() => ref.current?.scrollTo({ y: index * ITEM, animated: false })}
      onMomentumScrollEnd={(e) => pick(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(e) => {
        if (Platform.OS === 'android') pick(e.nativeEvent.contentOffset.y);
      }}
      onScroll={onScroll}
      scrollEventThrottle={32}
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}>
      {list.map((v, i) => {
        const active = v === value;
        return (
          <View key={i} style={[styles.item, { height: ITEM }]}>
            <Text style={[styles.text, active ? look.active : look.idle]}>{v}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Big "09 : 41" wheel from the "Set dosage times" screen. value is "HH:MM". */
export function TimeWheel({ value, onChange }: { value: string; onChange(v: string): void }) {
  const [h, m] = value.split(':');
  return (
    <View style={styles.wrap}>
      <View style={styles.band} pointerEvents="none" />
      <Column label="ชั่วโมง" values={HOURS} value={h} onChange={(nh) => onChange(`${nh}:${m}`)} />
      <Text style={styles.colon}>:</Text>
      <Column label="นาที" values={MINUTES} value={m} onChange={(nm) => onChange(`${h}:${nm}`)} />
    </View>
  );
}

/**
 * The wheel exactly as in the Figma "Set dosage times" frames (402-wide coordinates):
 * rows 84 apart centred on y=385, hours centred at x=122, minutes at x=278, colons at x=200,
 * white 361x82 band. Render it inside a FigmaFrame.
 */
export function DosageWheel({ value, onChange }: { value: string; onChange(v: string): void }) {
  const s = useS();
  const [h, m] = value.split(':');
  const row = s(84);
  const look: Look = {
    item: row,
    width: s(97),
    active: { fontSize: s(64), fontWeight: '600', color: colors.ink, letterSpacing: s(1) },
    idle: { fontSize: s(54), fontWeight: '600', color: 'rgba(56,56,56,0.57)', letterSpacing: s(1) },
  };
  const colon = (top: number, active: boolean) => (
    <Text
      key={top}
      style={{
        position: 'absolute',
        left: s(185),
        width: s(30),
        top: top - s(20),
        height: s(40),
        lineHeight: s(40),
        textAlign: 'center',
        fontSize: s(active ? 34 : 30),
        fontWeight: '600',
        color: active ? colors.ink : colors.faint,
      }}>
      :
    </Text>
  );
  return (
    <View style={{ position: 'absolute', left: 0, width: s(402), top: s(385) - row * 1.5, height: row * 3 }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: s(20), width: s(361), top: row * 1.5 - s(41), height: s(82), borderRadius: s(11), backgroundColor: colors.surface }}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {colon(row * 0.5, false)}
        {colon(row * 1.5, true)}
        {colon(row * 2.5, false)}
      </View>
      <View style={{ position: 'absolute', left: s(122) - s(97) / 2, top: 0 }}>
        <Column label="ชั่วโมง" values={HOURS} value={h} onChange={(nh) => onChange(`${nh}:${m}`)} look={look} />
      </View>
      <View style={{ position: 'absolute', left: s(278) - s(97) / 2, top: 0 }}>
        <Column label="นาที" values={MINUTES} value={m} onChange={(nm) => onChange(`${h}:${nm}`)} look={look} />
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, height: ITEM * 3 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM,
    height: ITEM,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  text: { fontVariant: ['tabular-nums'] },
  colon: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: -4 },
}));
