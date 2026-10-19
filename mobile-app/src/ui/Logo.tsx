import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from './theme';

/** Logo navy from web/public/favicon.svg, and its light counterpart for dark mode. */
export const BRAND_NAVY = '#0A2342';
export const BRAND_LIGHT = '#F7F8FC';

/** GeldeSat mark, same paths as web/public/favicon.svg. */
export function LogoMark({ size = 28, color }: { size?: number; color?: string }) {
  const { dark } = useTheme();
  const stroke = color ?? (dark ? BRAND_LIGHT : BRAND_NAVY);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        stroke={stroke}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M24 32 H 32" stroke={stroke} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

/** The app icon itself (favicon.svg): navy mark on a light rounded tile. */
export function BrandIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect width={64} height={64} rx={14} fill={BRAND_LIGHT} />
      <Path
        d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        stroke={BRAND_NAVY}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M24 32 H 32" stroke={BRAND_NAVY} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="GeldeSat">
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize: size * 0.78, color: c.fg }]}>
        Gelde<Text style={[styles.word, { fontSize: size * 0.78, color: c.primary }]}>Sat</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontWeight: '800', letterSpacing: -0.6 },
});
