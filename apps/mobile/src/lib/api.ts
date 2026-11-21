import { getItem, setItem } from './storage';
import type { Tokens } from './types';

/**
 * Backend address. On a real phone "localhost" is the phone itself, so put
 * your Mac's Wi-Fi IP in mobile/.env:  EXPO_PUBLIC_API_URL=http://192.168.1.23:3000
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const REFRESH_KEY = 'pebble.refreshToken';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** Called by AuthProvider so the UI can return to sign-in when the session dies. */
export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

export async function saveTokens(t: Tokens) {
  accessToken = t.accessToken;
  await setItem(REFRESH_KEY, t.refreshToken);
}

export async function clearTokens() {
  accessToken = null;
  await setItem(REFRESH_KEY, null);
}

export async function getRefreshToken() {
  return getItem(REFRESH_KEY);
}

/** fetch that gives up after `ms`, so a dead server never leaves the app stuck on the splash. */
function fetchWithTimeout(url: string, init: RequestInit, ms = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

/**
 * Get a new access token using the refresh token.
 * Only ONE refresh may run at a time: the backend rotates refresh tokens and
 * treats a reused one as stolen (logging out every device).
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getItem(REFRESH_KEY);
      if (!refreshToken) return false;
      try {
        const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 401) await clearTokens();
          return false;
        }
        await saveTokens(await res.json());
        return true;
      } catch {
        return false; // offline: keep the refresh token, try again later
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

async function send(path: string, { method = 'GET', body, auth = true }: Options) {
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetchWithTimeout(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res = await send(path, opts);

  // Access token expired (15 min) -> refresh once and retry.
  if (res.status === 401 && opts.auth !== false) {
    if (await refreshSession()) {
      res = await send(path, opts);
    } else {
      await clearTokens();
      onSessionLost?.();
    }
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, toThai(data), data);
  return data as T;
}

const THAI: Record<string, string> = {
  'Invalid email or password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Email is already registered': 'อีเมลนี้ถูกใช้สมัครแล้ว',
  'Too early to take this dose': 'ยังไม่ถึงเวลากินยารอบนี้',
  'Invalid or expired pairing code': 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว ลองดูรหัสบนจอหุ่นอีกครั้ง',
  'Robot was just paired by someone else': 'หุ่นตัวนี้เพิ่งถูกจับคู่กับบัญชีอื่น',
  'Dose already taken': 'บันทึกว่ากินยารอบนี้แล้ว',
  'Please complete onboarding first': 'กรุณายืนยันการยินยอมก่อนใช้งาน',
  'Conversation not found or already ended': 'บทสนทนานี้จบไปแล้ว เริ่มคุยใหม่ได้เลย',
  'ThrottlerException: Too Many Requests': 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่',
  'Sign-in could not be verified': 'ยืนยันการเข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง',
  'Your account did not share a verified email': 'บัญชีนี้ไม่ได้แชร์อีเมลที่ยืนยันแล้ว ลองใช้อีเมลแทน',
  'Google sign-in is not configured': 'ยังไม่ได้ตั้งค่า Google sign-in ที่เซิร์ฟเวอร์',
  'Sign-in service is unreachable, try again': 'ติดต่อ Apple/Google ไม่ได้ ลองใหม่อีกครั้ง',
  'This account was deleted': 'บัญชีนี้ถูกลบไปแล้ว',
  'Please sign in again to confirm': 'กรุณาเข้าสู่ระบบอีกครั้งเพื่อยืนยัน',
  'Invalid or expired code': 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว',
  'Too many attempts, request a new code': 'ใส่รหัสผิดหลายครั้งเกินไป กด Resend เพื่อขอรหัสใหม่',
  'Reset session expired, please start again': 'หมดเวลาตั้งรหัสผ่านใหม่ เริ่มขั้นตอนใหม่อีกครั้งนะ',
  'Code must be 5 digits': 'รหัสต้องเป็นตัวเลข 5 หลัก',
  'newPassword must be longer than or equal to 8 characters': 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร',
};

function toThai(data: any): string {
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.map((m) => THAI[m] ?? m).join('\n');
  if (typeof msg === 'string') return THAI[msg] ?? msg;
  return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}

export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}
