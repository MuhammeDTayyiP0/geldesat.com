import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Check, CheckCheck, MessageCircle } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AccountSettings, BlockedUser, PhoneVisibility } from '@/api/types';
import { formatDate } from '@/lib/format';
import { Avatar, Button, ErrorState, Header, ListRow, Loading, RowGroup, Text, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const PHONE_OPTIONS: { value: PhoneVisibility; label: string; detail: string }[] = [
  { value: 'everyone', label: 'Herkes', detail: 'Giriş yapmamış ziyaretçiler dahil' },
  { value: 'members', label: 'Yalnızca üyeler', detail: 'Giriş yapmış GeldeSat üyeleri' },
  { value: 'hidden', label: 'Kimse', detail: 'Alıcılar size yalnızca mesajla ulaşır' },
];

export default function PrivacySettingsScreen() {
  return (
    <RequireSignIn title="Gizlilik ve engellenenler">
      <PrivacySettings />
    </RequireSignIn>
  );
}

function PrivacySettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const settings = useQuery({ queryKey: keys.settings, queryFn: account.settings });
  const blocked = useQuery({ queryKey: keys.blocked, queryFn: account.blocked });
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
  const unblock = useMutation({
    mutationFn: (userId: string) => account.unblock(userId),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<BlockedUser[]>(keys.blocked, (list) => list?.filter((u) => u.id !== userId));
      toast.success('Engel kaldırıldı');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = settings.data;
  const update = (patch: Partial<Pick<AccountSettings, 'phone_visibility' | 'show_whatsapp' | 'read_receipts'>>) => {
    if (!s) return;
    save.mutate({ phone_visibility: s.phone_visibility, show_whatsapp: s.show_whatsapp, read_receipts: s.read_receipts, ...patch });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Gizlilik ve engellenenler" />
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
          <RowGroup title="Engellenen kullanıcılar">
            {blocked.isLoading ? (
              <ListRow icon={Ban} label="Yükleniyor…" />
            ) : blocked.isError && !blocked.data ? (
              <ListRow icon={Ban} label="Engellenenler yüklenemedi" detail="Tekrar denemek için dokunun" onPress={() => void blocked.refetch()} />
            ) : !blocked.data?.length ? (
              <ListRow icon={Ban} label="Engellediğiniz kimse yok" detail="Engellediğiniz kişiler size mesaj gönderemez." />
            ) : (
              blocked.data.map((u) => (
                <View key={u.id} style={[styles.blockedRow, { backgroundColor: c.surface }]}>
                  <Avatar name={u.name} uri={u.avatar} size={40} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {u.name}
                    </Text>
                    <Text variant="caption" tone="subtle">
                      {formatDate(u.since)} tarihinde engellendi
                    </Text>
                  </View>
                  <Button
                    title="Kaldır"
                    size="sm"
                    variant="outline"
                    loading={unblock.isPending && unblock.variables === u.id}
                    onPress={() => unblock.mutate(u.id)}
                  />
                </View>
              ))
            )}
          </RowGroup>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  spacer: { width: 18 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
