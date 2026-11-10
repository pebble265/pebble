import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow, space } from '../theme';

function soon() {
  const msg = 'การเข้าสู่ระบบด้วย Apple / Google จะเปิดให้ใช้เร็ว ๆ นี้ ตอนนี้ใช้อีเมลก่อนนะ';
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('เร็ว ๆ นี้', msg);
}

/** "Sign-In with apple / google" from the Figma. Not wired to the backend yet. */
export function SocialButtons({ verb }: { verb: 'เข้าสู่ระบบ' | 'สมัคร' }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.or}>
        <View style={styles.line} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>หรือ</Text>
        <View style={styles.line} />
      </View>
      <Pressable onPress={soon} accessibilityRole="button" style={[styles.btn, styles.apple]}>
        <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.icon} />
        <Text style={[styles.text, { color: '#FFFFFF' }]}>{verb}ด้วย Apple</Text>
        <Text style={[styles.soon, { color: '#9A9AA0' }]}>เร็ว ๆ นี้</Text>
      </Pressable>
      <Pressable onPress={soon} accessibilityRole="button" style={[styles.btn, styles.google]}>
        <Ionicons name="logo-google" size={18} color="#4285F4" style={styles.icon} />
        <Text style={styles.text}>{verb}ด้วย Google</Text>
        <Text style={styles.soon}>เร็ว ๆ นี้</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  btn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  apple: { backgroundColor: '#000000' },
  google: { backgroundColor: '#FFFFFF', boxShadow: shadow.soft },
  icon: { position: 'absolute', left: space.lg },
  text: { fontSize: 15, fontWeight: '600', color: colors.text },
  soon: { position: 'absolute', right: space.lg, fontSize: 11, color: colors.muted },
});
