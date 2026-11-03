/**
 * Time helpers. Schedules are stored as local wall-clock time ("08:00") in the
 * user's timezone; dose events are stored as exact UTC instants.
 */

/** Offset (ms) between the zone's wall clock and UTC at a given instant. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-10-19" + "08:00" in Asia/Bangkok  ->  2026-10-19T01:00:00Z */
export function zonedToUtc(
  localDate: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = guess - zoneOffsetMs(timeZone, new Date(guess));
  // second pass corrects the rare DST-boundary case
  result = guess - zoneOffsetMs(timeZone, new Date(result));
  return new Date(result);
}

/** The calendar date ("YYYY-MM-DD") of an instant, as seen in a timezone. */
export function localDateOf(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(localDate: string, days: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** DATE / TIME columns come back from Prisma as Date objects in UTC. */
export const dateColumnToString = (d: Date) => d.toISOString().slice(0, 10);
export const timeColumnToString = (d: Date) => d.toISOString().slice(11, 16);
export const stringToDateColumn = (s: string) => new Date(`${s}T00:00:00Z`);
export const stringToTimeColumn = (s: string) =>
  new Date(`1970-01-01T${s}:00Z`);

// ---------------------------------------------------------------------------
// Days of week. API uses ISO numbers 1=Mon ... 7=Sun.
// DB stores a bitmask: Mon=1, Tue=2, Wed=4 ... Sun=64 (127 = every day).
// ---------------------------------------------------------------------------
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function daysToMask(days: number[]): number {
  return [...new Set(days)].reduce((mask, d) => mask | (1 << (d - 1)), 0);
}

export function maskToDays(mask: number): number[] {
  return ALL_DAYS.filter((d) => mask & (1 << (d - 1)));
}

/** ISO weekday (1=Mon..7=Sun) of a "YYYY-MM-DD" date. */
export function isoWeekday(localDate: string): number {
  const day = new Date(`${localDate}T00:00:00Z`).getUTCDay(); // 0=Sun
  return day === 0 ? 7 : day;
}
