import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { TURKEY_CITIES } from '@/data/locations';
import { Input, Sheet, Text, hairline, space, useTheme } from '@/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Options; defaults to all 81 provinces. */
  options?: string[];
  value?: string | null;
  onSelect: (value: string | null) => void;
  /** Label of an extra first row that clears the choice ("Tüm iller"). */
  allLabel?: string;
};

const ALL_CITIES = TURKEY_CITIES.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'tr'));

/** Searchable single-choice list in a sheet (provinces, districts, neighborhoods, attribute options). */
export function OptionPicker({ visible, onClose, title, options = ALL_CITIES, value, onSelect, allLabel }: Props) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    return term ? options.filter((o) => o.toLocaleLowerCase('tr').includes(term)) : options;
  }, [options, q]);
  const rows = allLabel && !q ? [null, ...filtered] : filtered;

  return (
    <Sheet visible={visible} onClose={onClose} title={title} tall scroll={false}>
      {options.length > 12 ? (
        <View style={styles.search}>
          <Input icon={Search} placeholder="Ara" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item ?? '__all'}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        ListEmptyComponent={
          <Text tone="muted" center style={styles.empty}>
            Sonuç yok
          </Text>
        }
        renderItem={({ item }) => {
          const selected = item === (value ?? null) || (item === null && !value);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onSelect(item);
                setQ('');
                onClose();
              }}
              style={({ pressed }) => [styles.row, { borderBottomColor: c.border }, pressed && { backgroundColor: c.elevated }]}
            >
              <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'primary' : 'default'} style={styles.flex}>
                {item ?? allLabel}
              </Text>
              {selected ? <Check size={18} color={c.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderBottomWidth: hairline, paddingHorizontal: space.xs },
  empty: { padding: space.xl },
});
