import { ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, Download, MessageCircle } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AccountSettings, PhoneVisibility } from '@/api/types';
import { webUrl } from '@/lib/config';
import { ErrorState, Header, ListRow, Loading, RowGroup, Text, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const PHONE_OPTIONS: { value: PhoneVisibility; label: string; detail: string }[] = [
  { value: 'everyone', label: 'Herkes', detail: 'Giriş yapmamış ziyaretçiler dahil' },
  { value: 'members', label: 'Yalnızca üyeler', detail: 'Giriş yapmış GeldeSat üyeleri' },
  { value: 'hidden', label: 'Kimse', detail: 'Alıcılar size yalnızca mesajla ulaşır' },
];

export default function PrivacySettingsScreen() {
  return (
    <RequireSignIn title="Gizlilik">
      <PrivacySettings />
    </RequireSignIn>
  );
}

function PrivacySettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const settings = useQuery({ queryKey: keys.settings, queryFn: account.settings });
  const save = useMutation({
    mutationFn: account.updatePrivacy,
    onMutate: (next) => {
      const previous = queryClient.getQueryData<AccountSettings>(keys.settings);
      queryClient.setQueryData<AccountSettings>(keys.settings, (d) => (d ? { ...d, ...next } : d));
      return { previous };
    },
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.settings, ctx?.previous);
      toast.error(errorMessage(e));
    },
  });
  const s = settings.data;
  const update = (patch: Partial<Pick<AccountSettings, 'phone_visibility' | 'show_whatsapp' | 'read_receipts'>>) => {
    if (!s) return;
    save.mutate({ phone_visibility: s.phone_visibility, show_whatsapp: s.show_whatsapp, read_receipts: s.read_receipts, ...patch });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Gizlilik" />
      {!s ? (
        settings.isError && !settings.data ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : <Loading />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
          <RowGroup title="Telefon numaramı kimler görebilir?">
            {PHONE_OPTIONS.map((o) => (
              <ListRow
                key={o.value}
                label={o.label}
                detail={o.detail}
                onPress={() => update({ phone_visibility: o.value })}
                checked={s.phone_visibility === o.value}
                right={s.phone_visibility === o.value ? <Check size={18} color={c.primary} /> : <View style={styles.spacer} />}
              />
            ))}
          </RowGroup>
          <RowGroup title="Mesajlaşma">
            <ListRow
              icon={MessageCircle}
              label="WhatsApp ile iletişim"
              detail={
                s.phone_visibility === 'hidden'
                  ? 'Numaranız gizliyken WhatsApp düğmesi de gösterilmez'
                  : 'İlanlarınızda WhatsApp düğmesi gösterilir'
              }
              switchValue={s.show_whatsapp && s.phone_visibility !== 'hidden'}
              disabled={s.phone_visibility === 'hidden'}
              onSwitch={(v) => update({ show_whatsapp: v })}
            />
            <ListRow
              icon={CheckCheck}
              label="Okundu bilgisi"
              detail="Kapatırsanız siz de karşı tarafın okuduğunu göremezsiniz"
              switchValue={s.read_receipts}
              onSwitch={(v) => update({ read_receipts: v })}
            />
          </RowGroup>
          <RowGroup title="Verilerim">
            <ListRow
              icon={Download}
              label="Verilerimi indir"
              detail="KVKK kapsamında verilerinizin kopyası. Sitede Ayarlar → Hesap sayfası açılır; orada giriş yapmanız gerekebilir."
              onPress={() => void WebBrowser.openBrowserAsync(webUrl('/ayarlar/hesap'))}
            />
          </RowGroup>
          <Text variant="caption" tone="subtle">
            Kişisel verileriniz KVKK Aydınlatma Metni’nde açıklandığı şekilde işlenir.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  spacer: { width: 18 },
});
