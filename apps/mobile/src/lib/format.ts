/** "2026-11-03T13:00:00Z" -> "20:00" in the user's timezone */
export function timeOf(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

/** "2026-11-03" -> "วันอังคารที่ 3 พฤศจิกายน" */
export function longDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(d);
}

export function greeting(timeZone?: string) {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(new Date()),
  );
  if (h < 11) return 'อรุณสวัสดิ์';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export const DAY_SHORT = ['', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

export function daysLabel(days: number[]) {
  if (days.length === 7) return 'ทุกวัน';
  return days.map((d) => DAY_SHORT[d]).join(' ');
}
