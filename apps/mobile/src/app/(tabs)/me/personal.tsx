import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text, TextInput } from '../../../components/text';
import { useS } from '../../../components/figma';
import { Avatar, daysWithPebble, SubPage } from '../../../components/user-ui';
import { api, errorText } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

const NAME_MAX = 20;
type Key = 'name' | 'age' | 'phone';

/** Figma "pebble(a) - Personal Information": tap the pencil to edit a field. */
export default function Personal() {
  useTheme();
  const s = useS();
  const { user, reloadUser } = useAuth();
  const [editing, setEditing] = useState<Key | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const year = new Date().getFullYear();
  const age = user?.birthYear ? year - user.birthYear : null;
  const values: Record<Key, string> = {
    name: user?.displayName ?? '',
    age: age == null ? '' : String(age),
    phone: user?.phone ?? '',
  };

  function start(k: Key) {
    setEditing(k);
    setDraft(values[k]);
    setError('');
  }

  async function save() {
    if (!editing) return;
    const v = draft.trim();
    let body: Record<string, unknown>;
    if (editing === 'name') {
      if (!v) return setError('กรอกชื่อ');
      body = { displayName: v.slice(0, NAME_MAX) };
    } else if (editing === 'age') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 120) return setError('อายุต้องเป็นตัวเลข 1–120');
      body = { birthYear: year - n };
    } else {
      if (v && !/^[+]?[0-9 ()-]{6,20}$/.test(v)) return setError('เบอร์โทรไม่ถูกต้อง');
      body = { phone: v };
    }
    setBusy(true);
    setError('');
    try {
      await api('/users/me', { method: 'PATCH', body });
      await reloadUser();
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const field = (k: Key | 'email', label: string, shown: string, empty: string) => {
    const isEditing = editing === k;
    return (
      <View key={k} style={{ marginHorizontal: s(34), marginTop: s(16) }}>
        <Text style={{ fontSize: s(11), color: colors.ink }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: s(36) }}>
          {isEditing ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              maxLength={k === 'name' ? NAME_MAX : k === 'age' ? 3 : 20}
              keyboardType={k === 'age' ? 'number-pad' : k === 'phone' ? 'phone-pad' : 'default'}
              onSubmitEditing={save}
              returnKeyType="done"
              accessibilityLabel={label}
              style={{
                flex: 1,
                fontSize: s(24),
                fontWeight: '700',
                color: colors.ink,
                borderBottomWidth: 2,
                borderBottomColor: '#3B8BEF',
                paddingVertical: s(2),
                outlineWidth: 0,
              }}
            />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: s(24), fontWeight: '700', color: shown ? colors.ink : '#C7C7CC' }}>
              {shown || empty}
            </Text>
          )}
          {k === 'email' ? null : isEditing ? (
            <View style={{ flexDirection: 'row', gap: s(14), marginLeft: s(10) }}>
              <Pressable onPress={() => setEditing(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="ยกเลิก">
                <Ionicons name="close" size={s(20)} color={colors.muted} />
              </Pressable>
              <Pressable onPress={save} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="บันทึก">
                {busy ? <ActivityIndicator size="small" /> : <Ionicons name="checkmark" size={s(22)} color="#3B8BEF" />}
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => start(k)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`แก้ไข${label}`} style={{ marginLeft: s(10) }}>
              <MaterialCommunityIcons name="pencil" size={s(16)} color={colors.ink} />
            </Pressable>
          )}
        </View>
        {isEditing && error ? <Text style={{ fontSize: s(11), color: '#E5484D', marginTop: s(4) }}>{error}</Text> : null}
      </View>
    );
  };

  return (
    <SubPage title="ข้อมูลส่วนตัว">
      <View style={{ alignItems: 'center', gap: s(10), marginTop: s(8), marginBottom: s(14) }}>
        <Avatar size={110} editable />
        <Text style={{ fontSize: s(9), color: colors.ink }}>{daysWithPebble(user?.createdAt)}</Text>
      </View>
      {field('name', 'ชื่อ', values.name, '–')}
      {field('age', 'อายุ', age == null ? '' : `${age} ปี`, 'ยังไม่ได้ใส่')}
      {field('phone', 'เบอร์โทร', values.phone, 'ยังไม่ได้ใส่')}
      {field('email', 'อีเมล', user?.email ?? '', '–')}
      <Text style={{ marginHorizontal: s(34), marginTop: s(6), fontSize: s(10), color: colors.faint }}>อีเมลใช้เข้าสู่ระบบ จึงแก้จากหน้านี้ไม่ได้</Text>
    </SubPage>
  );
}
