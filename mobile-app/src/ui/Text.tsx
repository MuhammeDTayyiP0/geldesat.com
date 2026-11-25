import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { FONT_FAMILY } from './fonts';
import { font, useTheme, type Colors } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'small';
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'ok' | 'warn' | 'inverse' | 'onPrimary';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: FONT_FAMILY.bold, fontSize: font.display, letterSpacing: -0.5, lineHeight: 34 },
  title: { fontFamily: FONT_FAMILY.bold, fontSize: font.xxl, letterSpacing: -0.3, lineHeight: 30 },
  heading: { fontFamily: FONT_FAMILY.semibold, fontSize: font.xl, letterSpacing: -0.2, lineHeight: 26 },
  subheading: { fontFamily: FONT_FAMILY.semibold, fontSize: font.lg, lineHeight: 23 },
  body: { fontFamily: FONT_FAMILY.regular, fontSize: font.md, lineHeight: 21 },
  bodyStrong: { fontFamily: FONT_FAMILY.semibold, fontSize: font.md, lineHeight: 21 },
  caption: { fontFamily: FONT_FAMILY.regular, fontSize: font.sm, lineHeight: 18 },
  label: { fontFamily: FONT_FAMILY.semibold, fontSize: font.sm, lineHeight: 18 },
  small: { fontFamily: FONT_FAMILY.medium, fontSize: font.xs, lineHeight: 15 },
};

function toneColor(c: Colors, tone: Tone): string {
  switch (tone) {
    case 'muted':
      return c.muted;
    case 'subtle':
      return c.subtle;
    case 'primary':
      return c.primary;
    case 'danger':
      return c.danger;
    case 'ok':
      return c.ok;
    case 'warn':
      return c.warn;
    case 'inverse':
      return c.bg;
    case 'onPrimary':
      return c.onPrimary;
    default:
      return c.fg;
  }
}

export type TextProps = RNTextProps & { variant?: Variant; tone?: Tone; center?: boolean };

export function Text({ variant = 'body', tone = 'default', center, style, ...rest }: TextProps) {
  const { c } = useTheme();
  return (
    <RNText
      {...rest}
      style={[VARIANTS[variant], { color: toneColor(c, tone) }, center && { textAlign: 'center' }, style]}
    />
  );
}
