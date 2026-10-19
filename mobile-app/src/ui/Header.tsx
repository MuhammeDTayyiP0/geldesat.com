import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { IconButton } from './Button';
import { Text } from './Text';
import { hairline, space, useTheme } from './theme';

type HeaderProps = {
  title?: string;
  subtitle?: string;
  /** Show the back chevron (default true). */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** Large left-aligned title for tab roots. */
  large?: boolean;
  children?: ReactNode;
  border?: boolean;
  transparent?: boolean;
};

/** Screen header drawn by the app (native headers are off), including the top safe area. */
export function Header({ title, subtitle, back = true, onBack, right, large, children, border = true, transparent }: HeaderProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + (large ? space.sm : 0),
          backgroundColor: transparent ? 'transparent' : c.surface,
          borderBottomColor: border && !transparent ? c.border : 'transparent',
        },
      ]}
    >
      <View style={[styles.row, large && styles.rowLarge]}>
        {back && !large ? <IconButton icon={ChevronLeft} label="Geri" onPress={goBack} size={40} /> : null}
        <View style={[styles.titles, !back && !large && styles.titlesPad]}>
          {title ? (
            <Text variant={large ? 'title' : 'subheading'} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: hairline },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.xs, gap: space.xs },
  rowLarge: { paddingHorizontal: space.lg, minHeight: 56 },
  titles: { flex: 1, justifyContent: 'center' },
  titlesPad: { paddingLeft: space.md },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingRight: space.xs },
});
