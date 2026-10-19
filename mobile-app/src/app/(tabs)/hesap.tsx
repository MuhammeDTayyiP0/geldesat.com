import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import {
  Ban,
  Bell,
  ChevronRight,
  FileText,
  Heart,
  HelpCircle,
  KeyRound,
  LayoutGrid,
  LogOut,
  Mail,
  MessageSquareText,
  Rocket,
  Shield,
  SlidersHorizontal,
  Store,
  UserRound,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { keys, queryClient, useCounts, useMe } from '@/api/queries';
import { signOut } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { SUPPORT_EMAIL } from '@/lib/config';
import { formatNumber, memberSince } from '@/lib/format';
import { unregisterPush } from '@/lib/push';
import { Avatar, Button, CountDot, ListRow, LogoMark, RowGroup, Stars, Text, confirm, hairline, radius, space, toast, useTheme } from '@/ui';

export default function AccountScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const me = useMe();
  const { data: counts } = useCounts();

  if (session.status !== 'signedIn') {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.guest, { paddingTop: insets.top + space.xxl }]}>
        <View style={[styles.guestLogo, { backgroundColor: c.primarySoft }]}>
          <LogoMark size={40} color={c.primary} />
        </View>
        <Text variant="title" center>
          GeldeSat’a hoş geldiniz
        </Text>
        <Text tone="muted" center>
          Ücretsiz ilan verin, satıcılarla mesajlaşın, favorilerinizi kaydedin.
        </Text>
        <Button title="Giriş yap" size="lg" block onPress={() => router.push('/giris')} />
        <Button title="Üye ol" size="lg" variant="outline" block onPress={() => router.push('/giris')} />
        <View style={styles.guestLinks}>
          <RowGroup>
            <ListRow icon={HelpCircle} label="Yardım" onPress={() => router.push({ pathname: '/sayfa/[slug]', params: { slug: 'yardim' } })} />
            <ListRow icon={FileText} label="Yasal bilgiler" onPress={() => router.push('/ayarlar/yasal')} />
          </RowGroup>
        </View>
      </ScrollView>
    );
  }

  const profile = me.data?.profile;
  const name = profile?.display_name || session.user.name;

  const doSignOut = async () => {
    const ok = await confirm({ title: 'Çıkış yapılsın mı?', message: 'Bu cihazdaki oturumunuz kapanacak.', confirmText: 'Çıkış yap', destructive: true });
    if (!ok) return;
    try {
      await signOut(unregisterPush);
      router.navigate('/');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
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
      <Pressable onPress={() => router.push('/ayarlar/profil')} style={[styles.profile, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Avatar name={name} uri={profile?.avatar_url} size={64} />
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
        <ChevronRight size={20} color={c.subtle} />
      </Pressable>

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

      <View style={styles.stats}>
        <Stat label="Yayında" value={profile?.active_count} onPress={() => router.push('/ilanlarim')} />
        <Stat label="Tüm ilanlar" value={profile?.listing_count} onPress={() => router.push('/ilanlarim')} />
        <Stat label="Favori" value={profile?.favorite_count} onPress={() => router.push('/favoriler')} />
      </View>

      <RowGroup title="İlanlarım">
        <ListRow icon={LayoutGrid} label="İlanlarım" value={profile ? `${profile.listing_count}` : undefined} onPress={() => router.push('/ilanlarim')} />
        <ListRow icon={Heart} label="Favorilerim" onPress={() => router.push('/favoriler')} />
        <ListRow
          icon={Bell}
          label="Bildirimler"
          right={counts?.notifications ? <View style={styles.dotWrap}><CountDot count={counts.notifications} /></View> : undefined}
          onPress={() => router.push('/bildirimler')}
        />
        <ListRow icon={Rocket} label="Doping" detail="İlanınızı öne çıkarın" onPress={() => router.push('/doping')} />
        {me.data?.store ? (
          <ListRow icon={Store} label="Mağazam" value={me.data.store.name} onPress={() => router.push('/ayarlar/magaza')} />
        ) : null}
      </RowGroup>

      <RowGroup title="Ayarlar">
        <ListRow icon={UserRound} label="Profil bilgileri" onPress={() => router.push('/ayarlar/profil')} />
        <ListRow icon={SlidersHorizontal} label="Bildirim tercihleri" onPress={() => router.push('/ayarlar/bildirimler')} />
        <ListRow icon={Shield} label="Gizlilik" detail="Telefon görünürlüğü, okundu bilgisi" onPress={() => router.push('/ayarlar/gizlilik')} />
        <ListRow icon={MessageSquareText} label="Hazır mesajlarım" onPress={() => router.push('/ayarlar/sablonlar')} />
        <ListRow icon={Ban} label="Engellenen kullanıcılar" onPress={() => router.push('/ayarlar/engellenenler')} />
        <ListRow icon={KeyRound} label="Şifre ve güvenlik" onPress={() => router.push('/ayarlar/guvenlik')} />
      </RowGroup>

      <RowGroup title="Destek">
        <ListRow icon={HelpCircle} label="Yardım merkezi" onPress={() => router.push({ pathname: '/sayfa/[slug]', params: { slug: 'yardim' } })} />
        <ListRow icon={Mail} label="Bize yazın" value={SUPPORT_EMAIL} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <ListRow icon={FileText} label="Yasal bilgiler" onPress={() => router.push('/ayarlar/yasal')} />
      </RowGroup>

      <RowGroup>
        <ListRow icon={LogOut} label="Çıkış yap" danger onPress={() => void doSignOut()} />
      </RowGroup>

      <Text variant="small" tone="subtle" center>
        GeldeSat {Constants.expoConfig?.version ?? ''}
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, onPress }: { label: string; value?: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border }]}>
      <Text variant="heading">{value == null ? '–' : formatNumber(value)}</Text>
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  guest: { padding: space.xl, gap: space.md, alignItems: 'stretch' },
  guestLogo: { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: space.md },
  guestLinks: { marginTop: space.xl },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: hairline },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: -space.md },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg, borderWidth: hairline, gap: 2 },
  dotWrap: { width: 24, height: 20 },
});
