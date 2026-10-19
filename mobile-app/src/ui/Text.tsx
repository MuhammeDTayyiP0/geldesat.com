import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { font, useTheme, weight, type Colors } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'small';
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'ok' | 'warn' | 'inverse' | 'onPrimary';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: font.display, fontWeight: weight.bold, letterSpacing: -0.5, lineHeight: 34 },
  title: { fontSize: font.xxl, fontWeight: weight.bold, letterSpacing: -0.3, lineHeight: 30 },
  heading: { fontSize: font.xl, fontWeight: weight.semibold, letterSpacing: -0.2, lineHeight: 26 },
  subheading: { fontSize: font.lg, fontWeight: weight.semibold, lineHeight: 23 },
  body: { fontSize: font.md, fontWeight: weight.regular, lineHeight: 21 },
  bodyStrong: { fontSize: font.md, fontWeight: weight.semibold, lineHeight: 21 },
  caption: { fontSize: font.sm, fontWeight: weight.regular, lineHeight: 18 },
  label: { fontSize: font.sm, fontWeight: weight.semibold, lineHeight: 18 },
  small: { fontSize: font.xs, fontWeight: weight.medium, lineHeight: 15 },
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
