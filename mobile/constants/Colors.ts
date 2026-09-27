/**
 * geldesat.com — Kurumsal Renk ve Tasarım Sistemi Sabitleri
 * Web projesindeki (styles.css) renk paleti ile %100 eşlenmiştir.
 */

const primaryBlue = '#1a4fd8';
const primaryDark = '#103bb0';

export const BrandColors = {
  primary: primaryBlue,
  primaryDark: primaryDark,
  primaryLight: '#3b71f7',
  primaryForeground: '#ffffff',
  
  // Arka Plan ve Yüzeyler
  background: '#f3f5f8',
  surface: '#ffffff',
  elevated: '#eef1f5',
  border: '#d8dee6',
  borderLight: '#eef2f6',
  
  // Tipografi Renkleri
  text: '#12151c',
  textSecondary: '#5a6270',
  textMuted: '#8a929e',
  
  // Durum ve Rozet Renkleri
  danger: '#b42318',      // ACİL Satılık rozeti
  dangerBg: '#fef3f2',
  dangerBorder: '#fecdca',
  
  warning: '#d97706',     // ÖNE ÇIKAN rozeti
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  
  success: '#1f7a4d',     // Onaylı / Güvenli
  successBg: '#edfcf2',
  successBorder: '#a6f4c5',

  // Sahibinden Tarzı İlan Ver Butonu (Vurgulu)
  ctaYellow: '#f59e0b',
  ctaYellowHover: '#d97706',
  ctaText: '#0d1117',
};

export default {
  light: {
    text: BrandColors.text,
    background: BrandColors.background,
    surface: BrandColors.surface,
    tint: BrandColors.primary,
    tabIconDefault: '#8a929e',
    tabIconSelected: BrandColors.primary,
    border: BrandColors.border,
  },
  dark: {
    text: '#ffffff',
    background: '#0d1117',
    surface: '#161b22',
    tint: '#58a6ff',
    tabIconDefault: '#6e7681',
    tabIconSelected: '#58a6ff',
    border: '#30363d',
  },
};
