import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import { Float, Rise, Tap as Pressable } from '@/components/motion';
import { At, Brand, FigmaFrame, FText, useS } from '../components/figma';
import { Text } from '../components/text';
import { api } from '../lib/api';
import { firstSetup } from '../lib/first-setup';
import { useTheme } from '../lib/theme-mode';

const BLUE = '#68A0F0';
const INK = '#111111';

/** "pebble(a) - Setup Complete" from Figma: shown once, after the first medicines are picked. */
export default function AllSet() {
  useTheme();
  const finish = () => {
    firstSetup.done();
    // tells the robot to leave its "ready soon" page (Home retries if this fails)
    api('/users/me/app-setup', { method: 'POST' }).catch(() => {});
    router.replace('/');
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{ flexGrow: 1, backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #F2F2F4 100%)' }}
      bounces={false}
      showsVerticalScrollIndicator={false}>
      <StatusBar style="dark" />
      <FigmaFrame style={{ backgroundColor: 'transparent' }}>
        <Content onOk={finish} />
      </FigmaFrame>
    </ScrollView>
  );
}

function Content({ onOk }: { onOk(): void }) {
  const s = useS();
  return (
    <>
      {/* back: add another medicine */}
      <At left={40} top={100} width={36} height={36}>
        <Pressable
          onPress={() => router.replace('/setup-meds')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="ย้อนกลับไปเพิ่มยา"
          style={{ flex: 1, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={s(24)} color={INK} />
        </Pressable>
      </At>

      <At left={0} top={128} width={402}>
        <Rise style={{ alignItems: 'center' }}>
          <View
            style={{
              width: s(58),
              height: s(58),
              borderRadius: s(29),
              borderWidth: s(4),
              borderColor: INK,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="checkmark-sharp" size={s(34)} color={INK} />
          </View>
        </Rise>
      </At>

      <At left={0} top={208} width={402}>
        <Rise i={1}>
          <Text style={{ fontSize: s(20), fontWeight: '600', color: INK, textAlign: 'center' }}>All Set!</Text>
          <Text style={{ marginTop: s(10), fontSize: s(30), lineHeight: s(36), fontWeight: '800', color: INK, textAlign: 'center', letterSpacing: -0.5 }}>
            {'Welcome To\npebble(a)'}
          </Text>
        </Rise>
      </At>

      {/* robot hugging its screen, with two chat bubbles */}
      {/* Figma "pebble(a) - Setup Complete": robot 178 x 328 at (105, 329) */}
      <At left={60} top={318} width={280} height={340}>
        <Rise i={2} style={{ flex: 1 }}>
          <Float amount={5}>
            <Image
              source={require('../../assets/images/robot-allset.png')}
              style={{ position: 'absolute', left: s(45), top: s(11), width: s(178), height: s(328) }}
              resizeMode="contain"
              accessibilityLabel="หุ่น pebble(a)"
            />
          </Float>
          <Float amount={7} period={2600} style={{ position: 'absolute', left: s(196), top: s(4) }}>
            <Bubble size={46} />
          </Float>
          <Float amount={6} period={3000} style={{ position: 'absolute', left: s(28), top: s(62) }}>
            <Bubble size={36} flip />
          </Float>
        </Rise>
      </At>

      <FText left={0} width={402} top={660} size={12} weight="500" color="#8A8A8E" align="center">
        {'feel free to talk with\npebble(a)'}
      </FText>

      <At left={58} top={706} width={286} height={50}>
        <Rise i={3} style={{ flex: 1 }}>
          <Pressable
            onPress={onOk}
            accessibilityRole="button"
            accessibilityLabel="OK เข้าสู่หน้าหลัก"
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 999,
              backgroundColor: BLUE,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
              boxShadow: '0 6px 16px rgba(104,160,240,0.35)',
            })}>
            <Text style={{ color: '#FFFFFF', fontSize: s(15), fontWeight: '700' }}>OK</Text>
          </Pressable>
        </Rise>
      </At>

      <Brand
        logo={{ left: 163, top: 806, width: 18, height: 17 }}
        dot={{ left: 186, top: 815, size: 3 }}
        word={{ left: 194, top: 805, size: 13, text: 'pebble' }}
      />
    </>
  );
}

/** Grey speech bubble with three dots. */
function Bubble({ size, flip }: { size: number; flip?: boolean }) {
  const s = useS();
  const d = s(size);
  return (
    <View style={{ width: d, height: d * 0.92 }}>
      <View
        style={{
          width: d,
          height: d * 0.8,
          borderRadius: d * 0.4,
          backgroundColor: '#E9E9EC',
          borderWidth: 1,
          borderColor: '#D5D5DA',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: d * 0.07,
          boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
        }}>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ width: d * 0.1, height: d * 0.1, borderRadius: d, backgroundColor: '#3A3A3E' }} />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          ...(flip ? { right: d * 0.2 } : { left: d * 0.2 }),
          width: d * 0.2,
          height: d * 0.2,
          backgroundColor: '#E9E9EC',
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderColor: '#D5D5DA',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
