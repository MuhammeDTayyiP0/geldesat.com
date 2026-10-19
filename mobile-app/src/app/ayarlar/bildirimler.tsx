import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing, Mail } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AccountSettings, NotifyPrefs, NotifyType } from '@/api/types';
import { pushPermissionGranted, registerForPush } from '@/lib/push';
import { Button, Card, ErrorState, Header, ListRow, Loading, RowGroup, Text, space, toast, useTheme } from '@/ui';

const TYPES: { type: NotifyType; label: string; hint: string; inappLocked?: boolean }[] = [
  { type: 'message', label: 'Yeni mesajlar', hint: 'Biri ilanınız hakkında yazdığında' },
  { type: 'favorite', label: 'Favoriler', hint: 'İlanınız favorilere eklendiğinde' },
  { type: 'listing', label: 'İlan durumu', hint: 'Onay, ret ve tekrar inceleme', inappLocked: true },
  { type: 'expiry', label: 'Süre hatırlatması', hint: 'İlanınızın süresi dolmak üzereyken' },
];

export default function NotificationSettings() {
  const { c } = useTheme();
  const settings = useQuery({ queryKey: keys.settings, queryFn: account.settings });
  const [edited, setPrefs] = useState<NotifyPrefs | null>(null);
  const prefs = edited ?? settings.data?.notify_prefs ?? null;
  const [systemOn, setSystemOn] = useState(true);

  useEffect(() => {
    void pushPermissionGranted().then(setSystemOn);
  }, []);

  const savePrefs = useMutation({
    mutationFn: account.updateNotifyPrefs,
    onSuccess: (r) => {
      setPrefs(r.prefs);
      queryClient.setQueryData<AccountSettings>(keys.settings, (d) => (d ? { ...d, notify_prefs: r.prefs } : d));
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setPrefs(null);
    },
  });
  const saveEmail = useMutation({
    mutationFn: account.updateMessageEmail,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.settings }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggle = (type: NotifyType, channel: 'inapp' | 'push', value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [type]: { ...prefs[type], [channel]: value } };
    setPrefs(next);
    savePrefs.mutate(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Bildirim tercihleri" />
      {settings.isLoading || !prefs ? (
        settings.isError ? (
          <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <Loading />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {!systemOn ? (
            <Card style={[styles.warn, { backgroundColor: c.warnSoft, borderColor: c.warnSoft }]}>
              <View style={styles.row}>
                <BellRing size={18} color={c.warn} />
                <Text variant="label" tone="warn" style={styles.flex}>
                  Telefon bildirimleri kapalı
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                Anlık bildirim alabilmek için GeldeSat’a bildirim izni verin.
              </Text>
              <Button
                title="İzin ver"
                size="sm"
                variant="outline"
                onPress={async () => {
                  await registerForPush().catch(() => undefined);
                  const granted = await pushPermissionGranted();
                  setSystemOn(granted);
                  if (!granted) void Linking.openSettings();
                }}
              />
            </Card>
          ) : null}

          {TYPES.map((t) => (
            <RowGroup key={t.type} title={t.label}>
              <ListRow label="Telefon bildirimi" detail={t.hint} switchValue={prefs[t.type].push} onSwitch={(v) => toggle(t.type, 'push', v)} />
              <ListRow
                label="Uygulama içi"
                detail={t.inappLocked ? 'Bu bildirim kapatılamaz' : undefined}
                switchValue={prefs[t.type].inapp}
                disabled={t.inappLocked}
                onSwitch={(v) => toggle(t.type, 'inapp', v)}
              />
            </RowGroup>
          ))}

          <RowGroup title="E-posta">
            <ListRow
              icon={Mail}
              label="Okunmamış mesaj özeti"
              detail={
                settings.data?.email_ready
                  ? 'Okumadığınız mesajlar için e-posta alın'
                  : settings.data?.email_configured
                    ? 'E-posta adresinizi doğruladığınızda gönderilir'
                    : 'E-posta gönderimi şu an kapalı'
              }
              switchValue={settings.data?.message_email}
              disabled={!settings.data?.email_configured}
              onSwitch={(v) => saveEmail.mutate(v)}
            />
          </RowGroup>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  warn: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
