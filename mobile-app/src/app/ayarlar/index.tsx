import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import {
  Ban,
  BellRing,
  ChevronRight,
  FileText,
  HelpCircle,
  KeyRound,
  LogOut,
  Mail,
  MessageSquareText,
  Palette,
  Search,
  Shield,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { useMe } from '@/api/queries';
import { signOut } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { SUPPORT_EMAIL } from '@/lib/config';
import { runningVersionLabel } from '@/lib/ota';
import { unregisterPush } from '@/lib/push';
import { useThemePref } from '@/lib/themePref';
import { Avatar, Button, Header, ListRow, RowGroup, Text, confirm, font, hairline, radius, space, toast, useTheme } from '@/ui';

type Item = { label: string; detail?: string; icon: LucideIcon; to?: Href; onPress?: () => void; value?: string; auth?: boolean };

const THEME_LABEL = { system: 'Cihaz ayarı', light: 'Açık', dark: 'Koyu' } as const;

/** Settings list, grouped like a phone's settings app; each row opens its own screen. */
export default function SettingsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const me = useMe();
  const theme = useThemePref();
  const [q, setQ] = useState('');
  const signedIn = session.status === 'signedIn';

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Hesap',
      items: [
        { label: 'Profil bilgileri', detail: 'Fotoğraf, ad, telefon, konum', icon: UserRound, to: '/ayarlar/profil', auth: true },
        { label: 'Şifre ve güvenlik', detail: 'Şifre, doğrulama, hesabı silme', icon: KeyRound, to: '/ayarlar/guvenlik', auth: true },
      ],
    },
    {
      title: 'Tercihler',
      items: [
        { label: 'Görünüm', detail: 'Açık, koyu veya cihaz ayarı', icon: Palette, to: '/ayarlar/gorunum' as Href, value: THEME_LABEL[theme] },
        { label: 'Bildirimler', detail: 'Mesaj, favori, ilan durumu', icon: BellRing, to: '/ayarlar/bildirimler', auth: true },
        { label: 'Gizlilik', detail: 'Telefon görünürlüğü, okundu bilgisi', icon: Shield, to: '/ayarlar/gizlilik', auth: true },
        { label: 'Hazır mesajlarım', detail: 'Sohbette tek dokunuşla gönderin', icon: MessageSquareText, to: '/ayarlar/sablonlar', auth: true },
        { label: 'Engellenen kullanıcılar', icon: Ban, to: '/ayarlar/engellenenler', auth: true },
      ],
    },
    {
      title: 'İşletme',
      items: [
        {
          label: me.data?.store ? 'Mağazam' : 'Kurumsal mağaza',
          detail: me.data?.store ? me.data.store.name : 'Mağaza başvurusu',
          icon: Store,
          to: '/ayarlar/magaza',
          auth: true,
        },
      ],
    },
    {
      title: 'Destek',
      items: [
        { label: 'Yardım merkezi', icon: HelpCircle, to: { pathname: '/sayfa/[slug]', params: { slug: 'yardim' } } },
        { label: 'Bize yazın', icon: Mail, value: SUPPORT_EMAIL, onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
        { label: 'Yasal bilgiler', detail: 'Sözleşmeler ve politikalar', icon: FileText, to: '/ayarlar/yasal' },
      ],
    },
  ];

  const term = q.trim().toLocaleLowerCase('tr');
  const visible = sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => (signedIn || !i.auth) && (!term || `${i.label} ${i.detail ?? ''}`.toLocaleLowerCase('tr').includes(term)),
      ),
    }))
    .filter((s) => s.items.length);

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

  const name = me.data?.profile?.display_name || (signedIn ? session.user.name : '');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Ayarlar" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.search, { backgroundColor: c.elevated }]}>
          <Search size={18} color={c.subtle} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Ayarlarda ara"
            placeholderTextColor={c.subtle}
            style={[styles.input, { color: c.fg }]}
            accessibilityLabel="Ayarlarda ara"
          />
        </View>

        {signedIn && !term ? (
          <Pressable
            onPress={() => router.push('/ayarlar/profil')}
            style={({ pressed }) => [styles.profile, { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border }]}
          >
            <Avatar name={name} uri={me.data?.profile?.avatar_url} size={52} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {session.user.email}
              </Text>
            </View>
            <ChevronRight size={18} color={c.subtle} />
          </Pressable>
        ) : null}

        {visible.map((s) => (
          <RowGroup key={s.title} title={s.title}>
            {s.items.map((i) => (
              <ListRow
                key={i.label}
                icon={i.icon}
                label={i.label}
                detail={i.detail}
                value={i.value}
                onPress={i.onPress ?? (i.to ? () => router.push(i.to as Href) : undefined)}
              />
            ))}
          </RowGroup>
        ))}
        {term && !visible.length ? (
          <Text tone="muted" center>
            “{q.trim()}” ile eşleşen ayar yok.
          </Text>
        ) : null}

        {!term ? (
          signedIn ? (
            <RowGroup>
              <ListRow icon={LogOut} label="Çıkış yap" danger onPress={() => void doSignOut()} />
            </RowGroup>
          ) : (
            <Button title="Giriş yap / Üye ol" onPress={() => router.push('/giris')} />
          )
        ) : null}

        <Text variant="small" tone="subtle" center>
          GeldeSat {runningVersionLabel(Constants.expoConfig?.version ?? '')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 42 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: hairline },
});
