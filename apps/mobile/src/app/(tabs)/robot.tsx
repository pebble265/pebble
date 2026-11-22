import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Tap as Pressable, Animated, Float } from '@/components/motion';
import { FadeInDown } from 'react-native-reanimated';
import { Text, TextInput } from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFigmaScale, useFrameHeight, useS } from '../../components/figma';
import { SpotifyCard } from '../../components/spotify-card';
import { useTabBarHeight } from '../../components/tab-bar';
import { confirm } from '../../components/ui';
import { api, errorText } from '../../lib/api';
import type { Device, RobotSettings } from '../../lib/types';
import { colors, gradients, isDark, shadow, themedStyles } from '../../theme';
import { useTheme } from '../../lib/theme-mode';
import { UserPhoto } from '../../components/user-ui';

const STATUS: Record<Device['status'], { text: string; color: string }> = {
  online: { text: 'ออนไลน์', color: '#34C759' },
  charging: { text: 'กำลังชาร์จ', color: '#34C759' },
  offline: { text: 'ออฟไลน์', color: colors.muted },
  error: { text: 'มีปัญหา', color: '#E5484D' },
  unpaired: { text: 'ยังไม่จับคู่', color: colors.muted },
};

type Action = 'wake' | 'forward' | 'backward' | 'left' | 'right' | 'stop' | 'wave' | 'box';

/** A pretend robot so the screen can be tried before pairing. Nothing is sent anywhere. */
const DEMO_DEVICE: Device = {
  id: 'demo',
  serialNumber: 'DEMO',
  status: 'online',
  batteryLevel: 80,
  firmwareVersion: 'demo',
  pillSlots: 2,
  lastSeenAt: null,
  pairedAt: null,
};
/** Kept outside the component so it survives switching tabs (until the app restarts). */
const demoState = { on: false };

/** White "glass" card of the design (a function so it follows light / dark). */
const card = () =>
  ({
    backgroundColor: colors.surface,
    backgroundImage: gradients.card,
    boxShadow: '0 -3px 12px rgba(0,0,0,0.07)',
  }) as const;

