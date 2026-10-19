import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { radius, space, useTheme, type Colors } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  block?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = { sm: 36, md: 46, lg: 52 };

function palette(c: Colors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { bg: c.primary, pressed: c.primaryPressed, fg: c.onPrimary, border: 'transparent' };
    case 'secondary':
      return { bg: c.ink, pressed: c.muted, fg: c.bg, border: 'transparent' };
    case 'outline':
      return { bg: c.surface, pressed: c.elevated, fg: c.fg, border: c.border };
    case 'ghost':
      return { bg: 'transparent', pressed: c.elevated, fg: c.primary, border: 'transparent' };
    case 'danger':
      return { bg: c.dangerSoft, pressed: c.dangerSoft, fg: c.danger, border: 'transparent' };
    case 'soft':
      return { bg: c.primarySoft, pressed: c.primarySoft, fg: c.primary, border: 'transparent' };
  }
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  block,
  haptic,
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { c } = useTheme();
  const p = palette(c, variant);
  const inactive = disabled || loading;
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? space.md : space.lg,
          backgroundColor: pressed ? p.pressed : p.bg,
          borderColor: p.border,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: inactive && !loading ? 0.5 : 1,
        },
        block && styles.block,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={iconSize} color={p.fg} strokeWidth={2.2} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} style={{ color: p.fg }} numberOfLines={1}>
            {title}
          </Text>
          {IconRight ? <IconRight size={iconSize} color={p.fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  size = 40,
  tone = 'default',
  filled,
  badge,
  disabled,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  size?: number;
  tone?: 'default' | 'primary' | 'danger' | 'onImage';
  filled?: boolean;
  badge?: ReactNode;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const color = tone === 'primary' ? c.primary : tone === 'danger' ? c.danger : tone === 'onImage' ? '#fff' : c.fg;
  const bg = tone === 'onImage' ? 'rgba(13,17,23,0.45)' : filled ? c.surface : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed ? c.elevated : bg, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} />
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
