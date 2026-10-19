import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { CircleAlert, WifiOff, type LucideIcon } from 'lucide-react-native';
import { Button } from './Button';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';
import { ApiError, errorMessage } from '@/api/client';

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Icon size={28} color={c.primary} strokeWidth={1.8} />
      </View>
      <Text variant="subheading" center>
        {title}
      </Text>
      {message ? (
        <Text tone="muted" center style={styles.emptyMessage}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <EmptyState
      compact={compact}
      icon={offline ? WifiOff : CircleAlert}
      title={offline ? 'Bağlantı yok' : 'Yüklenemedi'}
      message={errorMessage(error)}
      action={onRetry ? <Button title="Tekrar dene" variant="outline" size="sm" onPress={onRetry} /> : undefined}
    />
  );
}

export function Loading({ label, full = true }: { label?: string; full?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.loading, full && styles.full]}>
      <ActivityIndicator color={c.primary} />
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Pulsing placeholder block for content that is loading. */
export function Skeleton({
  width = '100%',
  height = 14,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: c.skeleton, opacity }, style]} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: space.xxxl, gap: space.sm, flexGrow: 1 },
  emptyCompact: { padding: space.xl, flexGrow: 0 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyMessage: { maxWidth: 300 },
  emptyAction: { marginTop: space.md },
  loading: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  full: { flex: 1 },
});
