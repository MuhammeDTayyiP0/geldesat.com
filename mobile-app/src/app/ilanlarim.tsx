import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { CircleCheck, Eye, EyeOff, ImageOff, LayoutGrid, MoreVertical, Pencil, Plus, RefreshCw, Rocket, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { myListings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Listing } from '@/api/types';
import { useSession } from '@/auth/session';
import { mediaUrl } from '@/lib/config';
import { daysUntil, formatNumber, formatPrice, isListingExpired, listingStatusLabel } from '@/lib/format';
import { Badge, Button, Chip, EmptyState, ErrorState, Header, ListRow, Loading, RowGroup, Sheet, Text, confirm, hairline, radius, space, toast, useTheme } from '@/ui';

type Tab = 'live' | 'pending' | 'off' | 'sold' | 'rejected';

const isExpired = isListingExpired;

function tabOf(l: Listing): Tab {
  if (l.status === 'PENDING') return 'pending';
  if (l.status === 'SOLD') return 'sold';
  if (l.status === 'REJECTED') return 'rejected';
  if (l.status === 'ACTIVE' && !isExpired(l)) return 'live';
  return 'off';
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'Yayında' },
  { key: 'pending', label: 'Onay bekleyen' },
  { key: 'off', label: 'Yayında değil' },
  { key: 'sold', label: 'Satıldı' },
  { key: 'rejected', label: 'Reddedilen' },
];

const daysLeft = daysUntil;

export default function MyListingsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState<Tab>('live');
  const [menu, setMenu] = useState<Listing | null>(null);
  const query = useQuery({ queryKey: keys.myListings, queryFn: myListings.list, enabled: session.status === 'signedIn' });

  const groups = useMemo(() => {
    const map: Record<Tab, Listing[]> = { live: [], pending: [], off: [], sold: [], rejected: [] };
    for (const l of query.data ?? []) map[tabOf(l)].push(l);
    return map;
  }, [query.data]);

  const action = useMutation({
    mutationFn: ({ listing, body }: { listing: Listing; body: Parameters<typeof myListings.action>[1] }) => myListings.action(listing.id, body),
    onSuccess: (_, { body }) => {
      void queryClient.invalidateQueries({ queryKey: keys.myListings });
      void queryClient.invalidateQueries({ queryKey: keys.me });
      const messages: Record<string, string> = {
        delete: 'İlan silindi',
        renew: 'İlan süresi 30 gün uzatıldı',
        ACTIVE: 'İlan yayına alındı',
        INACTIVE: 'İlan yayından kaldırıldı',
        SOLD: 'İlan satıldı olarak işaretlendi',
      };
      toast.success(messages[body.action === 'status' ? body.status : body.action] ?? 'Güncellendi');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // A confirm or another screen opened while the menu sheet is still closing
  // freezes the app, so those wait until the sheet is gone.
  const afterClose = useRef<(() => void) | null>(null);
  const run = (listing: Listing, body: Parameters<typeof myListings.action>[1]) => {
    if (body.action === 'delete') {
      afterClose.current = async () => {
        const ok = await confirm({ title: 'İlan silinsin mi?', message: 'Bu işlem geri alınamaz.', confirmText: 'Sil', destructive: true });
        if (ok) action.mutate({ listing, body });
      };
      setMenu(null);
      return;
    }
    setMenu(null);
    action.mutate({ listing, body });
  };
  /** Close the menu, then go somewhere once it is gone. */
  const thenGo = (go: () => void) => {
    afterClose.current = go;
    setMenu(null);
  };
  const runAfterClose = () => {
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  };

  if (session.status !== 'signedIn') {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <Header title="İlanlarım" />
        <EmptyState icon={LayoutGrid} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      </View>
    );
  }

  const list = groups[tab];

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title="İlanlarım"
        subtitle={query.data ? `${query.data.length} ilan` : undefined}
        right={<Button title="Yeni" icon={Plus} size="sm" variant="soft" onPress={() => router.push('/ilan-ver')} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} count={groups[t.key].length || undefined} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
      </Header>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon={LayoutGrid}
              title={tab === 'live' ? 'Yayında ilanınız yok' : 'Bu bölümde ilan yok'}
              message={tab === 'live' ? 'İlan vermek ücretsiz. Birkaç dakikada ilanınızı yayınlayın.' : undefined}
              action={tab === 'live' ? <Button title="İlan ver" icon={Plus} onPress={() => router.push('/ilan-ver')} /> : undefined}
            />
          }
          renderItem={({ item }) => <MyListingRow listing={item} onPress={() => router.push({ pathname: '/ilan/[id]', params: { id: item.id } })} onMenu={() => setMenu(item)} />}
        />
      )}

      <Sheet visible={!!menu} onClose={() => setMenu(null)} onDismissed={runAfterClose} title={menu?.title} subtitle={menu ? listingStatusLabel(menu.status ?? '', isExpired(menu)) : undefined}>
        {menu ? (
          <RowGroup>
            <ListRow
              icon={Eye}
              label="İlanı görüntüle"
              onPress={() => {
                const id = menu.id;
                thenGo(() => router.push({ pathname: '/ilan/[id]', params: { id } }));
              }}
            />
            {menu.status !== 'SOLD' ? (
              <ListRow
                icon={Pencil}
                label="Düzenle"
                detail="Değişiklikler yeniden incelemeye gidebilir"
                onPress={() => {
                  const id = menu.id;
                  thenGo(() => router.push({ pathname: '/ilan-ver', params: { id } }));
                }}
              />
            ) : null}
            {menu.status === 'ACTIVE' && !isExpired(menu) ? (
              <ListRow icon={EyeOff} label="Yayından kaldır" onPress={() => void run(menu, { action: 'status', status: 'INACTIVE' })} />
            ) : null}
            {menu.status === 'INACTIVE' ? (
              <ListRow icon={Eye} label="Yayına al" onPress={() => void run(menu, { action: 'status', status: 'ACTIVE' })} />
            ) : null}
            {menu.status === 'ACTIVE' || menu.status === 'INACTIVE' ? (
              <ListRow icon={CircleCheck} label="Satıldı olarak işaretle" onPress={() => void run(menu, { action: 'status', status: 'SOLD' })} />
            ) : null}
            {menu.status !== 'REJECTED' && menu.status !== 'SOLD' && menu.status !== 'PENDING' ? (
              <ListRow icon={RefreshCw} label="Süreyi 30 gün uzat" onPress={() => void run(menu, { action: 'renew' })} />
            ) : null}
            {menu.status === 'ACTIVE' ? (
              <ListRow
                icon={Rocket}
                label="Öne çıkar (doping)"
                onPress={() => thenGo(() => router.push('/doping'))}
              />
            ) : null}
            <ListRow icon={Trash2} label="Sil" danger onPress={() => void run(menu, { action: 'delete' })} />
          </RowGroup>
        ) : null}
      </Sheet>
    </View>
  );
}

