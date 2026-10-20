import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronRight, Heart, History, LayoutGrid, MessageCircle, Rocket, Settings, Store } from 'lucide-react-native';
import { keys, queryClient, useCounts, useMe } from '@/api/queries';
import { useSession } from '@/auth/session';
import { formatNumber } from '@/lib/format';
import { Avatar, Badge, BrandIcon, Button, IconButton, ListRow, RowGroup, Stars, Text, hairline, radius, space, useTheme } from '@/ui';

export default function AccountScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const me = useMe();
  const { data: counts } = useCounts();
  const signedIn = session.status === 'signedIn';

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
  const openProfile = () => router.push({ pathname: '/satici/[id]', params: { id: session.user.id } });

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={me.isRefetching}
          onRefresh={() => {
            void me.refetch();
            void queryClient.invalidateQueries({ queryKey: keys.counts });
          }}
          tintColor={c.primary}
        />
      }
    >
      {topBar}

      {/* "Hesabım" is only a menu; what others see is the public profile ("Profilimi gör"). */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profilimi gör" onPress={openProfile} style={styles.profileRow}>
          <Avatar name={name} uri={profile?.avatar_url} size={64} />
          <View style={styles.flex}>
            <Text variant="heading" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {session.user.email}
            </Text>
            <View style={styles.rating}>
              <Text variant="label" tone="primary">
                Profilimi gör
              </Text>
              <ChevronRight size={16} color={c.primary} />
            </View>
          </View>
        </Pressable>

        <View style={[styles.stats, { backgroundColor: c.elevated }]}>
          <Stat label="Yayında" value={profile?.active_count} />
          <View style={[styles.statDivider, { backgroundColor: c.border }]} />
          <Stat label="Favori" value={profile?.favorite_count} />
          <View style={[styles.statDivider, { backgroundColor: c.border }]} />
          <View style={styles.stat}>
            {profile?.rating_count ? (
              <View style={styles.rating}>
                <Stars value={profile.rating_avg} size={12} />
                <Text variant="subheading">{profile.rating_avg.toFixed(1)}</Text>
              </View>
            ) : (
              <Text variant="subheading">–</Text>
            )}
            <Text variant="small" tone="muted">
              {profile?.rating_count ? `${profile.rating_count} değerlendirme` : 'Puan'}
            </Text>
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
      </View>

      <View style={styles.groups}>
        <RowGroup>
          <ListRow icon={LayoutGrid} label="İlanlarım" detail="Yayındaki, bekleyen ve pasif ilanlar" onPress={() => router.push('/ilanlarim')} />
          <ListRow icon={Heart} label="Favorilerim" detail="Kaydettiğiniz ilanlar" onPress={() => router.push('/favoriler')} />
          <ListRow icon={History} label="Son baktıklarım" detail="Son incelediğiniz 50 ilan" onPress={() => router.push('/son-bakilanlar')} />
          <ListRow
            icon={MessageCircle}
            label="Mesajlar"
            detail="Alıcı ve satıcılarla yazışmalar"
            right={<Count n={counts?.messages} />}
            onPress={() => router.push('/mesajlar')}
          />
          <ListRow
            icon={Bell}
            label="Bildirimler"
            detail="Mesaj, favori ve ilan durumu"
            right={<Count n={counts?.notifications} />}
            onPress={() => router.push('/bildirimler')}
          />
        </RowGroup>
        <RowGroup>
          {me.data?.store ? (
            <ListRow icon={Store} label="Mağazam" detail={me.data.store.name} onPress={() => router.push('/ayarlar/magaza')} />
          ) : null}
          <ListRow icon={Rocket} label="Doping" detail="İlanınızı öne çıkarın" onPress={() => router.push('/doping')} />
        </RowGroup>
        <RowGroup>
          <ListRow icon={Settings} label="Ayarlar" detail="Profil, güvenlik, bildirimler, çıkış" onPress={() => router.push('/ayarlar' as Href)} />
        </RowGroup>
      </View>
    </ScrollView>
  );
}

/** Unread count pill at the end of a menu row. */
function Count({ n }: { n?: number }) {
  if (!n) return null;
  return <Badge label={n > 99 ? '99+' : String(n)} tone="urgent" />;
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
  stats: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingVertical: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: hairline, alignSelf: 'stretch' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  groups: { gap: space.md, paddingHorizontal: space.lg },
});
