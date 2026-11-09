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
        const res = await fetch(`${API_URL}/auth/refresh`, {
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
    return await fetch(`${API_URL}${path}`, {
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
  'Dose already taken': 'บันทึกว่ากินยารอบนี้แล้ว',
  'Please complete onboarding first': 'กรุณายืนยันการยินยอมก่อนใช้งาน',
  'Conversation not found or already ended': 'บทสนทนานี้จบไปแล้ว เริ่มคุยใหม่ได้เลย',
  'ThrottlerException: Too Many Requests': 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่',
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