function MyListingRow({ listing, onPress, onMenu }: { listing: Listing; onPress: () => void; onMenu: () => void }) {
  const { c } = useTheme();
  const expired = isExpired(listing);
  const left = daysLeft(listing.expires_at);
  const cover = mediaUrl(listing.images[0], 240);
  const tone = listing.status === 'ACTIVE' && !expired ? 'ok' : listing.status === 'REJECTED' ? 'danger' : listing.status === 'SOLD' ? 'neutral' : 'warn';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border }]}>
      <View style={[styles.thumb, { backgroundColor: c.elevated }]}>
        {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImageOff size={20} color={c.subtle} />}
      </View>
      <View style={styles.info}>
        <Text variant="label" numberOfLines={2}>
          {listing.title}
        </Text>
        <Text variant="bodyStrong" tone="primary">
          {formatPrice(listing.price, listing.currency)}
        </Text>
        <View style={styles.meta}>
          <Badge label={listingStatusLabel(listing.status ?? '', expired)} tone={tone} />
          <Text variant="small" tone="subtle">
            {formatNumber(listing.view_count ?? 0)} görüntülenme
          </Text>
        </View>
        {listing.status === 'ACTIVE' && left != null && left > 0 && left <= 7 ? (
          <Text variant="small" tone="warn">
            {left} gün içinde süresi doluyor
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityLabel="İşlemler" hitSlop={10} onPress={onMenu} style={styles.more}>
        <MoreVertical size={20} color={c.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  row: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: hairline },
  thumb: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  more: { padding: space.xs },
});
