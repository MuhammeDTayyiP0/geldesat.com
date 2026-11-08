import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing, Mail } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AccountSettings, NotifyPrefs, NotifyType } from '@/api/types';
import { canAskForPush, pushPermissionGranted, registerForPush } from '@/lib/push';
import { Button, Card, ErrorState, Header, ListRow, Loading, RowGroup, Text, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const TYPES: { type: NotifyType; label: string; hint: string; inappLocked?: boolean }[] = [
  { type: 'message', label: 'Yeni mesajlar', hint: 'Biri ilanınız hakkında yazdığında' },
  { type: 'favorite', label: 'Favoriler', hint: 'İlanınız favorilere eklendiğinde' },
  { type: 'listing', label: 'İlan durumu', hint: 'Onay, ret ve tekrar inceleme', inappLocked: true },
  { type: 'expiry', label: 'Süre hatırlatması', hint: 'İlanınızın süresi dolmak üzereyken' },
];

export default function NotificationSettingsScreen() {
  return (
    <RequireSignIn title="Bildirim tercihleri">
      <NotificationSettings />
    </RequireSignIn>
  );
}

function NotificationSettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const settings = useQuery({ queryKey: keys.settings, queryFn: account.settings });
  const [edited, setPrefs] = useState<NotifyPrefs | null>(null);
  const prefs = edited ?? settings.data?.notify_prefs ?? null;
  const [systemOn, setSystemOn] = useState(true);

  useEffect(() => {
    void pushPermissionGranted().then(setSystemOn);
  }, []);

  // Quick taps send several saves; only the newest one's answer is applied, so an older
  // answer arriving last cannot undo a later choice.
  const saveSeq = useRef(0);
  const savePrefs = useMutation({
    mutationFn: ({ next }: { next: NotifyPrefs; seq: number }) => account.updateNotifyPrefs(next),
    onSuccess: (r, { seq }) => {
      if (seq !== saveSeq.current) return;
      setPrefs(r.prefs);
      queryClient.setQueryData<AccountSettings>(keys.settings, (d) => (d ? { ...d, notify_prefs: r.prefs } : d));
    },
    onError: (e, { seq }) => {
      if (seq !== saveSeq.current) return;
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
    savePrefs.mutate({ next, seq: ++saveSeq.current });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Bildirim tercihleri" />
      {settings.isLoading || !prefs ? (
        settings.isError && !settings.data ? (
          <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <Loading />
        )
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
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
                  // The phone's own question while it may still be asked; the settings only when it may not.
                  if (!(await canAskForPush())) {
                    void Linking.openSettings();
                    return;
                  }
                  await registerForPush().catch(() => undefined);
                  setSystemOn(await pushPermissionGranted());
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
