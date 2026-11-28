import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { BadgeCheck, Briefcase, Building2, Camera, Clock, ExternalLink, FileText, MapPin, Phone, Store, Trash2, UserRound } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, storeApplications, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import type { BusinessType } from '@/api/types';
import { OptionPicker } from '@/features/location/OptionPicker';
import { cleanPhone, formatDate, formatPhone, maskPhoneInput } from '@/lib/format';
import { pickPhotos, type PickedPhoto } from '@/lib/photos';
import { AvatarCropper } from '@/features/photos/AvatarCropper';
import { Avatar, Badge, Button, Card, ErrorState, Header, Input, ListRow, Loading, RowGroup, SelectField, Sheet, Text, radius, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'SOLE', label: 'Şahıs Şirketi' },
  { value: 'COMPANY', label: 'Limited / A.Ş.' },
];

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  SOLE: 'Şahıs Şirketi',
  COMPANY: 'Limited / A.Ş.',
};

const STORE_SECTORS = [
  'Otomotiv / Galeri',
  'Emlak Ofisi',
  'Elektronik & Teknoloji',
  'Ev, Bahçe & Mobilya',
  'Giyim & Aksesuar',
  'İş Makineleri & Sanayi',
  'Hizmet & Ticaret',
  'Diğer',
];

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
  const [appBusinessType, setAppBusinessType] = useState<BusinessType>('SOLE');
  const [appSector, setAppSector] = useState('');
  const [appTaxOffice, setAppTaxOffice] = useState('');
  const [appCity, setAppCity] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appTaxNo, setAppTaxNo] = useState('');
  const [appAddress, setAppAddress] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [appCityPicker, setAppCityPicker] = useState(false);
  const [appSectorPicker, setAppSectorPicker] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const [appPrefilled, setAppPrefilled] = useState(false);
  const [now] = useState(() => Date.now());

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
    if (me.data?.emailVerified === false) return toast.error('Önce e-posta adresinizi doğrulayın.');
    if (appName.trim().length < 3) return toast.error('Mağaza adı en az 3 karakter olmalı.');
    if (!appSector) return toast.error('Faaliyet alanı seçin.');
    if (appTaxOffice.trim().length < 2) return toast.error('Vergi dairesi girin.');
    const taxDigits = appTaxNo.replace(/\D/g, '');
    if (appBusinessType === 'COMPANY' && taxDigits.length !== 10) {
      return toast.error('Limited / A.Ş. için 10 haneli VKN girin.');
    }
    if (appBusinessType === 'SOLE' && taxDigits.length !== 10 && !(taxDigits.length === 11 && !taxDigits.startsWith('0'))) {
      return toast.error('Şahıs şirketi için 10 haneli VKN veya 11 haneli TCKN girin.');
    }
    if (!appCity) return toast.error('Şehir seçin.');
    const digits = cleanPhone(appPhone);
    if (!/^05\d{9}$/.test(digits)) return toast.error('İşletme telefonu 05xx xxx xx xx biçiminde olmalı.');
    if (appAddress.trim().length < 10) return toast.error('Açık işletme adresi en az 10 karakter olmalı.');
    setAppBusy(true);
    try {
      await storeApplications.submit({
        name: appName.trim(),
        businessType: appBusinessType,
        sector: appSector,
        taxOffice: appTaxOffice.trim(),
        taxNo: taxDigits,
        city: appCity,
        phone: digits,
        address: appAddress.trim(),
        notes: appNotes.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: keys.storeApplication });
      toast.success('Kurumsal mağaza başvurunuz alındı');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAppBusy(false);
    }
  };

  if (!store) {
    const application = appQuery.data;
    const emailVerified = me.data?.emailVerified !== false;
    const listingLimit = me.data?.listingLimit;
    const cooldownActive = Boolean(application?.cooldown_until && Date.parse(application.cooldown_until) > now);
    const remainingCooldownDays =
      cooldownActive && application?.cooldown_until
        ? Math.max(1, Math.ceil((Date.parse(application.cooldown_until) - now) / 86_400_000))
        : 0;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Kurumsal Hesaba Geç" />
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
                  <Text variant="subheading">Kurumsal başvurunuz inceleniyor</Text>
                  <Badge label="Onay bekliyor" tone="warn" style={styles.statusBadge} />
                </View>
              </View>
              <Text variant="caption" tone="muted">
                Başvurunuz ekibimiz tarafından incelendikten sonra mağazanız aktif edilecektir.
              </Text>
              <View style={[styles.appDetails, { borderTopColor: c.border }]}>
                <DetailLine label="Mağaza adı" value={application.name} />
                {application.business_type ? (
                  <DetailLine label="İşletme türü" value={BUSINESS_TYPE_LABEL[application.business_type]} />
                ) : null}
                {application.sector ? <DetailLine label="Sektör" value={application.sector} /> : null}
                {application.tax_office ? <DetailLine label="Vergi dairesi" value={application.tax_office} /> : null}
                {application.tax_no ? <DetailLine label="VKN / TCKN" value={application.tax_no} /> : null}
                {application.city ? <DetailLine label="Şehir" value={application.city} /> : null}
                {application.phone ? <DetailLine label="Telefon" value={formatPhone(application.phone)} /> : null}
                {application.address ? <DetailLine label="Adres" value={application.address} /> : null}
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
            <Card style={[styles.introCard, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
              <Text variant="bodyStrong" tone="primary">
                Bireysel Hesap {listingLimit ? `(${listingLimit.used}/${listingLimit.max} aktif ilan)` : ''}
              </Text>
              <Text variant="caption" tone="muted">
                Onaylı Kurumsal hesapta mağaza vitrini, kurumsal rozet, 50+ aktif ilan hakkı ve toplu ilan aktarımı açılır.
              </Text>
            </Card>

            {!emailVerified ? (
              <Card style={[styles.rejectCard, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
                <Badge label="E-posta doğrulaması gerekli" tone="warn" />
                <Text variant="caption" tone="muted">
                  Kurumsal başvuru göndermeden önce hesap e-posta adresinizi doğrulamanız gerekir.
                </Text>
                <Button title="Hesap ve güvenlikten doğrula" size="sm" variant="outline" onPress={() => router.push('/ayarlar/guvenlik')} />
              </Card>
            ) : null}

            {application && application.status === 'REJECTED' ? (
              <Card style={[styles.rejectCard, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
                <Badge label="Önceki başvuru reddedildi" tone="danger" />
                {application.review_note ? (
                  <Text variant="caption" tone="danger">
                    {application.review_note}
                  </Text>
                ) : null}
                {cooldownActive ? (
                  <Text variant="caption" tone="danger">
                    {remainingCooldownDays} gün sonra ({formatDate(application.cooldown_until!)}) yeniden başvurabilirsiniz.
                  </Text>
                ) : (
                  <Text variant="caption" tone="danger">
                    Bilgilerinizi güncelleyerek yeniden başvurabilirsiniz.
                  </Text>
                )}
              </Card>
            ) : null}

            {!cooldownActive ? (
              <>
                <View style={styles.typeWrap}>
                  <Text variant="label">İşletme türü</Text>
                  <View style={styles.typeRow}>
                    {BUSINESS_TYPES.map((bt) => {
                      const active = appBusinessType === bt.value;
                      return (
                        <Pressable
                          key={bt.value}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          onPress={() => setAppBusinessType(bt.value)}
                          style={[
                            styles.typeBtn,
                            { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface },
                          ]}
                        >
                          <Text variant="label" style={{ color: active ? c.primary : c.muted }}>
                            {bt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Input
                  label="Mağaza / İşletme adı"
                  required
                  icon={Store}
                  placeholder="Örn. Yıldız Oto Galeri"
                  value={appName}
                  onChangeText={setAppName}
                  maxLength={60}
                />
                <SelectField
                  label="Faaliyet alanı (Sektör)"
                  icon={Briefcase}
                  placeholder="Seçin"
                  value={appSector}
                  onPress={() => setAppSectorPicker(true)}
                />
                <Input
                  label="Vergi dairesi"
                  required
                  icon={Building2}
                  placeholder="Örn. Seyhan Vergi Dairesi"
                  value={appTaxOffice}
                  onChangeText={setAppTaxOffice}
                  maxLength={80}
                />
                <Input
                  label={appBusinessType === 'COMPANY' ? 'Vergi Kimlik No (10 hane VKN)' : 'VKN (10 hane) veya TCKN (11 hane)'}
                  required
                  icon={FileText}
                  placeholder={appBusinessType === 'COMPANY' ? '10 haneli VKN' : '10 haneli VKN veya 11 haneli TCKN'}
                  keyboardType="number-pad"
                  value={appTaxNo}
                  onChangeText={(t) => setAppTaxNo(t.replace(/\D/g, '').slice(0, appBusinessType === 'COMPANY' ? 10 : 11))}
                  maxLength={appBusinessType === 'COMPANY' ? 10 : 11}
                />
                <SelectField label="Şehir" icon={MapPin} placeholder="Seçin" value={appCity} onPress={() => setAppCityPicker(true)} />
                <Input
                  label="İşletme telefonu"
                  required
                  icon={Phone}
                  keyboardType="phone-pad"
                  placeholder="05xx xxx xx xx"
                  value={appPhone}
                  onChangeText={(t) => setAppPhone(maskPhoneInput(t))}
                />
                <Input
                  label="Açık işletme adresi"
                  required
                  multiline
                  placeholder="Mahalle, cadde/sokak, bina no, ilçe ve il"
                  value={appAddress}
                  onChangeText={setAppAddress}
                  maxLength={300}
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
                <Button title="Kurumsal başvuru gönder" size="lg" loading={appBusy} disabled={!emailVerified} onPress={() => void submitApplication()} />
              </>
            ) : null}
          </KeyboardAwareScrollView>
        )}
        <OptionPicker visible={appCityPicker} onClose={() => setAppCityPicker(false)} title="Şehir" value={appCity} onSelect={(v) => setAppCity(v ?? '')} />
        <OptionPicker
          visible={appSectorPicker}
          onClose={() => setAppSectorPicker(false)}
          title="Faaliyet alanı"
          options={STORE_SECTORS}
          value={appSector}
          onSelect={(v) => setAppSector(v ?? '')}
        />
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
  typeWrap: { gap: space.xs },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1.5 },
});
