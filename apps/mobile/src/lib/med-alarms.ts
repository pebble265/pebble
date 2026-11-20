import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import AlarmScheduler, { type AlarmScheduleInput, type AlarmWeekday } from 'react-native-alarm-scheduler';
import { api } from './api';
import { getLang, t } from './i18n';
import type { Medication, TodayDoses } from './types';

/**
 * Real alarm-clock reminders for medicine times.
 *
 * iOS 26+: AlarmKit — rings on the lock screen and through silent mode / Focus, like the Clock app,
 * even when Pebble is closed. Android: an exact alarm with a full-screen ringing screen.
 * Older iOS has no AlarmKit; there the alarms are simply not available.
 *
 * Each time slot gets one weekly alarm per weekday, naming every medicine due then.
 */

const SOUND_FILES: Record<string, number> = {
  radial: require('../../assets/sounds/radial.wav'),
  chimes: require('../../assets/sounds/chimes.wav'),
  beacon: require('../../assets/sounds/beacon.wav'),
  bulletin: require('../../assets/sounds/bulletin.wav'),
  gentle: require('../../assets/sounds/gentle.wav'),
};

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

type Wanted = { id: string; input: AlarmScheduleInput; sound: string };

/** Stable UUID-shaped id from a string (AlarmKit ids must be UUIDs). */
function uuidFrom(text: string) {
  // four 32-bit FNV-1a hashes with different seeds -> 128 bits
  const part = (seed: number) => {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  const hex = part(1) + part(2) + part(3) + part(4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun
const hhmmLocal = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * One weekly alarm per (time, weekday). That way a single day can be left out:
 * when every medicine of a time slot was already taken (or skipped) today before
 * its time, today's alarm for that slot is cancelled. It is put back on the next
 * sync after that time has passed, so it rings again next week.
 */
function wantedAlarms(meds: Medication[], today?: TodayDoses | null): Wanted[] {
  const groups = new Map<string, { time: string; days: number[]; names: string[]; medIds: string[]; sound: string }>();
  for (const m of meds) {
    if (!m.isActive) continue;
    for (const sc of m.schedules) {
      const time = sc.time.slice(0, 5);
      const days = sc.daysOfWeek.length ? [...sc.daysOfWeek].sort() : [1, 2, 3, 4, 5, 6, 7];
      const key = `${time}|${days.join(',')}`;
      const g = groups.get(key) ?? { time, days, names: [], medIds: [], sound: m.sound ?? 'radial' };
      if (!g.names.includes(m.name)) g.names.push(m.name);
      if (!g.medIds.includes(m.id)) g.medIds.push(m.id);
      groups.set(key, g);
    }
  }

  const now = new Date();
  const todayIso = isoWeekday(now);
  const nowHHMM = hhmmLocal(now.toISOString());
  const doneToday = (time: string, medIds: string[]) => {
    const doses = (today?.doses ?? []).filter((d) => hhmmLocal(d.scheduledAt) === time && medIds.includes(d.medication.id));
    return doses.length > 0 && doses.every((d) => d.status === 'taken' || d.status === 'skipped');
  };

  const out: Wanted[] = [];
  for (const g of groups.values()) {
    const [hour, minute] = g.time.split(':').map(Number);
    const names = g.names.join(', ');
    const title = `${t('ถึงเวลากินยา')} ${g.time}`;
    for (const day of g.days) {
      // already taken today, and today's time hasn't come yet -> no alarm for today
      if (day === todayIso && g.time > nowHHMM && doneToday(g.time, g.medIds)) continue;
      out.push({
        // content in the id: change anything and the alarm is replaced
        id: uuidFrom(`pebble-med|${g.time}|${day}|${names}|${g.sound}|${getLang()}`),
        sound: g.sound,
        input: {
          hour,
          minute,
          title,
          weekdays: [day as AlarmWeekday],
          ios: {
            alertTitle: `💊 ${names}`,
            stopButtonTitle: t('ปิด'),
            secondaryButtonTitle: t('กินแล้ว / เปิดแอป'),
            secondaryButtonBehavior: 'openApp',
            metadata: { kind: 'med', time: g.time },
          },
          android: {
            alertTitle: title,
            alertBody: names,
            launchUri: 'pebble://schedule',
            maxRingDurationSeconds: 180,
          },
        },
      });
    }
  }
  return out;
}

async function soundUri(key: string) {
  const asset = Asset.fromModule(SOUND_FILES[key] ?? SOUND_FILES.radial);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

let running: Promise<void> | null = null;
let again: { meds: Medication[]; today?: TodayDoses | null } | null = null;

/**
 * Make the phone's alarms match the medicine list (and today's doses, so a slot
 * already taken early doesn't ring). Safe to call often.
 */
export function syncMedAlarms(meds: Medication[], today?: TodayDoses | null): Promise<void> {
  if (!supported) return Promise.resolve();
  if (running) {
    again = { meds, today }; // run once more with the newest data when the current sync ends
    return running;
  }
  running = doSync(meds, today)
    .catch((e) => console.warn('[alarms] sync failed', e))
    .finally(() => {
      running = null;
      if (again) {
        const next = again;
        again = null;
        void syncMedAlarms(next.meds, next.today);
      }
    });
  return running;
}

/** Fetch the medicines and today's doses, then sync (e.g. right after a dose is taken). */
export async function refreshMedAlarms() {
  if (!supported) return;
  try {
    const [meds, today] = await Promise.all([api<Medication[]>('/medications'), api<TodayDoses>('/doses/today')]);
    await syncMedAlarms(meds, today);
  } catch {
    // offline: the next screen load will sync
  }
}

async function doSync(meds: Medication[], today?: TodayDoses | null) {
  const wanted = wantedAlarms(meds, today);
  const existing = await AlarmScheduler.getScheduledAlarmsAsync();
  const have = new Set(existing.map((a) => a.id));
  const keep = new Set(wanted.map((w) => w.id));

  for (const a of existing) if (!keep.has(a.id)) await AlarmScheduler.cancelAlarmAsync(a.id);

  const missing = wanted.filter((w) => !have.has(w.id));
  if (!missing.length) return;

  let perm = await AlarmScheduler.getPermissionsAsync();
  if (perm.status === 'notDetermined' || (Platform.OS === 'android' && !perm.canScheduleExactAlarms)) {
    perm = await AlarmScheduler.requestPermissionsAsync();
  }
  if (perm.status === 'unavailable' || !perm.canScheduleExactAlarms) return;

  for (const w of missing) {
    const uri = await soundUri(w.sound);
    await AlarmScheduler.scheduleAlarmAsync({ ...w.input, id: w.id, soundUri: uri });
  }
}

/** Remove every Pebble alarm (sign-out). */
export async function clearMedAlarms() {
  if (!supported) return;
  try {
    for (const a of await AlarmScheduler.getScheduledAlarmsAsync()) await AlarmScheduler.cancelAlarmAsync(a.id);
  } catch (e) {
    console.warn('[alarms] clear failed', e);
  }
}

/** Whether alarms can ring on this phone (false on iOS older than 26). */
export async function medAlarmsAvailable() {
  if (!supported) return false;
  try {
    return (await AlarmScheduler.getPermissionsAsync()).status !== 'unavailable';
  } catch {
    return false;
  }
}

/** Opening Pebble from a ringing alarm: go to today's doses so it can be marked as taken. */
export function watchAlarmLaunches() {
  if (!supported) return () => {};
  const check = async () => {
    try {
      const handoff = await AlarmScheduler.getPendingNativeAlarmHandoffAsync();
      if (handoff) {
        await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
        router.push('/schedule');
      }
    } catch {
      // not available on this phone
    }
  };
  void check();
  const app = AppState.addEventListener('change', (s) => s === 'active' && void check());
  const action = AlarmScheduler.addListener('onAlarmAction', (a) => {
    if (a.action !== 'secondaryOpen') return;
    void AlarmScheduler.clearPendingNativeAlarmHandoffAsync().catch(() => {});
    router.push('/schedule');
  });
  return () => {
    app.remove();
    action.remove();
  };
}
