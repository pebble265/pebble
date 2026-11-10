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

/** The 7 faces of the quick emotional check-in, 1 = very low ... 7 = great. */
export const MOODS = [
  { score: 1, emoji: '😭', label: 'แย่มาก' },
  { score: 2, emoji: '🥹', label: 'เศร้า' },
  { score: 3, emoji: '😢', label: 'ไม่ค่อยดี' },
  { score: 4, emoji: '😌', label: 'เฉย ๆ' },
  { score: 5, emoji: '☺️', label: 'สงบ' },
  { score: 6, emoji: '😊', label: 'ดี' },
  { score: 7, emoji: '🥰', label: 'ดีมาก' },
];

export function moodOf(score: number | null | undefined) {
  return MOODS.find((m) => m.score === score) ?? null;
}

/** Hello line in the style of "Good Morning ☀️". */
export function greetingWithIcon(timeZone?: string) {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(new Date()),
  );
  if (h >= 5 && h < 11) return 'อรุณสวัสดิ์ ☀️';
  if (h >= 11 && h < 17) return 'สวัสดีตอนบ่าย 🌤️';
  if (h >= 17 && h < 21) return 'สวัสดีตอนเย็น 🌇';
  return 'ราตรีสวัสดิ์ 🌙';
}
