import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, type ScrollViewInstance, useWindowDimensions, View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { say } from '../lib/about';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { termsFlow } from '../lib/terms-flow';
import { colors, gradients, isDark } from '../theme';
import { useTheme } from '../lib/theme-mode';

interface Terms {
  version: string;
  title: string;
  important: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

/** "pebble(a) - Terms And Condition" from Figma (shown as an iOS page sheet). */
export default function TermsSheet() {
  useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = width / 402;
  const s = (n: number) => n * k;
  const { user } = useAuth();
  const [terms, setTerms] = useState<Terms | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const body = useRef<ScrollViewInstance>(null);

  function load() {
    setFailed(false);
    api<Terms>('/legal/terms', { auth: false }).then(setTerms).catch(() => setFailed(true));
  }
  useEffect(load, []);

  function answer(agree: boolean) {
    termsFlow.answer = agree;
    if (!agree) termsFlow.continueCreate = false;
    router.back();
  }

  async function email() {
    if (!user) return say('Send by Email', 'เข้าสู่ระบบก่อนแล้วค่อยส่งทางอีเมลนะ');
    setSending(true);
    try {
      const r = await api<{ to: string }>('/users/me/terms/email', { method: 'POST' });
      say('Send by Email', `ส่งเงื่อนไขการใช้งานไปที่ ${r.to} แล้ว`);
    } catch (e) {
      say('Send by Email', errorText(e));
    } finally {
      setSending(false);
    }
  }

  const box = isDark() ? colors.surface : '#F3F2F8';
  const bold = { fontSize: s(13), fontWeight: '700' as const, color: colors.ink };
  // On iOS the page sheet already starts below the status bar; elsewhere leave room for it.
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={{ flex: 1, paddingTop: top, backgroundColor: colors.surface, backgroundImage: isDark() ? gradients.page : 'linear-gradient(180deg, #FFF 0%, #F3F2F8 100%)' }}>
      <Text style={{ marginTop: s(79), marginLeft: s(20), fontSize: s(24), fontWeight: '700', color: colors.ink }}>Terms and Condition</Text>

      <Pressable
        onPress={email}
        disabled={sending || !terms}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: s(20),
          marginLeft: s(19),
          width: s(362),
          height: s(47),
          borderRadius: s(16),
          backgroundColor: box,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}>
        {sending ? <ActivityIndicator /> : <Text style={{ fontSize: s(14), fontWeight: '500', color: colors.ink }}>Send by Email</Text>}
      </Pressable>

      {/* content card (Rectangle 53): stops 109 pt above the bottom, buttons float over its end */}
      <View style={{ position: 'absolute', top: top + s(194), bottom: s(109 - 62), left: s(20), width: s(362), borderRadius: s(16), backgroundColor: box, overflow: 'hidden' }}>
        {!terms ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(10) }}>
            {failed ? (
              <>
                <Text style={{ fontSize: s(14), color: colors.muted }}>โหลดเงื่อนไขไม่สำเร็จ</Text>
                <Pressable onPress={load} accessibilityRole="button">
                  <Text style={{ fontSize: s(14), fontWeight: '700', color: '#51A2F8' }}>ลองใหม่</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        ) : (
          <>
            <Text style={[bold, { marginTop: s(18), marginLeft: s(14), width: s(330) }]}>{terms.important}</Text>
            <View style={{ marginTop: s(10), marginLeft: s(14), width: s(328), height: 1, backgroundColor: colors.line }} />
            <Pressable
              onPress={() => body.current?.scrollTo({ y: 0, animated: true })}
              accessibilityRole="button"
              style={{ height: s(59), flexDirection: 'row', alignItems: 'center', paddingLeft: s(17), paddingRight: s(23) }}>
              <Text style={[bold, { color: '#51A2F8', flex: 1 }]}>A. {terms.title}</Text>
              <Ionicons name="chevron-forward" size={s(16)} color="#C4C4C8" />
            </Pressable>
            <View style={{ marginLeft: s(14), width: s(328), height: 1, backgroundColor: colors.line }} />

            <ScrollView alwaysBounceVertical={false} ref={body} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: s(14), paddingTop: s(8), paddingBottom: s(150) }}>
              <Text style={bold}>pebble(a)</Text>
              <Text style={[bold, { marginTop: s(16) }]}>Last Updated: [{terms.updated}]</Text>
              {terms.sections.map((sec) => (
                <View key={sec.heading} style={{ marginTop: s(16) }}>
                  <Text style={bold}>{sec.heading}</Text>
                  <Text style={[bold, { marginTop: s(16) }]}>{sec.body}</Text>
                </View>
              ))}
            </ScrollView>
            {/* the text fades out under the buttons (Figma "Mask group") */}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: s(250), backgroundImage: isDark() ? 'linear-gradient(180deg, rgba(28,28,31,0) 0%, rgba(28,28,31,0.85) 35%, #1C1C1F 60%)' : 'linear-gradient(180deg, rgba(243,242,248,0) 0%, rgba(243,242,248,0.85) 35%, #F3F2F8 60%)' }}
            />
          </>
        )}
      </View>

      <Pressable
        onPress={() => answer(true)}
        disabled={!terms}
        accessibilityRole="button"
        style={({ pressed }) => ({
          position: 'absolute',
          left: s(56),
          width: s(290),
          height: s(51),
          bottom: s(58 + 51 + 9),
          borderRadius: s(46),
          backgroundColor: '#51A2F8',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed || !terms ? 0.75 : 1,
        })}>
        <Text style={{ fontSize: s(16), fontWeight: '600', color: '#FFF' }}>Agree</Text>
      </Pressable>
      <Pressable
        onPress={() => answer(false)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          position: 'absolute',
          left: s(56),
          width: s(290),
          height: s(51),
          bottom: s(58),
          borderRadius: s(46),
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
        })}>
        <Text style={{ fontSize: s(16), fontWeight: '600', color: colors.ink }}>Disagree</Text>
      </Pressable>
    </View>
  );
}
