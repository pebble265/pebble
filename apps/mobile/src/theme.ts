/**
 * Pebble(a) palette, taken from the Figma file "pebble(a)":
 * light grey page, white "glass" cards with soft shadows, black primary buttons,
 * blue medicine pills, yellow day-time chips and navy for night.
 */
const lightColors = {
  bg: '#F2F2F5',
  /** plain white pages from the Figma screens */
  page: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F7',
  /** input boxes, chips, toggles' track */
  fill: '#F2F2F5',
  border: '#E5E5EA',
  /** hairlines between rows */
  line: '#ECECEC',
  text: '#0B0B0F',
  /** pure black text/icons of the Figma screens */
  ink: '#000000',
  muted: '#8A8A90',
  faint: '#A6A6AB',
  primary: '#0B0B0F',
  primaryText: '#FFFFFF',
  primarySoft: '#EDEDF1',
  /** frosted bars and sheets */
  glass: 'rgba(255,255,255,0.95)',
  scrim: 'rgba(0,0,0,0.14)',

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
export type Palette = typeof lightColors;

const darkColors: Palette = {
  bg: '#0B0B0D',
  page: '#0B0B0D',
  surface: '#1C1C1F',
  surfaceAlt: '#232327',
  fill: '#2A2A2E',
  border: '#2E2E33',
  line: '#2A2A2E',
  text: '#F5F5F7',
  ink: '#FFFFFF',
  muted: '#9A9AA2',
  faint: '#6E6E75',
  primary: '#F5F5F7',
  primaryText: '#0B0B0F',
  primarySoft: '#2A2A2E',
  glass: 'rgba(32,32,36,0.95)',
  scrim: 'rgba(0,0,0,0.45)',

  blue: '#4D97FA',
  blueSoft: '#1B2A44',
  sun: '#FFCF33',
  sunSoft: '#3A3216',
  night: '#2C4BB0',
  red: '#FF5A4F',
  online: '#30D158',

  danger: '#FF6B5E',
  dangerSoft: '#3A1D1B',
  warn: '#F5A524',
  warnSoft: '#3A2A12',
  success: '#43C35E',
  successSoft: '#17301E',
};

const lightGradients = {
  page: 'linear-gradient(180deg, #FFFFFF 0%, #ECECF0 100%)',
  /** white Figma pages fading to grey at the very bottom */
  screen: 'linear-gradient(180deg, #FFF 80.55%, #E3E3E3 105.55%)',
  /** white "glass" cards (battery, status, control …) */
  card: 'linear-gradient(180deg, #FFF 49.49%, #737373 268%)',
  /** next-up medicine cards */
  cardSoft: 'linear-gradient(180deg, #FFF 68.61%, #999 232.85%)',
  /** check-in rows, chart card */
  cardFaint: 'linear-gradient(180deg, #FFF 60%, #ECECEC 130%)',
  user: 'linear-gradient(180deg, #CFE6FC 0%, #EAF4FE 14%, #FFF 30%, #FFF 85%, #EDEDED 100%)',
  pill: 'linear-gradient(90deg, #5AA6FF 0%, #3D8BF7 100%)',
  sun: 'linear-gradient(180deg, #FFE27A 0%, #FFC21A 100%)',
  summary: 'linear-gradient(120deg, #B9B4F2 0%, #E9BEDD 55%, #FBC4C4 100%)',
  chat: 'linear-gradient(120deg, #EAF2FF 0%, #F6F0FF 60%, #FFEFF3 100%)',
  mood: 'linear-gradient(180deg, #FFFFFF 40%, #FCEBFA 100%)',
  robot: 'radial-gradient(circle at 35% 30%, #9ED8FF 0%, #3D8BF7 55%, #1E4FD6 100%)',
  auth: 'linear-gradient(160deg, #DDE7FB 0%, #F6F4FA 45%, #F9DCD9 100%)',
  glow:
    'radial-gradient(60% 30% at 40% 82%, rgba(176,190,240,0.45) 0%, rgba(255,255,255,0) 100%), radial-gradient(70% 28% at 15% 100%, rgba(236,170,200,0.55) 0%, rgba(255,255,255,0) 100%), radial-gradient(60% 26% at 90% 98%, rgba(214,190,236,0.5) 0%, rgba(255,255,255,0) 100%)',
};
export type Gradients = typeof lightGradients;

const darkGradients: Gradients = {
  page: 'linear-gradient(180deg, #141417 0%, #0B0B0D 100%)',
  screen: 'linear-gradient(180deg, #0B0B0D 80.55%, #1B1B1F 105.55%)',
  card: 'linear-gradient(180deg, #1F1F23 49.49%, #000 268%)',
  cardSoft: 'linear-gradient(180deg, #1F1F23 68.61%, #000 232.85%)',
  cardFaint: 'linear-gradient(180deg, #1F1F23 60%, #151518 130%)',
  user: 'linear-gradient(180deg, #13263D 0%, #0F1724 14%, #0B0B0D 30%, #0B0B0D 85%, #141417 100%)',
  pill: 'linear-gradient(90deg, #4D97FA 0%, #2F76DB 100%)',
  sun: 'linear-gradient(180deg, #FFE27A 0%, #FFC21A 100%)',
  summary: 'linear-gradient(120deg, #4E4790 0%, #7A4A72 55%, #8A4A55 100%)',
  chat: 'linear-gradient(120deg, #17223A 0%, #221A33 60%, #2E1A22 100%)',
  mood: 'linear-gradient(180deg, #1C1C1F 40%, #2C1F2B 100%)',
  robot: 'radial-gradient(circle at 35% 30%, #9ED8FF 0%, #3D8BF7 55%, #1E4FD6 100%)',
  auth: 'linear-gradient(160deg, #1A2236 0%, #141418 45%, #2A1A1C 100%)',
  glow:
    'radial-gradient(60% 30% at 40% 82%, rgba(90,104,170,0.35) 0%, rgba(0,0,0,0) 100%), radial-gradient(70% 28% at 15% 100%, rgba(150,70,110,0.35) 0%, rgba(0,0,0,0) 100%), radial-gradient(60% 26% at 90% 98%, rgba(120,90,170,0.35) 0%, rgba(0,0,0,0) 100%)',
};

const lightShadow = {
  card: '0px 10px 30px rgba(20, 20, 40, 0.08)',
  soft: '0px 4px 14px rgba(20, 20, 40, 0.08)',
  float: '0px 14px 40px rgba(20, 20, 40, 0.16)',
};
const darkShadow: typeof lightShadow = {
  card: '0px 10px 30px rgba(0, 0, 0, 0.5)',
  soft: '0px 4px 14px rgba(0, 0, 0, 0.45)',
  float: '0px 14px 40px rgba(0, 0, 0, 0.6)',
};

/**
 * The CURRENT theme's values. They are swapped in place when the user picks light / dark
 * (see lib/theme-mode.tsx), and every screen re-renders through useTheme(), so code can keep
 * reading colors.x / gradients.x / shadow.x / type.x during render.
 * StyleSheets that use them must be made with themedStyles() so they are rebuilt too.
 */
export const colors: Palette = { ...lightColors };
export const gradients: Gradients = { ...lightGradients };
export const shadow = { ...lightShadow };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 24, xl: 32, pill: 999 };

