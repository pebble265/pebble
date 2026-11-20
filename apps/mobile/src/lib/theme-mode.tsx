import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { applyTheme, colors, gradients, shadow, type } from '../theme';
import { getLang, type Lang, setLangValue } from './i18n';
import { getItem, setItem } from './storage';

/** What the user picked on Settings > Appearance. "system" follows the phone. */
export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'pebble.theme';

type Ctx = {
  mode: ThemeMode;
  dark: boolean;
  version: number;
  setMode(m: ThemeMode): void;
  /** sign-in / sign-up / first-run screens are designed light only */
  setLightOnly(v: boolean): void;
  /** app language (the text is translated in components/text.tsx) */
  lang: Lang;
  setLang(l: Lang): void;
};
const ThemeCtx = createContext<Ctx>({
  mode: 'system',
  dark: false,
  version: 0,
  setMode: () => {},
  setLightOnly: () => {},
  lang: 'th',
  setLang: () => {},
});

const LANG_KEY = 'pebble.lang';
/** Before sign-in: the last language used, else the phone's language. */
function deviceLang(): Lang {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('th') ? 'th' : 'en';
  } catch {
    return 'th';
  }
}

/** Applies light / dark to the shared theme values and re-renders every screen that calls useTheme(). */
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [lightOnly, setLightOnly] = useState(true);
  const [lang, setLangState] = useState<Lang>(() => {
    const l = deviceLang();
    setLangValue(l);
    return l;
  });
  if (getLang() !== lang) setLangValue(lang);
  const dark = !lightOnly && (mode === 'dark' || (mode === 'system' && system === 'dark'));
  // swap the values during render so the very first paint is already in the right theme
  const [applied, setApplied] = useState<{ dark: boolean; version: number }>(() => ({ dark: false, version: 0 }));
  let version = applied.version;
  if (applied.dark !== dark) {
    version = applyTheme(dark);
    setApplied({ dark, version });
  }

  useEffect(() => {
    getItem(LANG_KEY)
      .then((v) => {
        if (v === 'th' || v === 'en') setLangState(v);
      })
      .catch(() => {});
    getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void setItem(KEY, m === 'system' ? null : m);
  }, []);

  // native pickers, alerts and the keyboard follow the app's choice too
  useEffect(() => {
    Appearance.setColorScheme?.(lightOnly ? 'light' : mode === 'system' ? 'unspecified' : mode);
  }, [lightOnly, mode]);

  const setLang = useCallback((l: Lang) => {
    setLangValue(l);
    setLangState(l);
    void setItem(LANG_KEY, l);
  }, []);

  const value = useMemo(
    () => ({ mode, dark, version, setMode, setLightOnly, lang, setLang }),
    [mode, dark, version, setMode, lang, setLang],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/**
 * Call at the top of every screen/component that shows themed colors: it re-renders it when the
 * theme changes. Returns the current values (the same objects as the theme exports).
 */
export function useTheme() {
  const ctx = useContext(ThemeCtx);
  return { ...ctx, colors, gradients, shadow, type };
}
