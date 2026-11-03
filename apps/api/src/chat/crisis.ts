import { ModerationResult } from '../ai/ai.provider';

/**
 * Layer 1 of crisis detection: phrase matching. Runs locally, needs no AI,
 * and still works if OpenAI is down. Layer 2 is the moderation model.
 *
 * Deliberately broad: a false alarm costs a caretaker a phone call,
 * a miss can cost far more. Tune with a mental-health professional.
 */
const THAI_PHRASES = [
  'อยากตาย',
  'ไม่อยากอยู่แล้ว',
  'ไม่อยากมีชีวิต',
  'ไม่อยากตื่นขึ้นมา',
  'ฆ่าตัวตาย',
  'จบชีวิต',
  'ปลิดชีพ',
  'ทำร้ายตัวเอง',
  'กรีดแขน',
  'กรีดข้อมือ',
  'อยู่ไปก็ไม่มีประโยชน์',
  'ตายไปคงดีกว่า',
  'หายไปจากโลกนี้',
  'ลาก่อนทุกคน',
];

const ENGLISH_PATTERNS = [
  /\bkill(ing)? my ?self\b/,
  /\bsuicid(e|al)\b/,
  /\bend (it all|my life)\b/,
  /\bwant to die\b/,
  /\bdon'?t want to (live|be alive|wake up)\b/,
  /\bhurt(ing)? my ?self\b/,
  /\bself[- ]?harm\b/,
  /\bcut(ting)? my ?self\b/,
  /\bbetter off dead\b/,
];

export function matchesCrisisPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  const thaiCompact = lower.replace(/\s+/g, ''); // "อยาก ตาย" -> "อยากตาย"
  return (
    THAI_PHRASES.some((p) => thaiCompact.includes(p)) ||
    ENGLISH_PATTERNS.some((re) => re.test(lower))
  );
}

export function isCrisis(text: string, mod: ModerationResult | null): boolean {
  return (
    matchesCrisisPhrase(text) ||
    !!mod?.selfHarm ||
    !!mod?.selfHarmIntent ||
    !!mod?.selfHarmInstructions
  );
}

/** Used when the AI is unavailable or its reply failed the safety check. */
export const SAFE_CRISIS_REPLY =
  'Pebble อยู่ตรงนี้นะ และอยากให้คุณปลอดภัย ตอนนี้ลองโทรคุยกับสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมง ' +
  'หรือถ้ารู้สึกว่าอันตรายมาก โทร 1669 ได้ทันที Pebble แจ้งคนที่คุณไว้ใจให้แล้วด้วยนะ';

export const SAFE_FALLBACK_REPLY =
  'ขอโทษนะ ตอนนี้ Pebble ตอบได้ไม่เต็มที่ ลองพูดอีกครั้งได้ไหม';
