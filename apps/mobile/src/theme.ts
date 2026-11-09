/** Pebble palette: warm sand background, deep teal accent, calm and low-contrast. */
export const colors = {
  bg: '#F6F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE4',
  border: '#E3DDD3',
  text: '#1F2933',
  muted: '#6B7280',
  primary: '#2F6F68',
  primaryText: '#FFFFFF',
  primarySoft: '#E2EFEC',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warn: '#B54708',
  warnSoft: '#FEF3E2',
  success: '#2F7A3E',
  successSoft: '#E6F4EA',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 14, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
};
