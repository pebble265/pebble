import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';
import { Tap as Pressable } from '@/components/motion';
import { Text } from './text';
import type { Dose, Medication, TodayDoses } from '../lib/types';
import { colors, gradients, periodOf, PERIODS } from '../theme';
import { useS } from './figma';

/** One row on the "Medications" page: a dose today, or (when today is done) the next scheduled one. */
export type MedItem = {
  key: string;
  medId: string;
  name: string;
  dosage: string | null;
  /** "HH:MM" */
  time: string;
  /** '' = today, otherwise e.g. 'พรุ่งนี้' */
  when: string;
  doseId?: string;
  missed?: boolean;
};

const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function hhmm(iso: string, tz?: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
}

function fromDose(d: Dose, tz?: string): MedItem {
  return {
    key: d.id,
    medId: d.medication.id,
    name: d.medication.name,
    dosage: d.medication.dosage,
    time: hhmm(d.scheduledAt, tz),
    when: '',
    doseId: d.id,
    missed: d.status === 'missed',
  };
}

/** Upcoming times from the schedules, after today (used once today's doses are all done). */
function upcoming(meds: Medication[], limit: number): MedItem[] {
  const now = new Date();
  const out: (MedItem & { at: number })[] = [];
  for (let offset = 1; offset <= 7 && out.length < limit; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const iso = ((day.getDay() + 6) % 7) + 1;
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const todays: (MedItem & { at: number })[] = [];
    for (const m of meds) {
      if (!m.isActive) continue;
      for (const sc of m.schedules) {
        if (sc.daysOfWeek.length && !sc.daysOfWeek.includes(iso)) continue;
        if (ymd < sc.startDate.slice(0, 10) || (sc.endDate && ymd > sc.endDate.slice(0, 10))) continue;
        const time = sc.time.slice(0, 5);
        todays.push({
          key: `${m.id}-${ymd}-${time}`,
          medId: m.id,
          name: m.name,
          dosage: m.dosage,
          time,
          when: offset === 1 ? 'พรุ่งนี้' : `วัน${DAY_TH[day.getDay()]}`,
          at: offset * 10000 + Number(time.replace(':', '')),
        });
      }
    }
    out.push(...todays.sort((a, b) => a.at - b.at));
  }
  return out.slice(0, limit).map(({ at: _at, ...rest }) => rest);
}

/**
 * "Next Schedule": every dose at the earliest time still to take (overdue ones included).
 * "Coming-Up": the rest of today, topped up with the next days so the list isn't empty at night.
 */
export function buildSchedule(today: TodayDoses | null, meds: Medication[] | null) {
  const tz = today?.timezone;
  const open = (today?.doses ?? [])
    .filter((d) => d.status === 'pending' || d.status === 'missed')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((d) => fromDose(d, tz));
  let next: MedItem[] = [];
  let coming: MedItem[] = [];
  if (open.length) {
    const firstTime = open[0].time;
    next = open.filter((x) => x.time === firstTime || x.missed);
    coming = open.filter((x) => !next.includes(x));
  }
  const extra = upcoming(meds ?? [], 6);
  if (!next.length && extra.length) {
    const t = extra[0];
    next = extra.filter((x) => x.when === t.when && x.time === t.time);
    coming = extra.filter((x) => !next.includes(x)).slice(0, 4);
  } else if (coming.length < 2) {
    coming = [...coming, ...extra].slice(0, Math.max(coming.length, 3));
  }
  return { next, coming };
}

/** Yellow (day) / blue (night) capsule with the period icon and time. */
export function MiniCapsule({ time }: { time: string }) {
  const s = useS();
  const p = PERIODS.find((x) => x.key === periodOf(time))!;
  const night = p.key === 'night';
  return (
    <View
      style={{
        width: s(30),
        height: s(54),
        borderRadius: s(15),
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(2),
        backgroundColor: night ? colors.night : colors.sun,
        ...(!night && { backgroundImage: gradients.sun }),
      }}>
      <MaterialCommunityIcons name={p.icon} size={s(13)} color="#FFF" />
      <Text style={{ color: '#FFF', fontSize: s(9), lineHeight: s(10), fontWeight: '700', textAlign: 'center' }}>{time}</Text>
    </View>
  );
}

