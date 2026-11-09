import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { Button, ErrorText } from '../components/ui';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, space, type } from '../theme';

function Check({
  checked,
  onToggle,
  title,
  text,
}: {
  checked: boolean;
  onToggle(): void;
  title: string;
  text: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.check, checked && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? colors.primary : colors.muted}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.label}>{title}</Text>
        <Text style={type.small}>{text}</Text>
      </View>
    </Pressable>
  );
}

export default function Onboarding() {
  const { user, reloadUser, signOut } = useAuth();
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/users/me/onboarding', {
        method: 'POST',
        body: { acceptTerms: true, acceptHealthData: true },
      });
      await reloadUser();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={`สวัสดี ${user?.displayName ?? ''}`}
      subtitle="ก่อนเริ่ม ขอบอกให้ชัดว่า Pebble ใช้ข้อมูลของคุณอย่างไร">
      <View style={{ gap: space.md }}>
        <View style={styles.info}>
          <Ionicons name="lock-closed" size={18} color={colors.primary} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>
            ชื่อยาและสรุปบทสนทนาถูกเข้ารหัสก่อนเก็บ เราไม่เก็บบทสนทนาเต็ม และคุณเลือกเองว่าใครจะเห็นอะไร
          </Text>
        </View>
        <Check
          checked={terms}
          onToggle={() => setTerms(!terms)}
          title="ยอมรับเงื่อนไขการใช้งาน"
          text="Pebble เป็นเพื่อนคุย ไม่ใช่แพทย์ และไม่ใช่บริการฉุกเฉิน หากอยู่ในอันตรายให้โทร 1669"
        />
        <Check
          checked={health}
          onToggle={() => setHealth(!health)}
          title="ยินยอมให้ประมวลผลข้อมูลสุขภาพ"
          text="ตารางยา การกินยา และอารมณ์จากบทสนทนา เพื่อเตือนกินยาและดูแลคุณ ข้อความแชตจะถูกส่งไปประมวลผลที่ผู้ให้บริการ AI"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="เริ่มใช้งาน" onPress={submit} loading={busy} disabled={!terms || !health} />
        <Button title="ออกจากระบบ" variant="ghost" onPress={signOut} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  check: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
  },
  info: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
});
