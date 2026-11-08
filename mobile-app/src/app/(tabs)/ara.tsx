import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Clock, Hash, Search, X } from 'lucide-react-native';
import { ApiError } from '@/api/client';
import { listings } from '@/api/endpoints';
import { keys, queryClient, useRoots } from '@/api/queries';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { formatNumber } from '@/lib/format';
import { clearSearches, forgetSearch, rememberSearch, useRecentSearches } from '@/lib/storage';
import { Divider, ErrorState, Skeleton, Text, font, hairline, radius, space, useTheme, type TextInputRef } from '@/ui';

export default function SearchTab() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const inputRef = useRef<TextInputRef>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scrollRef);
  const [q, setQ] = useState('');
  const recent = useRecentSearches();
  const roots = useRoots();

  // Every time the home search box sends people here, not only the first: the tab stays mounted.
  useFocusEffect(
    useCallback(() => {
      if (!focus) return;
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      router.setParams({ focus: undefined });
      return () => clearTimeout(t);
    }, [focus, router]),
  );

  const [opening, setOpening] = useState(false);
  const submit = async (term: string) => {
    const value = term.trim();
    if (!value || opening) return;
    void rememberSearch(value);
    // A number may be a listing number, or just something in a title (a phone, a model): try the listing first.
    if (/^\d{7,15}$/.test(value)) {
      setOpening(true);
      try {
        await queryClient.fetchQuery({ queryKey: keys.listing(value), queryFn: () => listings.detail(value), staleTime: 30_000 });
        router.push({ pathname: '/ilan/[id]', params: { id: value } });
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          router.push({ pathname: '/ilan/[id]', params: { id: value } });
          return;
        }
      } finally {
        setOpening(false);
      }
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
            onSubmitEditing={() => void submit(q)}
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {q.trim() ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit(q)}
            style={[styles.suggest, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            {/^\d{7,15}$/.test(q.trim()) ? <Hash size={18} color={c.primary} /> : <Search size={18} color={c.primary} />}
            <Text style={styles.flex} numberOfLines={1}>
              {opening ? 'İlan aranıyor…' : /^\d{7,15}$/.test(q.trim()) ? `İlan no ${q.trim()} ya da “${q.trim()}” ara` : `“${q.trim()}” için ara`}
            </Text>
            <ChevronRight size={18} color={c.subtle} />
          </Pressable>
        ) : null}

        {recent.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="subheading">Son aramalar</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Son aramaları temizle" hitSlop={8} onPress={() => void clearSearches()}>
                <Text variant="label" tone="primary">
                  Temizle
                </Text>
              </Pressable>
            </View>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {recent.map((term, i) => (
                <View key={term}>
                  {i ? <Divider inset={48} /> : null}
                  {/* The delete button sits beside the row, not inside it, so screen readers reach it. */}
                  <View style={styles.recentLine}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${term} ara`}
                      onPress={() => void submit(term)}
                      style={({ pressed }) => [styles.recentRow, pressed && { backgroundColor: c.elevated }]}
                    >
                      <Clock size={18} color={c.subtle} />
                      <Text style={styles.flex} numberOfLines={1}>
                        {term}
                      </Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${term} aramasını sil`} onPress={() => void forgetSearch(term)} style={styles.recentDelete}>
                      <X size={16} color={c.subtle} />
                    </Pressable>
                  </View>
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
            {roots.isError && !roots.data ? (
              <View style={styles.flex}>
                <ErrorState error={roots.error} onRetry={() => void roots.refetch()} compact />
              </View>
            ) : roots.isLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={84} rounded={14} style={styles.tileSkeleton} />)
              : (roots.data?.roots ?? []).map((cat) => {
                  const { icon: Icon, tint } = categoryIcon(cat.icon, dark);
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
  recentLine: { flexDirection: 'row', alignItems: 'center' },
  recentRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, minHeight: 50 },
  recentDelete: { width: 48, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  // Two columns on every width: 2 × 48.8% plus a fixed gap did not fit 360 dp phones.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  tile: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: hairline,
    minHeight: 72,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileSkeleton: { width: '48.5%' },
});
