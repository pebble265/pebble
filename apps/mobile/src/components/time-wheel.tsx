import { useEffect, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

const ITEM = 46;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function Column({ values, value, onChange, label }: { values: string[]; value: string; onChange(v: string): void; label: string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const index = Math.max(0, values.indexOf(value));
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(value);

  // Follow the value when it changes from outside (e.g. another period was selected).
  useEffect(() => {
    if (value === lastSent.current && ref.current) return;
    lastSent.current = value;
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [value, index]);

  function pick(y: number) {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM)));
    if (values[i] !== lastSent.current) {
      lastSent.current = values[i];
      onChange(values[i]);
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
      style={{ height: ITEM * 3, width: 86 }}
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
      {values.map((v) => {
        const active = v === value;
        return (
          <View key={v} style={styles.item}>
            <Text style={[styles.text, active ? styles.active : styles.idle]}>{v}</Text>
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

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, height: ITEM * 3 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM,
    height: ITEM,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  text: { fontVariant: ['tabular-nums'] },
  active: { fontSize: 36, fontWeight: '700', color: colors.text },
  idle: { fontSize: 28, fontWeight: '500', color: '#9C9CA3' },
  colon: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: -4 },
});
