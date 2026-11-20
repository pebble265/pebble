import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../../components/text';
import { useS } from '../../../components/figma';
import { InfoRow, SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colors } from '../../../theme';
import { type ThemeMode, useTheme } from '../../../lib/theme-mode';

const MODES: { key: ThemeMode; label: string; hint: string }[] = [
  { key: 'light', label: 'สว่าง', hint: 'โหมดสว่าง' },
  { key: 'dark', label: 'มืด', hint: 'โหมดมืด' },
  { key: 'system', label: 'ตามเครื่อง', hint: 'เปลี่ยนตามการตั้งค่าของโทรศัพท์' },
];

const LANGS = [
  { locale: 'th-TH', label: 'ไทย', short: 'TH' },
  { locale: 'en-US', label: 'English', short: 'EN' },
];

/** Figma "pebble(a) - User / Appearance": language and light/dark. */
export default function Appearance() {
  const { mode, setMode } = useTheme();
  const s = useS();
  const { user, reloadUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = LANGS.find((l) => user?.locale?.startsWith(l.locale.slice(0, 2))) ?? LANGS[0];

  async function setLang(locale: string) {
    if (locale === current.locale || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/users/me', { method: 'PATCH', body: { locale } });
      await reloadUser();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubPage title="การแสดงผล" icon="albums-outline">
      <InfoRow
        label="ภาษา"
        value={`${current.short} · ภาษาของแอป`}
        right={
          <View style={{ flexDirection: 'row', borderRadius: 999, backgroundColor: colors.fill, padding: s(2) }}>
            {LANGS.map((l) => {
              const on = l.locale === current.locale;
              return (
                <Pressable
                  key={l.locale}
                  onPress={() => setLang(l.locale)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{ paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: 999, backgroundColor: on ? '#FFF' : 'transparent' }}>
                  <Text style={{ fontSize: s(11), fontWeight: on ? '700' : '400' }}>{l.short}</Text>
                </Pressable>
              );
            })}
          </View>
        }
      />
      <InfoRow
        label="ธีม"
        value={MODES.find((m) => m.key === mode)?.hint}
        right={
          <View style={{ flexDirection: 'row', borderRadius: 999, backgroundColor: colors.fill, padding: s(2) }}>
            {MODES.map((m) => {
              const on = m.key === mode;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={m.label}
                  style={{ paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: 999, backgroundColor: on ? colors.surface : 'transparent' }}>
                  <Text style={{ fontSize: s(11), fontWeight: on ? '700' : '400', color: colors.ink }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        }
        last
      />
      {error ? <Text style={{ marginHorizontal: s(40), marginTop: s(8), fontSize: s(12), color: '#E5484D' }}>{error}</Text> : null}
      <Text style={{ marginHorizontal: s(40), marginTop: s(12), fontSize: s(10), color: colors.faint }}>
        Pebbi และหุ่นจะคุยกับคุณด้วยภาษานี้ด้วย
      </Text>
    </SubPage>
  );
}
