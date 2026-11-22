import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../../../components/text';
import { useS } from '../../../components/figma';
import { Section } from '../../../components/care-ui';
import { SubPage } from '../../../components/user-ui';
import { SUPPORT_EMAIL, contactTeam } from '../../../lib/contact';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

const FAQ: { q: string; a: string }[] = [
  { q: 'ตั้งเวลากินยายังไง', a: 'ไปที่แท็บ ยา แล้วกด เพิ่มยา เลือกชื่อยาและช่วงเวลาที่กิน ถ้าจะแก้เวลาภายหลัง กด จัดการยา แล้วกด edit ใต้ชื่อยา' },
  { q: 'นาฬิกาปลุกกินยาไม่ดัง', a: 'ต้องเป็น iOS 26 ขึ้นไป และอนุญาตให้ Pebble ตั้งนาฬิกาปลุกได้ที่ การตั้งค่า → Pebble นาฬิกาปลุกจะดังแม้เปิดโหมดเงียบ' },
  { q: 'กินยาไปก่อนเวลา นาฬิกาจะยังดังไหม', a: 'ไม่ดัง ถ้ากดยืนยันว่ากินแล้วในแอปก่อนถึงเวลา' },
  { q: 'จับคู่หุ่น pebble(a) ยังไง', a: 'เปิดหุ่น แล้วไปที่แท็บ pebble ใส่รหัส 6 หลักที่ขึ้นบนหน้าจอหุ่น ถ้ายังไม่มีหุ่นลองใช้หุ่นทดสอบได้' },
  { q: 'ผู้ดูแลเห็นอะไรบ้าง', a: 'เห็นแค่สิ่งที่คุณเลือกไว้ในหน้าผู้ดูแล เช่น การแจ้งเตือนเมื่อลืมกินยา หรือสถิติการกินยา ไม่เห็นข้อความแชท โน้ต หรือชื่อยา และคุณปิดได้ตลอด' },
  { q: 'เปลี่ยนภาษาหรือโหมดมืด', a: 'ไปที่ โปรไฟล์ → การแสดงผล' },
  { q: 'Pebbi เป็นหมอไหม', a: 'ไม่ใช่ Pebbi เป็นเพื่อนคุย ไม่ใช่แพทย์ และไม่แทนการรักษา เรื่องยาและอาการให้ปรึกษาแพทย์ของคุณ' },
  { q: 'ลบบัญชีและข้อมูลทั้งหมด', a: 'ไปที่ โปรไฟล์ → การเข้าสู่ระบบและความปลอดภัย → ลบบัญชีของฉัน ข้อมูลจะถูกลบถาวร' },
];

function Faq({ q, a }: { q: string; a: string }) {
  const s = useS();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={{ marginHorizontal: s(40), paddingVertical: s(12), borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <Text style={{ flex: 1, fontSize: s(13), fontWeight: '500', color: colors.ink }}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={s(14)} color={colors.faint} />
      </View>
      {open ? <Text style={{ fontSize: s(12), lineHeight: s(18), color: colors.muted, marginTop: s(6) }}>{a}</Text> : null}
    </Pressable>
  );
}

/** Profile → ความช่วยเหลือ: someone to talk to now, common questions, and the team's email. */
export default function Help() {
  useTheme();
  const s = useS();
  return (
    <SubPage title="ความช่วยเหลือ" icon="help-circle-outline">
      {/* first, for anyone who opened Help because they're not OK */}
      <View style={{ marginHorizontal: s(30), padding: s(16), borderRadius: s(18), backgroundColor: colors.dangerSoft, gap: s(8) }}>
        <Text style={{ fontSize: s(14), fontWeight: '700', color: colors.ink }}>อยากคุยกับใครสักคนตอนนี้?</Text>
        <Text style={{ fontSize: s(12), lineHeight: s(18), color: colors.muted }}>
          สายด่วนสุขภาพจิต 1323 โทรฟรี 24 ชั่วโมง ถ้าเป็นเหตุฉุกเฉินโทร 1669
        </Text>
        <View style={{ flexDirection: 'row', gap: s(8) }}>
          {[
            ['1323', 'โทร 1323'],
            ['1669', 'โทร 1669'],
          ].map(([n, label]) => (
            <Pressable
              key={n}
              onPress={() => Linking.openURL(`tel:${n}`).catch(() => {})}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(14), height: s(34), borderRadius: 999, backgroundColor: colors.danger }}>
              <Ionicons name="call" size={s(14)} color="#FFF" />
              <Text style={{ fontSize: s(13), fontWeight: '600', color: '#FFF' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Section title="คำถามที่พบบ่อย">
        {FAQ.map((f) => (
          <Faq key={f.q} q={f.q} a={f.a} />
        ))}
      </Section>

      <Section title="ยังไม่เจอคำตอบ?">
        <Pressable
          onPress={contactTeam}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginHorizontal: s(30),
            height: s(46),
            borderRadius: 999,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(8),
            opacity: pressed ? 0.85 : 1,
          })}>
          <Ionicons name="mail-outline" size={s(17)} color={colors.primaryText} />
          <Text style={{ fontSize: s(14), fontWeight: '600', color: colors.primaryText }}>ส่งอีเมลหาทีม pebble</Text>
        </Pressable>
        <Text selectable style={{ marginTop: s(8), textAlign: 'center', fontSize: s(12), color: colors.muted }}>
          {SUPPORT_EMAIL}
        </Text>
      </Section>
    </SubPage>
  );
}