function makeType(c: Palette) {
  return {
    hero: { fontSize: 34, fontWeight: '800' as const, color: c.text, letterSpacing: -0.8 },
    title: { fontSize: 28, fontWeight: '800' as const, color: c.text, letterSpacing: -0.5 },
    heading: { fontSize: 19, fontWeight: '700' as const, color: c.text, letterSpacing: -0.2 },
    body: { fontSize: 16, color: c.text },
    small: { fontSize: 13, color: c.muted },
    label: { fontSize: 14, fontWeight: '600' as const, color: c.text },
  };
}
export const type = makeType(lightColors);

let version = 0;
let darkNow = false;
/** true while the dark palette is in use (for the few fixed-colour spots that need a dark twin). */
export const isDark = () => darkNow;
/** Swap every exported theme value to light or dark. Returns the new version number. */
export function applyTheme(dark: boolean) {
  darkNow = dark;
  Object.assign(colors, dark ? darkColors : lightColors);
  Object.assign(gradients, dark ? darkGradients : lightGradients);
  Object.assign(shadow, dark ? darkShadow : lightShadow);
  const t = makeType(dark ? darkColors : lightColors);
  for (const k of Object.keys(t) as (keyof typeof t)[]) Object.assign(type[k], t[k]);
  return ++version;
}
export const themeVersion = () => version;

/**
 * StyleSheet that follows the theme: built from the current values and rebuilt after a switch.
 *   const styles = themedStyles(() => ({ page: { backgroundColor: colors.bg } }));
 *   ... styles.page   (read during render)
 */
export function themedStyles<T extends Record<string, object>>(build: () => T): T {
  let built: T | null = null;
  let at = -1;
  return new Proxy({} as T, {
    get(_t, key: string) {
      if (!built || at !== version) {
        built = build();
        at = version;
      }
      return built[key as keyof T];
    },
  });
}

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
