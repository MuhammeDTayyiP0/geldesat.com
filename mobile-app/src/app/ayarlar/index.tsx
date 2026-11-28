import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import {
  BellRing,
  Database,
  FileText,
  HelpCircle,
  KeyRound,
  LogOut,
  Mail,
  MessageSquarePlus,
  MessageSquareText,
  Monitor,
  Moon,
  Search,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sun,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { signOut } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { SUPPORT_EMAIL } from '@/lib/config';
import { runningVersionLabel } from '@/lib/ota';
import { setThemePref, useThemePref, type ThemePref } from '@/lib/themePref';
import { Button, Header, ListRow, RowGroup, Text, confirm, font, hairline, radius, space, toast, useTheme } from '@/ui';

type Item = { label: string; detail?: string; icon: LucideIcon; to?: Href; onPress?: () => void; value?: string; auth?: boolean };

const THEME_OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Cihaz ayarı', icon: Monitor },
  { value: 'light', label: 'Açık', icon: Sun },
  { value: 'dark', label: 'Koyu', icon: Moon },
];

/** Settings list, grouped like a phone's settings app; each row opens its own screen. */
export default function SettingsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const theme = useThemePref();
  const [q, setQ] = useState('');
  const signedIn = session.status === 'signedIn';
  const { isUpdatePending } = Updates.useUpdates();
  const versionLabel = `GeldeSat ${runningVersionLabel(Constants.expoConfig?.version ?? '')}`;

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Hesap',
      items: [
        { label: 'Profil bilgileri', detail: 'Fotoğraf, ad, telefon, konum, biyografi', icon: UserRound, to: '/ayarlar/profil', auth: true },
        { label: 'Hesap ve güvenlik', detail: 'E-posta, şifre, oturumlar, veri indir, hesabı sil', icon: KeyRound, to: '/ayarlar/guvenlik', auth: true },
      ],
    },
    {
      title: 'Tercihler',
      items: [
        { label: 'Alışveriş ve satıcı', detail: 'Varsayılan şehir, sıralama, teklif ve aranabilir saatler', icon: SlidersHorizontal, to: '/ayarlar/tercihler' as Href, auth: true },
        { label: 'Bildirimler', detail: 'Mesaj, favori, ilan durumu ve sessiz saatler', icon: BellRing, to: '/ayarlar/bildirimler', auth: true },
        { label: 'Hazır mesajlarım', detail: 'Sohbette tek dokunuşla gönderin', icon: MessageSquareText, to: '/ayarlar/sablonlar', auth: true },
        { label: 'Veri ve depolama', detail: 'Geçmişi temizle, fotoğraf kalitesi ve önbellek', icon: Database, to: '/ayarlar/depolama' as Href, auth: true },
      ],
    },
    {
      title: 'Gizlilik',
      items: [
        { label: 'Gizlilik ve engellenenler', detail: 'Telefon görünürlüğü, okundu bilgisi, engellenenler', icon: Shield, to: '/ayarlar/gizlilik', auth: true },
      ],
    },
    {
      title: 'Destek',
      items: [
        { label: 'Geri bildirim / Sorun bildir', detail: 'Hata bildir veya öneri paylaş', icon: MessageSquarePlus, to: '/ayarlar/geri-bildirim' as Href, auth: true },
        { label: 'Yardım merkezi', detail: 'Sık sorulanlar ve iletişim', icon: HelpCircle, to: { pathname: '/sayfa/[slug]', params: { slug: 'iletisim' } } },
        { label: 'Bize yazın', icon: Mail, value: SUPPORT_EMAIL, onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
        { label: 'Yasal bilgiler', detail: 'Sözleşmeler ve politikalar', icon: FileText, to: '/ayarlar/yasal' },
        {
          label: 'Uygulama sürümü',
          detail: isUpdatePending ? 'Yeni sürüm hazır, yeniden başlatın' : 'Güncellemeler',
          icon: Smartphone,
          to: '/ayarlar/guncelleme' as Href,
          value: runningVersionLabel(Constants.expoConfig?.version ?? ''),
        },
      ],
    },
  ];

  const term = q.trim().toLocaleLowerCase('tr');
  const showTheme = !term || 'görünüm tema açık koyu karanlık cihaz ayarı mod'.includes(term);
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
      await signOut();
      router.navigate('/');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Ayarlar" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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

        {showTheme ? (
          <View style={styles.themeSection}>
            <Text variant="caption" tone="muted" style={styles.themeLabel}>
              GÖRÜNÜM
            </Text>
            <View accessibilityRole="radiogroup" style={[styles.themeGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
              {THEME_OPTIONS.map((o) => {
                const selected = theme === o.value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setThemePref(o.value);
                    }}
                    style={[styles.themeBtn, selected && { backgroundColor: c.primarySolid }]}
                  >
                    <o.icon size={16} color={selected ? c.onPrimary : c.muted} />
                    <Text variant="label" style={{ color: selected ? c.onPrimary : c.muted }} numberOfLines={1}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
        {term && !visible.length && !showTheme ? (
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
            <>
              <Button title="Giriş yap" onPress={() => router.push('/giris')} />
              <Button title="Üye ol" variant="outline" onPress={() => router.push({ pathname: '/giris', params: { mode: 'signup' } })} />
            </>
          )
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel={`${versionLabel}, sürüm ayrıntıları`} onPress={() => router.push('/ayarlar/guncelleme' as Href)} hitSlop={8}>
          <Text variant="small" tone="subtle" center>
            {versionLabel}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 42 },
  themeSection: { gap: space.xs },
  themeLabel: { paddingHorizontal: space.xs, letterSpacing: 0.6, fontWeight: '600' },
  themeGroup: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.lg, borderWidth: hairline },
  themeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.sm + 2, paddingHorizontal: space.sm, borderRadius: radius.md },
});
