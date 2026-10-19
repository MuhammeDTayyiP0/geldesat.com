import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Clock, Hash, Search, X } from 'lucide-react-native';
import { useRoots } from '@/api/queries';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { formatNumber } from '@/lib/format';
import { clearSearches, forgetSearch, rememberSearch, useRecentSearches } from '@/lib/storage';
import { Divider, Skeleton, Text, font, hairline, radius, space, useTheme, type TextInputRef } from '@/ui';

export default function SearchTab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const inputRef = useRef<TextInputRef>(null);
  const [q, setQ] = useState('');
  const recent = useRecentSearches();
  const roots = useRoots();

  useEffect(() => {
    if (focus) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [focus]);

  const submit = (term: string) => {
    const value = term.trim();
    if (!value) return;
    void rememberSearch(value);
    // A bare listing number opens that listing.
    if (/^\d{7,15}$/.test(value)) {
      router.push({ pathname: '/ilan/[id]', params: { id: value } });
      return;
    }
    router.push({ pathname: '/sonuclar', params: { q: value } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Text variant="title">Ara</Text>
        <View style={[styles.field, { backgroundColor: c.elevated }]}>
          <Search size={20} color={c.subtle} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Marka, model, ürün veya ilan no"
            placeholderTextColor={c.subtle}
            returnKeyType="search"
            onSubmitEditing={() => submit(q)}
            autoCorrect={false}
            style={[styles.input, { color: c.fg }]}
            accessibilityLabel="Arama"
          />
          {q ? (
            <Pressable accessibilityLabel="Temizle" hitSlop={8} onPress={() => setQ('')}>
              <X size={18} color={c.subtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {q.trim() ? (
          <Pressable onPress={() => submit(q)} style={[styles.suggest, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/^\d{7,15}$/.test(q.trim()) ? <Hash size={18} color={c.primary} /> : <Search size={18} color={c.primary} />}
            <Text style={styles.flex} numberOfLines={1}>
              {/^\d{7,15}$/.test(q.trim()) ? `İlan no ${q.trim()} ile aç` : `“${q.trim()}” için ara`}
            </Text>
            <ChevronRight size={18} color={c.subtle} />
          </Pressable>
        ) : null}

        {recent.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="subheading">Son aramalar</Text>
              <Pressable hitSlop={8} onPress={() => void clearSearches()}>
                <Text variant="label" tone="primary">
                  Temizle
                </Text>
              </Pressable>
            </View>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {recent.map((term, i) => (
                <View key={term}>
                  {i ? <Divider inset={48} /> : null}
                  <Pressable onPress={() => submit(term)} style={({ pressed }) => [styles.recentRow, pressed && { backgroundColor: c.elevated }]}>
                    <Clock size={18} color={c.subtle} />
                    <Text style={styles.flex} numberOfLines={1}>
                      {term}
                    </Text>
                    <Pressable accessibilityLabel={`${term} aramasını sil`} hitSlop={10} onPress={() => void forgetSearch(term)}>
                      <X size={16} color={c.subtle} />
                    </Pressable>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="subheading">Kategoriler</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/kategoriler')}>
              <Text variant="label" tone="primary">
                Tümünü gez
              </Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {roots.isLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={84} rounded={14} style={styles.tileSkeleton} />)
              : (roots.data?.roots ?? []).map((cat) => {
                  const { icon: Icon, tint } = categoryIcon(cat.icon);
                  const count = roots.data?.counts[cat.id];
                  return (
                    <Pressable
                      key={cat.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/kategoriler', params: { root: cat.id } })}
                      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border }]}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: `${tint}1a` }]}>
                        <Icon size={22} color={tint} />
                      </View>
                      <View style={styles.flex}>
                        <Text variant="label" numberOfLines={2}>
                          {cat.name}
                        </Text>
                        {count ? (
                          <Text variant="small" tone="subtle">
                            {formatNumber(count)} ilan
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md, borderBottomWidth: hairline },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 48 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: hairline },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 50 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '48.8%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: hairline,
    minHeight: 72,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileSkeleton: { width: '48.8%' },
});
