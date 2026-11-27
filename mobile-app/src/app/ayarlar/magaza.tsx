import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { BadgeCheck, Camera, Clock, ExternalLink, FileText, MapPin, Phone, Store, Trash2, UserRound } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, storeApplications, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import { OptionPicker } from '@/features/location/OptionPicker';
import { cleanPhone, formatDate, formatPhone, maskPhoneInput } from '@/lib/format';
import { pickPhotos, type PickedPhoto } from '@/lib/photos';
import { AvatarCropper } from '@/features/photos/AvatarCropper';
import { Avatar, Badge, Button, Card, ErrorState, Header, Input, ListRow, Loading, RowGroup, SelectField, Sheet, Text, radius, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

/** Edit the account's store or submit a corporate store application. */
export default function StoreSettingsScreen() {
  return (
    <RequireSignIn title="Mağazam">
      <StoreSettings />
    </RequireSignIn>
  );
}

function StoreSettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const store = me.data?.store;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [logoSheet, setLogoSheet] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<PickedPhoto | null>(null);
  const [afterLogoSheet, setAfterLogoSheet] = useState<'camera' | 'library' | 'remove' | null>(null);

  // Corporate application state (when user has no store yet)
  const appQuery = useQuery({
    queryKey: keys.storeApplication,
    queryFn: storeApplications.mine,
    enabled: !!me.data && !store,
  });
  const [appName, setAppName] = useState('');
  const [appCity, setAppCity] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appTaxNo, setAppTaxNo] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [appCityPicker, setAppCityPicker] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const [appPrefilled, setAppPrefilled] = useState(false);

  // Fill the form when the store arrives (or after a save refreshes it).
  if (store && loadedFor !== store.id) {
    setLoadedFor(store.id);
    setName(store.name);
    setDescription(store.description ?? '');
    setCity(store.city ?? '');
    setPhone(store.phone ? maskPhoneInput(store.phone) : '');
  }

  if (!store && me.data?.profile && !appPrefilled) {
    setAppPrefilled(true);
    setAppCity(me.data.profile.city ?? '');
    setAppPhone(me.data.profile.phone ? maskPhoneInput(me.data.profile.phone) : '');
  }

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Mağazam" />
        <Loading />
      </View>
    );
  }

  if (me.isError && !me.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Mağazam" />
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </View>
    );
  }

  const changeLogo = async (source: 'camera' | 'library') => {
    try {
      const [photo] = await pickPhotos(source, 1);
      if (!photo) return;
      setPendingLogo(photo);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const confirmLogo = async (cropped: { uri: string; mimeType: string; fileName: string }) => {
    setLogoBusy(true);
    try {
      await uploads.storeLogo(cropped);
      await queryClient.invalidateQueries({ queryKey: keys.me });
      setPendingLogo(null);
      toast.success('Mağaza logosu güncellendi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      await uploads.removeStoreLogo();
      await queryClient.invalidateQueries({ queryKey: keys.me });
      toast.success('Mağaza logosu kaldırıldı');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLogoBusy(false);
    }
  };

  const submitApplication = async () => {
    if (appName.trim().length < 3) return toast.error('Mağaza adı en az 3 karakter olmalı.');
    const digits = cleanPhone(appPhone);
    if (digits && !/^05\d{9}$/.test(digits)) return toast.error('Telefon 05xx xxx xx xx biçiminde olmalı.');
    setAppBusy(true);
    try {
      await storeApplications.submit({
        name: appName.trim(),
        city: appCity || undefined,
        phone: digits || undefined,
        taxNo: appTaxNo.trim() || undefined,
        notes: appNotes.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: keys.storeApplication });
      toast.success('Mağaza başvurunuz alındı');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAppBusy(false);
    }
  };

  if (!store) {
    const application = appQuery.data;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Kurumsal mağaza" />
        {appQuery.isLoading ? (
          <Loading />
        ) : appQuery.isError && !appQuery.data ? (
          <ErrorState error={appQuery.error} onRetry={() => void appQuery.refetch()} />
        ) : application && application.status === 'PENDING' ? (
          <KeyboardAwareScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
            <Card style={styles.statusCard}>
              <View style={styles.statusHead}>
                <View style={[styles.statusIcon, { backgroundColor: c.warnSoft }]}>
                  <Clock size={22} color={c.warn} />
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading">Başvurunuz inceleniyor</Text>
                  <Badge label="Onay bekliyor" tone="warn" style={styles.statusBadge} />
                </View>
              </View>
              <Text variant="caption" tone="muted">
                Başvurunuz ekibimiz tarafından incelendikten sonra mağazanız aktif edilecektir.
              </Text>
              <View style={[styles.appDetails, { borderTopColor: c.border }]}>
                <DetailLine label="Mağaza adı" value={application.name} />
                {application.city ? <DetailLine label="Şehir" value={application.city} /> : null}
                {application.phone ? <DetailLine label="Telefon" value={formatPhone(application.phone)} /> : null}
                {application.tax_no ? <DetailLine label="Vergi no" value={application.tax_no} /> : null}
                {application.notes ? <DetailLine label="Not" value={application.notes} /> : null}
                <DetailLine label="Başvuru tarihi" value={formatDate(application.created_at)} />
              </View>
            </Card>
          </KeyboardAwareScrollView>
        ) : application && application.status === 'APPROVED' ? (
          <KeyboardAwareScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
            <Card style={styles.statusCard}>
              <View style={styles.statusHead}>
                <View style={[styles.statusIcon, { backgroundColor: c.okSoft }]}>
                  <BadgeCheck size={22} color={c.ok} />
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading">Başvurunuz onaylandı</Text>
                  <Badge label="Onaylandı" tone="ok" style={styles.statusBadge} />
                </View>
              </View>
              <Text variant="caption" tone="muted">
                Mağazanız aktif edildi. Mağaza ayarlarınızı görmek için sayfayı yenileyin.
              </Text>
              <Button
                title="Sayfayı yenile"
                variant="outline"
                onPress={() => void queryClient.invalidateQueries({ queryKey: keys.me })}
              />
            </Card>
          </KeyboardAwareScrollView>
        ) : (
          <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
            {application && application.status === 'REJECTED' ? (
              <Card style={[styles.rejectCard, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
                <Badge label="Önceki başvuru reddedildi" tone="danger" />
                {application.review_note ? (
                  <Text variant="caption" tone="danger">
                    {application.review_note}
                  </Text>
                ) : (
                  <Text variant="caption" tone="danger">
                    Bilgilerinizi güncelleyerek yeniden başvurabilirsiniz.
                  </Text>
                )}
              </Card>
            ) : (
              <Card style={[styles.introCard, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
                <Text variant="bodyStrong" tone="primary">
                  Kurumsal mağaza başvurusu
                </Text>
                <Text variant="caption" tone="muted">
                  Galeri, emlak ofisi veya işletme olarak satış yapıyorsanız ilanlarınızı kendi mağaza sayfanızda toplayabilirsiniz.
                </Text>
              </Card>
            )}
            <Input
              label="Mağaza / İşletme adı"
              required
              icon={Store}
              placeholder="Örn. Yıldız Oto Galeri"
              value={appName}
              onChangeText={setAppName}
              maxLength={60}
            />
            <SelectField label="Şehir" icon={MapPin} placeholder="Seçin" value={appCity} onPress={() => setAppCityPicker(true)} />
            <Input
              label="Telefon"
              icon={Phone}
              keyboardType="phone-pad"
              placeholder="05xx xxx xx xx"
              value={appPhone}
              onChangeText={(t) => setAppPhone(maskPhoneInput(t))}
            />
            <Input
              label="Vergi numarası"
              icon={FileText}
              placeholder="İsteğe bağlı"
              keyboardType="number-pad"
              value={appTaxNo}
              onChangeText={setAppTaxNo}
              maxLength={30}
            />
            <Input
              label="Başvuru notu"
              multiline
              placeholder="Faaliyet alanınız, ilan sayınız vb. (isteğe bağlı)"
              value={appNotes}
              onChangeText={setAppNotes}
              maxLength={1000}
              hint={`${appNotes.length}/1000`}
            />
            <Button title="Başvuru gönder" size="lg" loading={appBusy} onPress={() => void submitApplication()} />
          </KeyboardAwareScrollView>
        )}
        <OptionPicker visible={appCityPicker} onClose={() => setAppCityPicker(false)} title="Şehir" value={appCity} onSelect={(v) => setAppCity(v ?? '')} />
      </View>
    );
  }

  const save = async () => {
    if (name.trim().length < 3) return toast.error('Mağaza adı en az 3 karakter olmalı.');
    const digits = cleanPhone(phone);
    if (digits && !/^0\d{10}$/.test(digits)) return toast.error('Telefon numarası 0 ile başlayan 11 hane olmalı.');
    setBusy(true);
    try {
      await account.updateStore({ name: name.trim(), description: description.trim() || undefined, city: city || undefined, phone: digits || undefined });
      await queryClient.invalidateQueries({ queryKey: keys.me });
      toast.success('Mağaza bilgileri kaydedildi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Mağazam" subtitle={store.plan} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <Pressable
          onPress={() => setLogoSheet(true)}
          style={styles.logoWrap}
          accessibilityRole="button"
          accessibilityLabel="Mağaza logosunu değiştir"
        >
          <Avatar name={name || store.name} uri={store.logo_url} size={88} />
          <View style={[styles.camera, { backgroundColor: c.primarySolid, borderColor: c.bg }]}>
            {logoBusy ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={16} color="#fff" />}
          </View>
        </Pressable>
        <Input label="Mağaza adı" required icon={Store} value={name} onChangeText={setName} maxLength={60} />
        <SelectField label="Şehir" icon={MapPin} placeholder="Seçin" value={city} onPress={() => setPicker(true)} />
        <Input label="Telefon" icon={Phone} keyboardType="phone-pad" value={phone} onChangeText={(t) => setPhone(maskPhoneInput(t))} />
        <Input label="Açıklama" multiline value={description} onChangeText={setDescription} maxLength={400} hint={`${description.length}/400`} />
        <Button title="Kaydet" size="lg" loading={busy} onPress={() => void save()} />
        <Button
          title="Mağaza sayfasını gör"
          icon={ExternalLink}
          variant="outline"
          onPress={() => router.push({ pathname: '/magaza/[slug]', params: { slug: store.slug } })}
        />
      </KeyboardAwareScrollView>
      <OptionPicker visible={picker} onClose={() => setPicker(false)} title="Şehir" value={city} onSelect={(v) => setCity(v ?? '')} />
      <Sheet
        visible={logoSheet}
        onClose={() => setLogoSheet(false)}
        title="Mağaza logosu"
        onDismissed={() => {
          const next = afterLogoSheet;
          setAfterLogoSheet(null);
          if (next === 'remove') void removeLogo();
          else if (next) void changeLogo(next);
        }}
      >
        <RowGroup>
          <ListRow
            icon={Camera}
            label="Fotoğraf çek"
            onPress={() => {
              setAfterLogoSheet('camera');
              setLogoSheet(false);
            }}
          />
          <ListRow
            icon={UserRound}
            label="Galeriden seç"
            onPress={() => {
              setAfterLogoSheet('library');
              setLogoSheet(false);
            }}
          />
          {store.logo_url ? (
            <ListRow
              icon={Trash2}
              label="Logoyu kaldır"
              danger
              onPress={() => {
                setAfterLogoSheet('remove');
                setLogoSheet(false);
              }}
            />
          ) : null}
        </RowGroup>
        <Text variant="caption" tone="subtle" center>
          Seçtikten sonra kırpıp yakınlaştırabilirsiniz.
        </Text>
      </Sheet>
      <AvatarCropper
        photo={pendingLogo}
        shape="rounded"
        title="Mağaza logosu"
        busy={logoBusy}
        onCancel={() => setPendingLogo(null)}
        onConfirm={confirmLogo}
      />
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" tone="muted" style={styles.detailLabel}>
        {label}
      </Text>
      <Text variant="caption" style={styles.flex}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  logoWrap: { alignSelf: 'center', marginVertical: space.sm },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  statusCard: { gap: space.md },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { marginTop: 4 },
  appDetails: { paddingTop: space.md, borderTopWidth: 1, gap: space.sm },
  detailRow: { flexDirection: 'row', gap: space.sm },
  detailLabel: { width: 100 },
  introCard: { gap: space.xs, borderRadius: radius.lg },
  rejectCard: { gap: space.sm, borderWidth: 1 },
});
