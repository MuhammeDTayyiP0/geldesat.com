import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { Category } from '@/api/types';
import { formatNumber } from '@/lib/format';
import { Divider, Sheet, Text, radius, space, useTheme } from '@/ui';
import { categoryIcon } from './categoryIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 'filter' may pick any level (and "Tüm kategoriler"); 'post' must reach a leaf. */
  mode: 'filter' | 'post';
  initialPath?: string[];
  onPick: (category: Category | null, path: Category[]) => void;
};

/** Drill-down category chooser in a sheet, loading one level at a time. */
export function CategoryPicker({ visible, onClose, mode, initialPath = [], onPick }: Props) {
  const { c } = useTheme();
  const [path, setPath] = useState<string[]>(initialPath);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPath(initialPath);
  }
  const level = useQuery({ queryKey: keys.browse(path), queryFn: () => catalog.browse(path), enabled: visible, placeholderData: (p) => p });
  const pathRows = level.data?.pathRows ?? [];
  const current = pathRows[pathRows.length - 1];
  const children = level.data?.children ?? [];
  const counts = level.data?.counts ?? {};

  const choose = (cat: Category | null, rows: Category[]) => {
    onPick(cat, rows);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={current?.name ?? (mode === 'post' ? 'Kategori seçin' : 'Kategori')}
      subtitle={pathRows.length > 1 ? pathRows.slice(0, -1).map((r) => r.name).join(' › ') : undefined}
      tall
    >
      {path.length ? (
        <Pressable onPress={() => setPath(path.slice(0, -1))} style={styles.back} hitSlop={6}>
          <ChevronLeft size={18} color={c.primary} />
          <Text variant="label" tone="primary">
            {pathRows.length > 1 ? pathRows[pathRows.length - 2]?.name : 'Tüm kategoriler'}
          </Text>
        </Pressable>
      ) : null}

      {mode === 'filter' ? (
        <Pressable
          onPress={() => choose(current ?? null, pathRows)}
          style={({ pressed }) => [styles.all, { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : c.surface }]}
        >
          <Check size={18} color={c.primary} />
          <Text variant="bodyStrong" tone="primary" style={styles.flex}>
            {current ? `“${current.name}” içinde ara` : 'Tüm kategoriler'}
          </Text>
        </Pressable>
      ) : null}

      {level.isFetching && !level.data ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : (
        <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
          {children.map((cat, i) => {
            const { icon: Icon, tint } = categoryIcon(cat.icon);
            return (
              <View key={cat.id}>
                {i ? <Divider inset={space.lg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const rows = [...pathRows, cat];
                    if (cat.has_children === false) choose(cat, rows);
                    else setPath([...path, cat.id]);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.elevated }]}
                >
                  {path.length === 0 ? (
                    <View style={[styles.icon, { backgroundColor: `${tint}1a` }]}>
                      <Icon size={18} color={tint} />
                    </View>
                  ) : null}
                  <Text style={styles.flex}>{cat.name}</Text>
                  {counts[cat.id] ? (
                    <Text variant="caption" tone="subtle">
                      {formatNumber(counts[cat.id])}
                    </Text>
                  ) : null}
                  {cat.has_children !== false ? <ChevronRight size={18} color={c.subtle} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  all: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  loading: { padding: space.xxl },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
