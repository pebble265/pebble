import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Slider from '../components/plain-slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tap as Pressable } from '@/components/motion';
import { Text } from '../components/text';
import { api, errorText } from '../lib/api';
import type { Device } from '../lib/types';
import { colors, isDark } from '../theme';
import { useTheme } from '../lib/theme-mode';

/**
 * Hardware test (pebble tab > ทดสอบฮาร์ดแวร์): drives the real servos on the robot's ESP32 board.
 * App -> backend -> Pi (realtime socket) -> ESP32 (RX/TX wires). Each button sends one ESP32 command
 * ({ action: "test", esp: {...} }); the Pi reports the board link back every 2 s while this screen is open.
 */

type Esp = Record<string, unknown>;
type TestStatus = {
  pi: { socket: boolean; status: Device['status']; lastSeenAt: string | null; appVersion: string | null };
  esp: null | { espLinked: boolean; espFw?: string; espPort?: string; espAgo?: number; events?: string[]; reportAt: string };
};

const GREEN = '#1E9E5A';
const RED = '#D93B3B';
const AMBER = '#E39A2C';

export default function RobotTest() {
  useTheme();
  const [device, setDevice] = useState<Device | null>(null);
  const [st, setSt] = useState<TestStatus | null>(null);
  const [err, setErr] = useState('');
  const [sentLog, setSentLog] = useState<string[]>([]);
  const [speed, setSpeed] = useState(50);
  const [rawSpeed, setRawSpeed] = useState(40);
  const [pushAngle, setPushAngle] = useState(20);
  const [armAngle, setArmAngle] = useState(90);
  const devRef = useRef<Device | null>(null);

  useEffect(() => {
    api<Device[]>('/devices')
      .then((d) => {
        const first = d.find((x) => x.status !== 'unpaired') ?? d[0] ?? null;
        devRef.current = first;
        setDevice(first);
        if (!first) setErr('ยังไม่ได้จับคู่หุ่น');
      })
      .catch((e) => setErr(errorText(e)));
  }, []);

  const send = useCallback(async (esp: Esp, quiet = false) => {
    const d = devRef.current;
    if (!d) return;
    if (!quiet) setSentLog((l) => [`${new Date().toLocaleTimeString('th-TH')} → ${JSON.stringify(esp)}`, ...l].slice(0, 8));
    try {
      await api(`/devices/${d.id}/command`, { method: 'POST', body: { action: 'test', esp } });
      setErr('');
    } catch (e) {
      setErr(errorText(e));
    }
  }, []);

  // while the screen is open: ask the board for its status (also keeps the Pi reporting) + read the report
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const poll = async () => {
        const d = devRef.current;
        if (!d) return;
        try {
          const s = await api<TestStatus>(`/devices/${d.id}/test-status`);
          if (alive) setSt(s);
        } catch {
          /* shown by the cards as "unknown" */
        }
      };
      const ask = () => send({ cmd: 'status' }, true);
      send({ cmd: 'hello' }, true); // the board re-announces its firmware (the Pi may remember an older one)
      ask();
      const t1 = setInterval(poll, 1500);
      const t2 = setInterval(ask, 4000);
      const t0 = setTimeout(() => { ask(); poll(); }, 600);
      return () => {
        alive = false;
        clearInterval(t1);
        clearInterval(t2);
        clearTimeout(t0);
        send({ cmd: 'stop' }, true); // leaving the screen stops everything
      };
    }, [send]),
  );

  const fw = st?.esp?.espFw ?? '';
  const m = /(\d+)\.(\d+)/.exec(fw);
  // "servo" command needs medbot-3.3.0+; while the version is still unknown, let the buttons try
  const fwOld = !!fw && !(!!m && (+m[1] > 3 || (+m[1] === 3 && +m[2] >= 3)));
  const fwNew = !fwOld;

  // ---------- status cards
  const piAgo = st?.pi.lastSeenAt ? Math.round((Date.now() - new Date(st.pi.lastSeenAt).getTime()) / 1000) : null;
  const pi =
    !st ? { c: colors.faint, t: 'Raspberry Pi: กำลังเช็ก…', s: '' }
    : st.pi.socket ? { c: GREEN, t: 'Raspberry Pi: ออนไลน์', s: `ต่อ backend อยู่ · คำสั่งถึงหุ่นทันที${st.pi.appVersion ? ` · แอป Pi ${st.pi.appVersion}` : ''}` }
    : { c: RED, t: 'Raspberry Pi: ออฟไลน์', s: piAgo != null ? `ติดต่อครั้งล่าสุด ${fmtAgo(piAgo)} · เช็กว่า Pi เปิดอยู่และต่อเน็ต` : 'ยังไม่เคยติดต่อ backend' };
  const reportAgo = st?.esp ? Math.round((Date.now() - new Date(st.esp.reportAt).getTime()) / 1000) : null;
  const board =
    !st || !st.pi.socket ? { c: colors.faint, t: 'บอร์ด ESP32: ยังไม่รู้', s: 'ต้องให้ Pi ออนไลน์ก่อน (Pi เป็นคนคุยกับบอร์ด)' }
    : !st.esp || (reportAgo != null && reportAgo > 10) ? { c: AMBER, t: 'บอร์ด ESP32: รอรายงานจาก Pi…', s: 'ถ้ารอนานเกิน 10 วิ แอปบน Pi อาจยังเป็นรุ่นเก่า (ต้องอัปเดตไฟล์ Pi ก่อน)' }
    : st.esp.espLinked ? { c: GREEN, t: 'บอร์ด ESP32: ต่อกับ Pi อยู่', s: `${st.esp.espFw || 'firmware ?'} · ทาง${st.esp.espPort === 'usb' ? ' USB' : 'สาย RX/TX'} · ตอบล่าสุด ${st.esp.espAgo ?? 0} วิที่แล้ว` }
    : { c: RED, t: 'บอร์ด ESP32: ไม่ได้ต่อกับ Pi', s: st.esp.espAgo != null ? `บอร์ดเงียบมา ${fmtAgo(st.esp.espAgo)} · เช็กไฟบอร์ด (XT60) และสาย U9 RX/TX` : 'Pi ยังไม่เคยได้ยินบอร์ดเลย · เช็กไฟบอร์ดและสาย U9 (RX/TX สลับกันไหม)' };

  const ready = !!device && !!st?.pi.socket;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" style={{ width: 36, height: 36, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.ink }}>ทดสอบฮาร์ดแวร์</Text>
        <Pressable
          onPress={() => send({ cmd: 'stop' })}
          accessibilityRole="button"
          style={{ backgroundColor: RED, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>หยุดทุกอย่าง</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}>
        <StatusCard {...pi} />
        <StatusCard {...board} />
        {!!err && <Text style={{ color: RED, fontSize: 13, textAlign: 'center' }}>{err}</Text>}
        <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
          ยกล้อให้ลอยจากพื้นก่อนทดสอบล้อ · บอร์ดต้องมีไฟจาก XT60 · คำสั่งวิ่ง แอป → backend → Pi → บอร์ด จึงอาจช้ากว่ากดจริงเล็กน้อย
        </Text>

        <Card title="ล้อ: ขับทั้งคัน" sub="กดค้างเพื่อวิ่ง ปล่อยแล้วหยุด">
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Hold label="▲" disabled={!ready} start={() => send({ cmd: 'move', dir: 'forward', speed })} again={() => send({ cmd: 'move', dir: 'forward', speed }, true)} stop={() => send({ cmd: 'move', dir: 'stop' })} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Hold label="◀" disabled={!ready} start={() => send({ cmd: 'move', dir: 'left', speed })} again={() => send({ cmd: 'move', dir: 'left', speed }, true)} stop={() => send({ cmd: 'move', dir: 'stop' })} />
              <Btn label="■" disabled={!ready} onPress={() => send({ cmd: 'move', dir: 'stop' })} square />
              <Hold label="▶" disabled={!ready} start={() => send({ cmd: 'move', dir: 'right', speed })} again={() => send({ cmd: 'move', dir: 'right', speed }, true)} stop={() => send({ cmd: 'move', dir: 'stop' })} />
            </View>
            <Hold label="▼" disabled={!ready} start={() => send({ cmd: 'move', dir: 'backward', speed })} again={() => send({ cmd: 'move', dir: 'backward', speed }, true)} stop={() => send({ cmd: 'move', dir: 'stop' })} />
          </View>
          <Range label="ความเร็ว" value={speed} min={10} max={100} unit="%" onChange={setSpeed} />
        </Card>

        <Card title="ล้อ: ทีละล้อ" sub="หุ่นมี 2 ล้อ (servo 360°) · ซ้าย = ช่อง 0 ที่ J7 · ขวา = ช่อง 1 ที่ J6" need={!fwNew}>
          {[
            ['ล้อซ้าย (J7)', 0],
            ['ล้อขวา (J6)', 1],
          ].map(([name, ch]) => (
            <View key={ch} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Text style={{ flex: 1, fontSize: 14, color: colors.ink }}>
                {name} <Text style={{ color: colors.muted, fontSize: 12 }}>ch{ch}</Text>
              </Text>
              {[-1, 1].map((dir) => (
                <Hold
                  key={dir}
                  small
                  label={dir < 0 ? '◀ ถอย' : 'หน้า ▶'}
                  disabled={!ready || !fwNew}
                  start={() => send({ cmd: 'servo', ch, run: dir * rawSpeed })}
                  again={() => send({ cmd: 'servo', ch, run: dir * rawSpeed }, true)}
                  stop={() => send({ cmd: 'servo', ch, off: true })}
                />
              ))}
            </View>
          ))}
          <Range label="ความเร็วทีละล้อ" value={rawSpeed} min={10} max={100} unit="%" onChange={setRawSpeed} disabled={!fwNew} />
        </Card>

        <Card title="ที่ดันยา" sub="MG90S 180° · ช่อง 5 (J4) · ท่าพัก 20° / ดัน 100°">
          <Row>
            <Btn label="ท่าพัก 20°" disabled={!ready || !fwNew} onPress={() => { setPushAngle(20); send({ cmd: 'servo', ch: 5, angle: 20 }); }} />
            <Btn label="ดัน 100°" disabled={!ready || !fwNew} onPress={() => { setPushAngle(100); send({ cmd: 'servo', ch: 5, angle: 100 }); }} />
            <Btn
              label="ดันแล้วกลับ"
              disabled={!ready || !fwNew}
              onPress={() => {
                send({ cmd: 'servo', ch: 5, angle: 100 });
                setTimeout(() => send({ cmd: 'servo', ch: 5, angle: 20 }), 700);
              }}
            />
          </Row>
          <Range label="มุม" value={pushAngle} min={0} max={180} unit="°" disabled={!fwNew} onChange={setPushAngle} onDone={(v) => send({ cmd: 'servo', ch: 5, angle: v })} />
          {!fwNew && <Need />}
          <Btn primary label="จ่ายยาครบรอบ (ดัน → ถาดเลื่อนออก)" disabled={!ready} onPress={() => send({ cmd: 'dispense', slot: 1, id: 'test-' + Date.now().toString(36) })} />
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>คำสั่งเดียวกับตอนถึงเวลายา · ถาดต้องปิดอยู่ก่อน</Text>
        </Card>

        <Card title="ถาดรับยา" sub="MG996R 360° · ช่อง 4 (J3)">
          <Row>
            <Btn label="เลื่อนออก" disabled={!ready} onPress={() => send({ cmd: 'box', do: 'open' })} />
            <Btn label="เลื่อนเข้า" disabled={!ready} onPress={() => send({ cmd: 'box', do: 'close' })} />
            <Btn label="สลับ" disabled={!ready} onPress={() => send({ cmd: 'box', do: 'toggle' })} />
          </Row>
          <Row>
            <Text style={{ fontSize: 13, color: colors.muted }}>หมุนเอง (กดค้าง)</Text>
            {[-1, 1].map((dir) => (
              <Hold key={dir} small label={dir < 0 ? '◀' : '▶'} disabled={!ready || !fwNew} start={() => send({ cmd: 'servo', ch: 4, run: dir * rawSpeed })} again={() => send({ cmd: 'servo', ch: 4, run: dir * rawSpeed }, true)} stop={() => send({ cmd: 'servo', ch: 4, off: true })} />
            ))}
          </Row>
        </Card>

        <Card title="แขน" sub="ช่อง 6">
          <Row>
            <Btn label="โบกมือ" disabled={!ready} onPress={() => send({ cmd: 'arm', do: 'wave' })} />
            <Btn label="ท่าพัก" disabled={!ready} onPress={() => send({ cmd: 'arm', do: 'home' })} />
          </Row>
          <Range label="มุม" value={armAngle} min={0} max={180} unit="°" onChange={setArmAngle} onDone={(v) => send({ cmd: 'arm', do: 'angle', angle: v })} />
        </Card>

        <Card title="อื่น ๆ">
          <Row>
            <Btn label="บี๊บ" disabled={!ready} onPress={() => send({ cmd: 'buzz', mode: 'beep' })} />
            <Btn label="ตาหัวใจ" disabled={!ready} onPress={() => send({ cmd: 'face', anim: 'heart_eyes' })} />
            <Btn label="พัดลมเปิด" disabled={!ready} onPress={() => send({ cmd: 'fan', on: true })} />
            <Btn label="พัดลมปิด" disabled={!ready} onPress={() => send({ cmd: 'fan', on: false })} />
          </Row>
        </Card>

        <Card title="ข้อความจากบอร์ด" sub="ล่าสุดอยู่บน · ไม่รวม status / pong">
          <View style={{ backgroundColor: '#0F1115', borderRadius: 10, padding: 10, gap: 2 }}>
            {[...(st?.esp?.events ?? [])].reverse().map((l, i) => (
              <Text key={'e' + i} style={{ color: /"error"/.test(l) ? '#FF8A7A' : '#8BE29F', fontSize: 11, fontFamily: 'Menlo' }}>{l}</Text>
            ))}
            {sentLog.map((l, i) => (
              <Text key={'s' + i} style={{ color: '#7FB0F5', fontSize: 11, fontFamily: 'Menlo' }}>{l}</Text>
            ))}
            {!st?.esp?.events?.length && !sentLog.length && <Text style={{ color: '#8B949E', fontSize: 11 }}>ยังไม่มีข้อความ</Text>}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtAgo(s: number) {
  if (s >= 99999) return 'นานมาก';
  if (s < 60) return `${s} วิ`;
  if (s < 3600) return `${Math.round(s / 60)} นาที`;
  return `${Math.round(s / 3600)} ชม.`;
}

function StatusCard({ c, t, s }: { c: string; t: string; s: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c, boxShadow: `0 0 0 5px ${c}26` }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{t}</Text>
        {!!s && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{s}</Text>}
      </View>
    </View>
  );
}

