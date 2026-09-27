import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface LogoMarkProps {
  size?: number;
  color?: string;
}

/**
 * GeldeSat Orijinal Logo İkonu — Web sitesindeki SVG ile birebir aynıdır.
 */
export function LogoMark({ size = 28, color = '#0d1117' }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M24 32 H 32" stroke={color} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}
