import { useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { useThemePref } from '@/lib/themePref';

/** Brand palette, same tokens as the website (web/src/styles.css). */
const light = {
  bg: '#f3f5f8',
  surface: '#ffffff',
  elevated: '#eef1f5',
  border: '#d8dee6',
  borderStrong: '#c3cbd6',
  fg: '#12151c',
  muted: '#5a6270',
  subtle: '#8a929e',
  primary: '#1a4fd8',
  primaryPressed: '#1541b5',
  primarySoft: '#e8eefc',
  onPrimary: '#f7f8fc',
  ink: '#0d1117',
  danger: '#b42318',
  dangerSoft: '#fdecea',
  ok: '#1f7a4d',
  okSoft: '#e6f4ec',
  warn: '#9a6700',
  warnSoft: '#fdf3d8',
  urgent: '#d92d20',
  overlay: 'rgba(13,17,23,0.45)',
  bubbleMine: '#1a4fd8',
  bubbleMineText: '#ffffff',
  bubbleOther: '#ffffff',
  skeleton: '#e4e8ee',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0b0e13',
  surface: '#141922',
  elevated: '#1b212c',
  border: '#262e3b',
  borderStrong: '#344052',
  fg: '#eef1f6',
  muted: '#a3abb8',
  subtle: '#7a8392',
  primary: '#4f7cff',
  primaryPressed: '#3d68e6',
  primarySoft: '#1a2647',
  onPrimary: '#ffffff',
  ink: '#ffffff',
  danger: '#f97066',
  dangerSoft: '#3a1714',
  ok: '#47cd89',
  okSoft: '#11291d',
  warn: '#fdb022',
  warnSoft: '#33260a',
  urgent: '#f97066',
  overlay: 'rgba(0,0,0,0.6)',
  bubbleMine: '#3d68e6',
  bubbleMineText: '#ffffff',
  bubbleOther: '#1b212c',
  skeleton: '#1f2632',
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 28,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type Theme = { dark: boolean; c: Colors };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const pref = useThemePref();
  const isDark = pref === 'system' ? scheme === 'dark' : pref === 'dark';
  return isDark ? { dark: true, c: dark } : { dark: false, c: light };
}

/**
 * Theme-aware StyleSheet: `const s = useStyles(makeStyles)` with
 * `const makeStyles = (c: Colors) => StyleSheet.create({...})` at module level.
 */
export function useStyles<T>(factory: (c: Colors, isDark: boolean) => T): T {
  const { c, dark: isDark } = useTheme();
  return useMemo(() => factory(c, isDark), [factory, c, isDark]);
}

export function shadow(level: 1 | 2 = 1) {
  return Platform.select({
    ios: {
      shadowColor: '#0d1117',
      shadowOpacity: level === 1 ? 0.06 : 0.14,
      shadowRadius: level === 1 ? 8 : 18,
      shadowOffset: { width: 0, height: level === 1 ? 2 : 8 },
    },
    default: { elevation: level === 1 ? 1 : 6 },
  });
}

export const hairline = StyleSheet.hairlineWidth;