function Card({ title, sub, need, children }: { title: string; sub?: string; need?: boolean; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{title}</Text>
      {!!sub && <Text style={{ fontSize: 12, color: colors.muted, marginTop: -4 }}>{sub}</Text>}
      {children}
      {need && <Need />}
    </View>
  );
}

function Need() {
  return <Text style={{ fontSize: 12, color: AMBER }}>ส่วนนี้ต้องใช้เฟิร์มแวร์บอร์ด medbot-3.3.0 (คำสั่ง servo) · ตอนนี้บอร์ดยังเป็นรุ่นเก่า</Text>;
}

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{children}</View>;
}

function Btn({ label, onPress, disabled, primary, square }: { label: string; onPress(): void; disabled?: boolean; primary?: boolean; square?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        opacity: disabled ? 0.4 : 1,
        backgroundColor: primary ? colors.blue : isDark() ? '#2A2A2E' : '#F1F3F7',
        borderRadius: 12,
        paddingHorizontal: square ? 0 : 14,
        width: square ? 64 : undefined,
        height: square ? 52 : 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: primary ? 6 : 0,
      }}>
      <Text style={{ color: primary ? '#FFF' : colors.ink, fontWeight: '700', fontSize: square ? 18 : 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Hold to run: sends `start`, repeats `again` every 0.4 s (the board stops on its own if repeats stop), `stop` on release. */
function Hold({ label, start, again, stop, disabled, small }: { label: string; start(): void; again(): void; stop(): void; disabled?: boolean; small?: boolean }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [held, setHeld] = useState(false);
  const end = () => {
    if (!timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
    setHeld(false);
    stop();
  };
  useEffect(() => end, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (timer.current) return;
        setHeld(true);
        start();
        timer.current = setInterval(again, 400);
      }}
      onPressOut={end}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        opacity: disabled ? 0.4 : 1,
        backgroundColor: held ? colors.blue : isDark() ? '#2A2A2E' : '#F1F3F7',
        borderRadius: 12,
        width: small ? undefined : 64,
        paddingHorizontal: small ? 12 : 0,
        height: small ? 38 : 52,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: held ? '#FFF' : colors.ink, fontWeight: '700', fontSize: small ? 13 : 18 }}>{label}</Text>
    </Pressable>
  );
}

function Range({ label, value, min, max, unit, onChange, onDone, disabled }: { label: string; value: number; min: number; max: number; unit: string; onChange(v: number): void; onDone?(v: number): void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontSize: 13, color: colors.muted, width: 96 }}>{label}</Text>
      <Slider value={value} min={min} max={max} disabled={disabled} onChange={onChange} onDone={onDone} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, width: 48, textAlign: 'right' }}>
        {value}
        {unit}
      </Text>
    </View>
  );
}
