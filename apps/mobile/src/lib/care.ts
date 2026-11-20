import type { CarePermissions } from './types';

/** What a caretaker can get, in the order the screens list it. Conversation summaries are never offered. */
export const CARE_PERMS: { key: keyof CarePermissions; label: string; hint: string }[] = [
  { key: 'alertOnCrisis', label: 'แจ้งเตือนเมื่อฉันอาจต้องการความช่วยเหลือ', hint: 'เช่น เมื่อคุยกับ Pebbi แล้วมีสัญญาณน่าเป็นห่วง' },
  { key: 'alertOnMissedDose', label: 'แจ้งเตือนเมื่อฉันลืมกินยา', hint: 'ไม่บอกชื่อยา' },
  { key: 'alertOnDeviceIssue', label: 'แจ้งเตือนเมื่อหุ่นมีปัญหา', hint: 'แบตใกล้หมด หรือขาดการเชื่อมต่อ' },
  { key: 'viewAdherence', label: 'ดูสถิติการกินยา 7 วัน', hint: 'เห็นแค่จำนวนครั้ง ไม่เห็นชื่อยา' },
  { key: 'viewMoodTrend', label: 'ดูแนวโน้มอารมณ์ 14 วัน', hint: 'เห็นแค่คะแนน ไม่เห็นโน้ต' },
];

/** Suggested for a new invite: the safety alerts on, the rest up to the user. */
export const DEFAULT_PERMS: Partial<CarePermissions> = {
  alertOnCrisis: true,
  alertOnMissedDose: true,
  alertOnDeviceIssue: false,
  viewAdherence: true,
  viewMoodTrend: false,
};

export const RELATIONSHIPS = ['แม่', 'พ่อ', 'พี่น้อง', 'แฟน', 'เพื่อน', 'คุณหมอ'];

/** The invite code inside a pasted link, or the code itself. */
export function inviteCodeFrom(text: string) {
  const t = text.trim();
  const m = /[?&]token=([^&\s]+)/.exec(t);
  return (m ? decodeURIComponent(m[1]) : t).trim();
}
