import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { CalendarClock, CircleAlert, CircleCheck, Clock3, Download, FileText, Package, Radio, RefreshCw, RotateCw, Smartphone } from 'lucide-react-native';
import { checkNow, updateMessage } from '@/lib/ota';
import { Button, Header, ListRow, RowGroup, Text, hairline, radius, space, toast, useTheme } from '@/ui';

function when(d: Date | undefined) {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/**
 * Which code this phone runs and whether newer code is waiting, so "is the
 * update on my phone yet?" has an answer. New code is downloaded at launch and
 * runs from the next launch; the restart button applies it right away.
 */
export default function UpdateScreen() {
  const { c } = useTheme();
  const u = Updates.useUpdates();
  const [checking, setChecking] = useState(false);
  const running = u.currentlyRunning;
  const enabled = Updates.isEnabled && !__DEV__;
  const fromUpdate = !running.isEmbeddedLaunch && Boolean(running.updateId);
  const note = fromUpdate ? updateMessage(running.manifest) : null;
  const pendingNote = u.downloadedUpdate?.manifest ? updateMessage(u.downloadedUpdate.manifest) : null;
  const busy = checking || u.isChecking || u.isDownloading;

  const check = async () => {
    setChecking(true);
    try {
      if (!(await checkNow())) toast.success('Uygulamanız güncel');
    } catch {
      toast.error('Güncelleme sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    } finally {
      setChecking(false);
    }
  };

  const status = !enabled
    ? { icon: CircleAlert, color: c.warn, title: 'Güncellemeler kapalı', text: 'Bu geliştirme sürümü güncelleme almaz.' }
    : u.isUpdatePending
      ? {
          icon: Download,
          color: c.primary,
          title: 'Yeni sürüm indirildi',
          text: pendingNote
            ? `“${pendingNote}”. Uygulama yeniden başlayınca kullanılır.`
            : 'Uygulama yeniden başlayınca kullanılır.',
        }
      : busy
        ? { icon: RefreshCw, color: c.muted, title: u.isDownloading ? 'İndiriliyor…' : 'Kontrol ediliyor…', text: 'Bir saniye.' }
        : { icon: CircleCheck, color: c.ok, title: 'Kullandığınız sürüm', text: 'Yeni bir sürüm çıkınca uygulama açılırken indirilir, sonraki açılışta kullanılır.' };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Uygulama sürümü" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.status, { backgroundColor: c.surface, borderColor: c.border }]}>
          <status.icon size={26} color={status.color} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{status.title}</Text>
            <Text variant="caption" tone="muted">
              {status.text}
            </Text>
          </View>
        </View>

        {enabled ? (
          u.isUpdatePending ? (
            <Button title="Şimdi yeniden başlat" icon={RotateCw} onPress={() => void Updates.reloadAsync().catch(() => toast.error('Yeniden başlatılamadı. Uygulamayı kapatıp açın.'))} />
          ) : (
            <Button title="Güncellemeleri denetle" variant="outline" icon={RefreshCw} loading={busy} onPress={() => void check()} />
          )
        ) : null}

        <RowGroup title="Bu cihazda çalışan">
          <ListRow icon={Smartphone} label="Uygulama sürümü" value={Constants.expoConfig?.version ?? '—'} />
          <ListRow icon={Package} label="Kod" value={fromUpdate ? `Güncelleme ${running.updateId?.slice(0, 8)}` : 'Uygulamayla gelen'} />
          {fromUpdate ? <ListRow icon={CalendarClock} label="Yayın tarihi" value={when(running.createdAt)} /> : null}
          {note ? <ListRow icon={FileText} label="Güncelleme notu" detail={note} /> : null}
          <ListRow icon={Radio} label="Kanal" value={running.channel || 'production'} />
          <ListRow icon={Clock3} label="Son kontrol" value={u.lastCheckForUpdateTimeSinceRestart ? when(u.lastCheckForUpdateTimeSinceRestart) : 'Bu açılışta yok'} />
        </RowGroup>

        {running.isEmergencyLaunch ? (
          <Text variant="caption" tone="danger">
            Son güncelleme açılamadı, uygulamayla gelen kod kullanılıyor.
          </Text>
        ) : null}
        <Text variant="caption" tone="subtle" selectable>
          Destek için kimlik: {running.updateId ?? 'yerleşik'} · {running.runtimeVersion ?? Updates.runtimeVersion ?? '—'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: hairline },
});