/** Figma "pebble(a) - Pebble / Pebble Waked / Pebble Control". */
export default function Robot() {
  useTheme();
  const s = useS();
  const frameH = useFrameHeight(useFigmaScale());
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarHeight();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [settings, setSettings] = useState<RobotSettings | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [waked, setWaked] = useState(false);
  const [waking, setWaking] = useState(false);
  const [control, setControl] = useState(false);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [demo, setDemoState] = useState(demoState.on);
  const setDemo = (on: boolean) => {
    demoState.on = on;
    setDemoState(on);
    setError('');
    setWaked(false);
  };

  const load = useCallback(async () => {
    try {
      const [d, st] = await Promise.all([api<Device[]>('/devices'), api<RobotSettings>('/robot-settings')]);
      setDevices(d);
      setSettings(st);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // keep online state and battery fresh while this tab is open
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [load]),
  );
  useEffect(() => () => void (wakeTimer.current && clearTimeout(wakeTimer.current)), []);

  const realDevice = devices?.[0];
  // a real robot always wins over the test one
  const device = realDevice ?? (demo ? DEMO_DEVICE : undefined);
  const isDemo = !realDevice && demo;
  const name = settings?.robotName ?? 'pebble(a)';
  const status = device ? STATUS[device.status] : null;

  async function send(action: Action) {
    if (!device) return false;
    if (isDemo) {
      setError('');
      return true; // test robot: pretend it worked
    }
    try {
      const r = await api<{ sent: boolean; online: boolean }>(`/devices/${device.id}/command`, { method: 'POST', body: { action } });
      if (!r.online) setError(`${name} ออฟไลน์อยู่ คำสั่งอาจไปไม่ถึง`);
      else setError('');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  }

  async function wake() {
    setWaking(true);
    const ok = await send('wake');
    setWaking(false);
    if (!ok) return;
    setWaked(true);
    if (wakeTimer.current) clearTimeout(wakeTimer.current);
    wakeTimer.current = setTimeout(() => setWaked(false), 4000);
  }

  async function pair() {
    if (!/^\d{6}$/.test(code)) return setError('รหัสจับคู่ต้องเป็นตัวเลข 6 หลักบนหน้าจอหุ่น');
    setBusy(true);
    setError('');
    try {
      await api('/devices/pair', { method: 'POST', body: { code } });
      setCode('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function unpair(d: Device) {
    if (isDemo) {
      setControl(false);
      setDemo(false);
      return;
    }
    if (!(await confirm('เลิกจับคู่หุ่น?', 'หุ่นจะหยุดเตือนยาและคุยกับคุณจนกว่าจะจับคู่ใหม่', 'เลิกจับคู่'))) return;
    try {
      await api(`/devices/${d.id}`, { method: 'DELETE' });
      setControl(false);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, backgroundImage: gradients.screen }}>
      <ScrollView alwaysBounceVertical={false}
        contentContainerStyle={{ height: frameH, paddingBottom: barHeight }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        {/* the robot (bleeds off the right edge, like the design) */}
        <Float amount={s(8)} period={4200} style={{ position: 'absolute', left: s(90), top: s(164), width: s(532), height: s(532) }}>
          <Image
            source={require('../../../assets/images/robot-photo.png')}
            style={{ width: '100%', height: '100%', opacity: device ? 1 : 0.35 }}
            accessibilityIgnoresInvertColors
          />
        </Float>

        {/* header */}
        <At left={45} top={102} w={260} h={80}>
          <Text style={{ fontSize: s(16), fontWeight: '500', color: colors.ink }}>หุ่นของฉัน</Text>
          <Text numberOfLines={1} style={{ fontSize: s(36), fontWeight: '700', color: colors.ink, letterSpacing: -0.5, marginTop: s(-2) }}>
            {name}
          </Text>
          <Text style={{ fontSize: s(10), color: colors.ink, marginTop: s(-3) }}>
            {device ? (device.status === 'online' || device.status === 'charging' ? 'เชื่อมต่อแล้ว' : status?.text) : 'ยังไม่ได้เชื่อมต่อ'}
          </Text>
        </At>
        <Pressable
          onPress={() => router.navigate('/me')}
          accessibilityRole="button"
          accessibilityLabel="โปรไฟล์"
          style={{ position: 'absolute', left: s(319), top: s(109) }}>
          <UserPhoto px={s(43)} />
        </Pressable>

        {isDemo && (
          <View style={{ position: 'absolute', left: s(45), top: s(178), flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <View style={{ paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: 999, backgroundColor: '#FFE9A8' }}>
              <Text style={{ fontSize: s(9), fontWeight: '700', color: '#7A5A00' }}>โหมดทดสอบ</Text>
            </View>
            <Pressable onPress={() => setDemo(false)} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontSize: s(9), color: colors.muted, textDecorationLine: 'underline' }}>ออก</Text>
            </Pressable>
          </View>
        )}

        {device ? (
          <>
            {/* battery */}
            <At left={80} top={199} w={155} h={70} style={{ ...card(), borderRadius: s(22), alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
              <MaterialCommunityIcons
                name={device.status === 'charging' ? 'battery-charging' : batteryIcon(device.batteryLevel)}
                size={s(18)}
                color={colors.ink}
                style={{ transform: [{ rotate: '90deg' }] }}
              />
              <Text style={{ fontSize: s(13), fontWeight: '700' }}>แบตเตอรี่ | {device.batteryLevel == null ? '–' : `${device.batteryLevel}%`}</Text>
            </At>

            {/* status */}
            <At left={40} top={291} w={138} h={46} style={{ ...card(), borderRadius: s(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5) }}>
              <Text style={{ fontSize: s(13), fontWeight: '700' }}>สถานะ :</Text>
              <Text style={{ fontSize: s(13), fontWeight: '500', color: status!.color }}>{status!.text}</Text>
              <View style={{ width: s(6), height: s(6), borderRadius: 999, backgroundColor: status!.color }} />
            </At>

            {/* music: the user's Spotify */}
            <At left={24} top={366} w={136} h={52} style={{ ...card(), borderRadius: s(11) }}>
              <SpotifyCard />
            </At>

            {/* wake */}
            {waked ? (
              <At
                left={24}
                top={440}
                w={136}
                h={73}
                style={{
                  borderRadius: s(20),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#5FD763',
                  backgroundImage: 'linear-gradient(180deg, #5FD763 67.71%, #262323 257.29%)',
                  boxShadow: '0 -5px 14.5px rgba(0,0,0,0.09)',
                }}>
                <Text style={{ fontSize: s(13), fontWeight: '700', color: '#FFF' }}>ปลุกแล้ว!</Text>
              </At>
            ) : (
              <At left={24} top={440} w={136} h={73} style={{ ...card(), borderRadius: s(20), paddingLeft: s(14), justifyContent: 'center', gap: s(9) }}>
                <Text style={{ fontSize: s(13), fontWeight: '700' }}>ปลุก {name}!</Text>
                <Pressable
                  onPress={wake}
                  disabled={waking}
                  accessibilityRole="button"
                  accessibilityLabel={`ปลุก ${name}`}
                  style={{ width: s(56), height: s(20), borderRadius: 999, backgroundColor: '#6CCB6A', alignItems: 'center', justifyContent: 'center' }}>
                  {waking ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: s(9), color: '#FFF', fontWeight: '600' }}>ปลุก</Text>}
                </Pressable>
              </At>
            )}

            {/* control */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: s(686), alignItems: 'center' }}>
              <Pressable
                onPress={() => setControl(true)}
                accessibilityRole="button"
                style={{ ...card(), width: s(154), height: s(50), borderRadius: s(22), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
                <MaterialCommunityIcons name="remote" size={s(18)} color={colors.ink} />
                <Text style={{ fontSize: s(13), fontWeight: '700' }}>ควบคุมหุ่น</Text>
              </Pressable>
            </View>
          </>
        ) : (
          devices && (
            <At left={24} top={448} w={354} h={244} style={{ borderRadius: s(24), backgroundColor: isDark() ? 'rgba(28,28,31,0.96)' : 'rgba(255,255,255,0.96)', boxShadow: shadow.card, padding: s(18), gap: s(10) }}>
              <Text style={{ fontSize: s(17), fontWeight: '700', color: colors.ink }}>จับคู่หุ่น</Text>
              <Text style={{ fontSize: s(12), color: colors.muted }}>เปิดหุ่น pebble(a) แล้วใส่รหัส 6 หลักที่ขึ้นบนหน้าจอของหุ่น</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor={colors.faint}
                style={[styles.code, { height: s(48), fontSize: s(24) }]}
                maxLength={6}
                accessibilityLabel="รหัสจับคู่ 6 หลัก"
              />
              <Pressable
                onPress={pair}
                disabled={busy}
                accessibilityRole="button"
                style={{ height: s(44), borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={{ color: colors.primaryText, fontSize: s(15), fontWeight: '700' }}>เชื่อมต่อ</Text>}
              </Pressable>
              <Pressable onPress={() => setDemo(true)} accessibilityRole="button" style={{ height: s(34), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: s(13), fontWeight: '600', color: colors.blue }}>ยังไม่มีหุ่น? ลองกับหุ่นทดสอบ</Text>
              </Pressable>
            </At>
          )
        )}

        {error ? (
          <View style={{ position: 'absolute', left: s(24), right: s(24), top: s(device ? 646 : 680), alignItems: 'center' }}>
            <Text style={{ color: '#E5484D', fontSize: s(12), fontWeight: '600', textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* "Pebble Control" sheet */}
      <Modal visible={control} transparent animationType="fade" onRequestClose={() => setControl(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setControl(false)} accessibilityLabel="ปิด">
          <BlurView intensity={20} tint="default" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
        </Pressable>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: s(40),
            borderTopRightRadius: s(40),
            backgroundColor: colors.fill,
            paddingTop: s(36),
            paddingBottom: insets.bottom + s(24),
            paddingHorizontal: s(56),
            alignItems: 'center',
            gap: s(10),
          }}>
          <Text style={{ fontSize: s(24), fontWeight: '700', color: colors.ink }}>{name}</Text>
          <Text style={{ fontSize: s(9), color: colors.ink, marginTop: s(-10) }}>{status && device?.status === 'online' ? 'เชื่อมต่อแล้ว' : status?.text}</Text>
          <Text style={{ fontSize: s(11), color: colors.muted, marginBottom: s(6) }}>
            {isDemo ? 'โหมดทดสอบ: ปุ่มกดได้ แต่ไม่มีคำสั่งไปที่หุ่นจริง' : 'กดค้างเพื่อให้หุ่นเคลื่อนที่ ปล่อยเพื่อหยุด'}
          </Text>
          <HoldButton label="เดินหน้า" primary onStart={() => send('forward')} onEnd={() => send('stop')} />
          <View style={{ flexDirection: 'row', gap: s(9) }}>
            <HoldButton label="เลี้ยวซ้าย" width={140} onStart={() => send('left')} onEnd={() => send('stop')} />
            <HoldButton label="เลี้ยวขวา" width={140} onStart={() => send('right')} onEnd={() => send('stop')} />
          </View>
          <HoldButton label="ถอยหลัง" onStart={() => send('backward')} onEnd={() => send('stop')} />
          <View style={{ flexDirection: 'row', gap: s(9), marginTop: s(4) }}>
            <TapButton label="โบกมือ" icon="hand-wave-outline" onPress={() => send('wave')} />
            <TapButton label="เปิด/ปิดกล่องยา" icon="pill" onPress={() => send('box')} />
          </View>
          {device && (
            <Pressable onPress={() => unpair(device)} accessibilityRole="button" hitSlop={8} style={{ marginTop: s(8) }}>
              <Text style={{ fontSize: s(12), color: '#E5484D', fontWeight: '600' }}>{isDemo ? 'ออกจากโหมดทดสอบ' : 'เลิกจับคู่หุ่น'}</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** Box placed in the design's 402-wide coordinates. */
function At({ left, top, w, h, children, style }: { left: number; top: number; w: number; h: number; children: ReactNode; style?: object }) {
  const s = useS();
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.max(0, top - 90) * 0.9).duration(450).springify().damping(17)}
      style={[{ position: 'absolute', left: s(left), top: s(top), width: s(w), height: s(h) }, style]}>
      {children}
    </Animated.View>
  );
}

function batteryIcon(level: number | null): 'battery' | 'battery-outline' | 'battery-20' | 'battery-50' | 'battery-80' {
  if (level == null) return 'battery-outline';
  if (level <= 25) return 'battery-20';
  if (level <= 60) return 'battery-50';
  if (level <= 90) return 'battery-80';
  return 'battery';
}

/** Forward / Backward / Left / Right: moves while held, stops on release. */
function HoldButton({ label, primary, width = 289, onStart, onEnd }: { label: string; primary?: boolean; width?: number; onStart(): void; onEnd(): void }) {
  const s = useS();
  const [down, setDown] = useState(false);
  return (
    <Pressable
      onPressIn={() => {
        setDown(true);
        onStart();
      }}
      onPressOut={() => {
        setDown(false);
        onEnd();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: s(width),
        height: s(50),
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? (down ? '#4E8FE8' : '#6EA8F5') : down ? (isDark() ? '#2A2A2E' : '#EDEDF2') : isDark() ? colors.surface : '#FFF',
        boxShadow: primary ? '0 4px 12px rgba(110,168,245,0.35)' : '0 2px 8px rgba(0,0,0,0.05)',
      }}>
      <Text style={{ fontSize: s(14), fontWeight: '600', color: primary ? '#FFF' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

/** One-tap robot action (wave, pill box). */
function TapButton({ label, icon, onPress }: { label: string; icon: 'hand-wave-outline' | 'pill'; onPress(): void }) {
  const s = useS();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: s(140),
        height: s(42),
        borderRadius: 999,
        flexDirection: 'row',
        gap: s(6),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? (isDark() ? '#2A2A2E' : '#EDEDF2') : isDark() ? colors.surface : '#FFF',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      })}>
      <MaterialCommunityIcons name={icon} size={s(16)} color={colors.ink} />
      <Text style={{ fontSize: s(12), fontWeight: '600', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
  code: {
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
}));
