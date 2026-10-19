import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, Heart, LayoutGrid, MessageCircle, Pencil, Rocket, Settings, Store, type LucideIcon } from 'lucide-react-native';
import { myListings } from '@/api/endpoints';
import { keys, queryClient, useCounts, useMe } from '@/api/queries';
import { useSession } from '@/auth/session';
import { ListingRail } from '@/features/listing/ListingRail';
import { formatNumber, memberSince } from '@/lib/format';
import { Avatar, Button, IconButton, BrandIcon, Stars, Text, hairline, radius, space, useTheme } from '@/ui';

export default function AccountScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const me = useMe();
  const { data: counts } = useCounts();
  const signedIn = session.status === 'signedIn';
  const [now] = useState(() => Date.now());
  const mine = useQuery({ queryKey: keys.myListings, queryFn: myListings.list, enabled: signedIn });

  const topBar = (
    <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
      <Text variant="title">Hesabım</Text>
      <IconButton icon={Settings} label="Ayarlar" filled onPress={() => router.push('/ayarlar' as Href)} />
    </View>
  );

  if (!signedIn) {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.guestWrap}>
        {topBar}
        <View style={styles.guest}>
          <View style={[styles.guestLogo, { borderColor: c.border }]}>
            <BrandIcon size={80} />
          </View>
          <Text variant="title" center>
            GeldeSat’a hoş geldiniz
          </Text>
          <Text tone="muted" center>
            Ücretsiz ilan verin, satıcılarla mesajlaşın, favorilerinizi kaydedin.
          </Text>
          <Button title="Giriş yap" size="lg" block onPress={() => router.push('/giris')} />
          <Button title="Üye ol" size="lg" variant="outline" block onPress={() => router.push('/giris')} />
        </View>
      </ScrollView>
    );
  }

  const profile = me.data?.profile;
  const name = profile?.display_name || session.user.name;
  const live = (mine.data ?? []).filter((l) => l.status === 'ACTIVE' && !(l.expires_at && new Date(l.expires_at).getTime() < now));

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={me.isRefetching}
          onRefresh={() => {
            void me.refetch();
            void mine.refetch();
            void queryClient.invalidateQueries({ queryKey: keys.counts });
          }}
          tintColor={c.primary}
        />
      }
    >
      {topBar}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.profileRow}>
          <Avatar name={name} uri={profile?.avatar_url} size={72} />
          <View style={styles.flex}>
            <Text variant="heading" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {session.user.email}
            </Text>
            {profile?.rating_count ? (
              <View style={styles.rating}>
                <Stars value={profile.rating_avg} size={12} />
                <Text variant="small" tone="muted">
                  {profile.rating_avg.toFixed(1)} ({profile.rating_count})
                </Text>
              </View>
            ) : profile?.created_at ? (
              <Text variant="small" tone="subtle">
                {memberSince(profile.created_at)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.stats, { borderColor: c.border }]}>
          <Stat label="Yayında" value={profile?.active_count} />
          <View style={[styles.statDivider, { backgroundColor: c.border }]} />
          <Stat label="Toplam ilan" value={profile?.listing_count} />
          <View style={[styles.statDivider, { backgroundColor: c.border }]} />
          <Stat label="Favori" value={profile?.favorite_count} />
        </View>

        <View style={styles.actions}>
          <Button title="Profili düzenle" icon={Pencil} size="sm" variant="outline" style={styles.flex} onPress={() => router.push('/ayarlar/profil')} />
          <Button
            title="Herkese açık"
            icon={ExternalLink}
            size="sm"
            variant="outline"
            style={styles.flex}
            onPress={() => router.push({ pathname: '/satici/[id]', params: { id: session.user.id } })}
          />
        </View>
      </View>

      {profile && !profile.phone ? (
        <Pressable onPress={() => router.push('/ayarlar/profil')} style={[styles.warn, { backgroundColor: c.warnSoft }]}>
          <Text variant="caption" tone="warn" style={styles.flex}>
            İlan verebilmek için profilinize telefon numarası ekleyin.
          </Text>
          <Text variant="label" tone="warn">
            Ekle
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.tiles}>
        <Tile icon={LayoutGrid} label="İlanlarım" detail={`${formatNumber(profile?.listing_count ?? 0)} ilan`} to="/ilanlarim" />
        <Tile icon={Heart} label="Favorilerim" detail={`${formatNumber(profile?.favorite_count ?? 0)} ilan`} to="/favoriler" />
        <Tile
          icon={MessageCircle}
          label="Mesajlar"
          detail={counts?.messages ? `${counts.messages} okunmamış` : 'Yazışmalar'}
          badge={counts?.messages}
          to="/mesajlar"
        />
        <Tile
          icon={Bell}
          label="Bildirimler"
          detail={counts?.notifications ? `${counts.notifications} yeni` : 'Güncellemeler'}
          badge={counts?.notifications}
          to="/bildirimler"
        />
        {me.data?.store ? <Tile icon={Store} label="Mağazam" detail={me.data.store.name} to="/ayarlar/magaza" /> : null}
        <Tile icon={Rocket} label="Doping" detail="İlanı öne çıkar" to="/doping" />
      </View>

      {live.length ? (
        <View style={styles.rail}>
          <ListingRail title="Yayındaki ilanlarım" items={live} onSeeAll={() => router.push('/ilanlarim')} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="subheading">{value == null ? '–' : formatNumber(value)}</Text>
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Tile({ icon: Icon, label, detail, to, badge = 0 }: { icon: LucideIcon; label: string; detail: string; to: Href; badge?: number }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} yeni` : label}
      onPress={() => router.push(to)}
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: c.primarySoft }]}>
        <Icon size={20} color={c.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.urgent }]}>
          <Text variant="small" style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.sm },
  guestWrap: { flexGrow: 1 },
  guest: { padding: space.xl, gap: space.md, alignItems: 'stretch', marginTop: space.xl },
  guestLogo: { borderRadius: 18, borderWidth: hairline, overflow: 'hidden', alignSelf: 'center', marginBottom: space.md },
  content: { gap: space.lg, paddingBottom: space.xxxl },
  card: { marginHorizontal: space.lg, borderRadius: radius.xl, borderWidth: hairline, padding: space.lg, gap: space.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', borderTopWidth: hairline, borderBottomWidth: hairline, paddingVertical: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: hairline, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: space.sm },
  warn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginHorizontal: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },
  tile: {
    width: '48.6%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: hairline,
    minHeight: 64,
  },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '700' },
  rail: { marginTop: space.sm },
});
