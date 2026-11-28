import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { BadgeCheck, Briefcase, Building2, Clock, FileText, MapPin, Phone, Store } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { storeApplications } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import type { BusinessType } from '@/api/types';
import { OptionPicker } from '@/features/location/OptionPicker';
import { cleanPhone, formatDate, formatPhone, maskPhoneInput } from '@/lib/format';
import { Badge, Button, Card, ErrorState, Header, Input, Loading, SelectField, Text, radius, space, toast, useTheme } from '@/ui';
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

/** Corporate upgrade application screen for individual accounts; corporate accounts redirect to single profile settings. */
export default function CorporateUpgradeScreen() {
  return (
    <RequireSignIn title="Kurumsal Hesaba Geç">
      <CorporateUpgrade />
    </RequireSignIn>
  );
}

function CorporateUpgrade() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const store = me.data?.store;

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

  if (!store && me.data?.profile && !appPrefilled) {
    setAppPrefilled(true);
    setAppCity(me.data.profile.city ?? '');
    setAppPhone(me.data.profile.phone ? maskPhoneInput(me.data.profile.phone) : '');
  }

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Kurumsal Hesaba Geç" />
        <Loading />
      </View>
    );
  }

  if (me.isError && !me.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Kurumsal Hesaba Geç" />
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </View>
    );
  }

  if (store) {
    return <Redirect href="/ayarlar/profil" />;
  }

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
              Başvurunuz ekibimiz tarafından incelendikten sonra hesabınız Kurumsal türe yükseltilecektir.
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
              Hesabınız Kurumsal türe yükseldi. Profil ve mağaza ayarlarınızı görmek için sayfayı yenileyin.
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
              Onaylı Kurumsal hesapta mevcut profiliniz mağaza vitrinine dönüşür; kurumsal rozet, 50+ aktif ilan hakkı ve toplu ilan aktarımı tek hesapta açılır.
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
