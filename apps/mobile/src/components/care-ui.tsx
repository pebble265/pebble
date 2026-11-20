import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';
import { Text } from './text';
import { useS } from './figma';
import { colors } from '../theme';

/** Small pieces shared by the caretaker screens (Profile → ผู้ดูแล). */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const s = useS();
  return (
    <View style={{ marginTop: s(18) }}>
      <Text style={{ marginHorizontal: s(40), fontSize: s(11), color: colors.muted, marginBottom: s(6) }}>{title}</Text>
      {children}
    </View>
  );
}

/** Round initial, like the avatars elsewhere. */
export function Initial({ name, size = 36 }: { name: string; size?: number }) {
  const s = useS();
  const ch = ([...name.trim()].find((c) => !/[เ-ไ]/.test(c)) ?? '?').toUpperCase();
  return (
    <View style={{ width: s(size), height: s(size), borderRadius: 999, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: s(size * 0.42), fontWeight: '700', color: colors.blue }}>{ch}</Text>
    </View>
  );
}

export function PermToggle({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  const s = useS();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: s(8), gap: s(10) }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: s(13), color: colors.ink }}>{label}</Text>
        <Text style={{ fontSize: s(10.5), color: colors.muted, marginTop: s(1) }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.online }} accessibilityLabel={label} />
    </View>
  );
}

