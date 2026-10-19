import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Star, type LucideIcon } from 'lucide-react-native';
import { mediaUrl } from '@/lib/config';
import { Text } from './Text';
import { hairline, radius, shadow, space, useTheme } from './theme';

export function Card({ children, style, padded = true, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, padded && styles.cardPad, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { backgroundColor: c.elevated }]}>
      {children}
    </Pressable>
  );
}

export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? <Text variant="subheading">{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
  onRemove,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  onRemove?: () => void;
  count?: number;
}) {
  const { c } = useTheme();
  const fg = selected ? c.primary : c.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress ?? onRemove}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.primarySoft : pressed ? c.elevated : c.surface,
          borderColor: selected ? c.primary : c.border,
        },
      ]}
    >
      {Icon ? <Icon size={15} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {count != null ? (
        <Text variant="small" tone="subtle">
          {count}
        </Text>
      ) : null}
      {onRemove ? (
        <Text variant="label" style={{ color: fg }}>
          ✕
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary', style }: { label: string; tone?: 'primary' | 'danger' | 'ok' | 'warn' | 'neutral' | 'urgent'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const map = {
    primary: [c.primarySoft, c.primary],
    danger: [c.dangerSoft, c.danger],
    ok: [c.okSoft, c.ok],
    warn: [c.warnSoft, c.warn],
    neutral: [c.elevated, c.muted],
    urgent: [c.urgent, '#ffffff'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text variant="small" style={{ color: fg, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

/** Small red dot with a number, placed over an icon. */
export function CountDot({ count }: { count: number }) {
  const { c } = useTheme();
  if (!count) return null;
  return (
    <View style={[styles.dot, { backgroundColor: c.urgent, borderColor: c.surface }]}>
      <Text variant="small" style={styles.dotText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const { c } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr'))
    .join('');
  const src = mediaUrl(uri);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.primarySoft }]}>
      {src ? (
        <Image source={src} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Text style={{ color: c.primary, fontSize: size * 0.38, fontWeight: '700' }}>{initials || '?'}</Text>
      )}
    </View>
  );
}

const STAR = '#e0a000';

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${value.toFixed(1)} / 5 puan`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <Pressable key={n} hitSlop={6} onPress={() => onChange(n)} accessibilityLabel={`${n} yıldız`}>
            <Star size={size} color={STAR} fill={value >= n ? STAR : 'transparent'} />
          </Pressable>
        ) : (
          <Star key={n} size={size} color={STAR} fill={value >= n - 0.25 ? STAR : 'transparent'} />
        ),
      )}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: hairline, backgroundColor: c.border, marginLeft: inset }} />;
}

/** Settings-style row: icon, label, optional value/detail, chevron or switch. */
export function ListRow({
  icon: Icon,
  label,
  detail,
  value,
  onPress,
  switchValue,
  onSwitch,
  danger,
  right,
  disabled,
}: {
  icon?: LucideIcon;
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitch?: (v: boolean) => void;
  danger?: boolean;
  right?: ReactNode;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const content = (
    <>
      {Icon ? (
        <View style={[styles.rowIcon, { backgroundColor: danger ? c.dangerSoft : c.primarySoft }]}>
          <Icon size={18} color={danger ? c.danger : c.primary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text tone={danger ? 'danger' : 'default'} variant="body">
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {right}
      {onSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={onSwitch}
          disabled={disabled}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#ffffff"
        />
      ) : onPress ? (
        <ChevronRight size={18} color={c.subtle} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, disabled && styles.disabled]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.elevated }, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

/** Group of ListRows on a card with dividers between them. */
export function RowGroup({ children, title }: { children: ReactNode; title?: string }) {
  const { c } = useTheme();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.groupWrap}>
      {title ? (
        <Text variant="label" tone="muted" style={styles.groupTitle}>
          {title.toLocaleUpperCase('tr')}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <Divider inset={56} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.elevated }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, active && [{ backgroundColor: c.surface }, shadow(1)]]}
          >
            <Text variant="label" tone={active ? 'default' : 'muted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: hairline },
  cardPad: { padding: space.lg },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badge: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  dot: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotText: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stars: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  rowValue: { maxWidth: 140 },
  disabled: { opacity: 0.5 },
  groupWrap: { gap: space.sm },
  groupTitle: { marginLeft: space.lg, letterSpacing: 0.4 },
  group: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: radius.md - 2 },
});