/** Blue circle with a white capsule. */
export function PillBadge({ size = 30 }: { size?: number }) {
  const s = useS();
  return (
    <View
      style={{
        width: s(size),
        height: s(size),
        borderRadius: 999,
        backgroundColor: '#5B9DF5',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(61,139,247,0.35)',
      }}>
      <MaterialCommunityIcons name="pill" size={s(size * 0.62)} color="#FFF" />
    </View>
  );
}

/** White 330x67 "next up" card. */
export function NextCard({ item, onPress, lifted }: { item: MedItem; onPress?: () => void; lifted?: boolean }) {
  const s = useS();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`ยาถัดไป ${item.name} ${item.when} ${item.time}${item.missed ? ' เลยเวลาแล้ว' : ''}`}
      style={{
        width: s(330),
        height: s(67),
        borderRadius: s(23),
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: s(17),
        paddingRight: s(24),
        backgroundColor: colors.surface,
        backgroundImage: gradients.cardSoft,
        boxShadow: lifted ? '0 6px 30px rgba(0,0,0,0.18)' : '0 -4px 28px rgba(0,0,0,0.10)',
      }}>
      <Text style={{ width: s(26), fontSize: s(10), lineHeight: s(8), fontWeight: '600', color: colors.ink, paddingTop: s(2) }}>
        {item.when ? item.when.replace('วัน', '') : 'next\nup'}
      </Text>
      <View style={{ marginLeft: s(6) }}>
        <MiniCapsule time={item.time} />
      </View>
      <View style={{ marginLeft: s(12) }}>
        <PillBadge />
      </View>
      <View style={{ flex: 1, marginLeft: s(16) }}>
        <Text numberOfLines={1} style={{ fontSize: s(16), fontWeight: '600', color: colors.ink }}>
          {item.name}
        </Text>
        {item.missed ? <Text style={{ fontSize: s(11), fontWeight: '600', color: colors.red }}>เลยเวลาแล้ว</Text> : null}
      </View>
      {item.dosage ? (
        <Text numberOfLines={1} style={{ maxWidth: s(96), fontSize: s(12), fontWeight: '600', color: colors.ink, marginLeft: s(8) }}>
          {item.dosage}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Blue 309x52 "coming up" bar with the time chip on the right. */
export function ComingBar({ item, onPress }: { item: MedItem; onPress?: () => void }) {
  const s = useS();
  const night = periodOf(item.time) === 'night';
  const p = PERIODS.find((x) => x.key === periodOf(item.time))!;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} ${item.when} ${item.time}`}
      style={{
        width: s(309),
        height: s(52),
        borderRadius: s(20),
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: s(13),
        paddingRight: s(9),
        backgroundColor: '#51A2F8',
        backgroundImage: 'linear-gradient(180deg, #51A2F8 0%, #306092 188.46%)',
        boxShadow: '0 4px 12px rgba(48,96,146,0.25)',
      }}>
      <View style={{ width: s(26), height: s(26), borderRadius: 999, backgroundColor: '#F06A6A', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="pill" size={s(15)} color="#FFF" />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, marginLeft: s(10), marginRight: s(6), fontSize: s(16), fontWeight: '600', color: '#FFF' }}>
        {item.name}
        {item.dosage ? ` | ${item.dosage}` : ''}
      </Text>
      <View
        style={{
          width: s(70),
          height: s(34),
          borderRadius: s(12),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(6),
          backgroundColor: night ? colors.night : '#FDE46A',
        }}>
        <Text style={{ fontSize: s(10), fontWeight: '700', color: '#FFF', textAlign: 'center' }}>
          {item.when ? `${item.when.replace('วัน', '')}\n` : ''}
          {item.time}
        </Text>
        <MaterialCommunityIcons name={p.icon} size={s(20)} color="#FFF" />
      </View>
    </Pressable>
  );
}
