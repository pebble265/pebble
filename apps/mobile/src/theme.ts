/**
 * Pebble(a) palette, taken from the Figma file "pebble(a)":
 * light grey page, white "glass" cards with soft shadows, black primary buttons,
 * blue medicine pills, yellow day-time chips and navy for night.
 */
export const colors = {
  bg: '#F2F2F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F7',
  border: '#E5E5EA',
  text: '#0B0B0F',
  muted: '#8A8A90',
  primary: '#0B0B0F',
  primaryText: '#FFFFFF',
  primarySoft: '#EDEDF1',

  blue: '#3D8BF7',
  blueSoft: '#E3EEFF',
  sun: '#FFCF33',
  sunSoft: '#FFF3C4',
  night: '#1F3B95',
  red: '#F0443A',
  online: '#34C759',

  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warn: '#B54708',
  warnSoft: '#FEF3E2',
  success: '#2F9E44',
  successSoft: '#E6F6EA',
};

export const gradients = {
  page: 'linear-gradient(180deg, #FFFFFF 0%, #ECECF0 100%)',
  pill: 'linear-gradient(90deg, #5AA6FF 0%, #3D8BF7 100%)',
  sun: 'linear-gradient(180deg, #FFE27A 0%, #FFC21A 100%)',
  summary: 'linear-gradient(120deg, #B9B4F2 0%, #E9BEDD 55%, #FBC4C4 100%)',
  chat: 'linear-gradient(120deg, #EAF2FF 0%, #F6F0FF 60%, #FFEFF3 100%)',
  mood: 'linear-gradient(180deg, #FFFFFF 40%, #FCEBFA 100%)',
  robot: 'radial-gradient(circle at 35% 30%, #9ED8FF 0%, #3D8BF7 55%, #1E4FD6 100%)',
  auth: 'linear-gradient(160deg, #DDE7FB 0%, #F6F4FA 45%, #F9DCD9 100%)',
};

export const shadow = {
  card: '0px 10px 30px rgba(20, 20, 40, 0.08)',
  soft: '0px 4px 14px rgba(20, 20, 40, 0.08)',
  float: '0px 14px 40px rgba(20, 20, 40, 0.16)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 24, xl: 32, pill: 999 };

export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 19, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
};

/** Morning / noon / evening / night, as on the "Set dosage times" screen. */
export type Period = 'morning' | 'noon' | 'evening' | 'night';

export const PERIODS: {
  key: Period;
  label: string;
  /** MaterialCommunityIcons name */
  icon: 'weather-sunset-up' | 'white-balance-sunny' | 'weather-sunset-down' | 'weather-night';
  defaultTime: string;
}[] = [
  { key: 'morning', label: 'เช้า', icon: 'weather-sunset-up', defaultTime: '08:00' },
  { key: 'noon', label: 'กลางวัน', icon: 'white-balance-sunny', defaultTime: '12:00' },
  { key: 'evening', label: 'เย็น', icon: 'weather-sunset-down', defaultTime: '18:00' },
  { key: 'night', label: 'ก่อนนอน', icon: 'weather-night', defaultTime: '21:00' },
];

export function periodOf(hhmm: string): Period {
  const h = Number(hhmm.slice(0, 2));
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'noon';
  if (h >= 15 && h < 19) return 'evening';
  return 'night';
}
