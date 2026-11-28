import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Camera, MapPin, Phone, Store, Trash2, UserRound } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import type { BusinessType } from '@/api/types';
import { updateSessionUser } from '@/auth/session';
import { TURKEY_CITIES } from '@/data/locations';
import { OptionPicker } from '@/features/location/OptionPicker';
import { cleanPhone, maskPhoneInput } from '@/lib/format';
import { pickPhotos, type PickedPhoto } from '@/lib/photos';
import { AvatarCropper } from '@/features/photos/AvatarCropper';
import { Avatar, Badge, Button, Card, ErrorState, Header, Input, ListRow, Loading, RowGroup, SelectField, Sheet, Text, radius, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  SOLE: 'Şahıs Şirketi',
  COMPANY: 'Limited / A.Ş.',
};

export default function ProfileSettingsScreen() {
  return (
    <RequireSignIn title="Profil bilgileri">
      <ProfileSettings />
    </RequireSignIn>
  );
}

function ProfileSettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [picker, setPicker] = useState<'city' | 'district' | 'photo' | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PickedPhoto | null>(null);
  const [loaded, setLoaded] = useState(false);
  // What to do once the photo sheet has closed: a picker opened while it is closing freezes the app.
  const [afterSheet, setAfterSheet] = useState<'camera' | 'library' | 'remove' | null>(null);

  // Fill the form once, when the profile first arrives.
  const p = me.data?.profile;
  const store = me.data?.store ?? null;
  const listingLimit = me.data?.listingLimit ?? null;
  if (p && !loaded) {
    setLoaded(true);
    setName(store?.name || p.display_name);
    setPhone(p.phone ? maskPhoneInput(p.phone) : store?.phone ? maskPhoneInput(store.phone) : '');
    setBio(p.bio || store?.description || '');
    setCity(p.city || store?.city || '');
    setDistrict(p.district ?? '');
  }

  const save = async () => {
    if (name.trim().length < 2) return toast.error('Adınız en az 2 karakter olmalı.');
    const digits = cleanPhone(phone);
    if (digits && !/^05\d{9}$/.test(digits)) return toast.error('Telefon 05xx xxx xx xx biçiminde olmalı.');
    setSaving(true);
    try {
      await account.updateProfile({ display_name: name.trim(), phone: digits || undefined, bio: bio.trim() || undefined, city: city || undefined, district: district || undefined });
      updateSessionUser({ name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: keys.me });
      toast.success('Profiliniz kaydedildi');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/hesap');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (source: 'camera' | 'library') => {
    setPicker(null);
    try {
      const [photo] = await pickPhotos(source, 1);
      if (!photo) return;
      setPendingPhoto(photo);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const confirmAvatar = async (cropped: { uri: string; mimeType: string; fileName: string }) => {
    setAvatarBusy(true);
    try {
      await uploads.avatar(cropped);
      await queryClient.invalidateQueries({ queryKey: keys.me });
      setPendingPhoto(null);
      toast.success('Profil fotoğrafı güncellendi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setPicker(null);
    setAvatarBusy(true);
    try {
      await uploads.removeAvatar();
      await queryClient.invalidateQueries({ queryKey: keys.me });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!me.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Profil bilgileri" />
        {me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : <Loading />}
      </View>
    );
  }

  const districts = TURKEY_CITIES.find((x) => x.name === city)?.districts ?? [];
  const isCorporate = Boolean(store);
  const avatarUri = store?.logo_url || me.data.profile?.avatar_url;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title={isCorporate ? 'Profil ve mağaza' : 'Profil bilgileri'}
        right={<Button title="Kaydet" size="sm" variant="ghost" loading={saving} onPress={() => void save()} />}
      />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <Pressable
          onPress={() => setPicker('photo')}
          style={styles.avatarWrap}
          accessibilityRole="button"
          accessibilityLabel={isCorporate ? 'Mağaza veya profil fotoğrafını değiştir' : 'Profil fotoğrafını değiştir'}
        >
          <Avatar name={name || 'Ü'} uri={avatarUri} size={96} />
          <View style={[styles.camera, { backgroundColor: c.primarySolid, borderColor: c.bg }]}>
            {avatarBusy ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={16} color="#fff" />}
          </View>
        </Pressable>
        <Input label={isCorporate ? 'Mağaza / İşletme adı' : 'Ad soyad'} required icon={isCorporate ? Store : UserRound} value={name} onChangeText={setName} maxLength={60} />
        <Input
          label={isCorporate ? 'İşletme telefonu' : 'Telefon'}
          icon={Phone}
          keyboardType="phone-pad"
          placeholder="05xx xxx xx xx"
          value={phone}
          onChangeText={(t) => setPhone(maskPhoneInput(t))}
          hint="İlanlarınızda gösterilir. Kimlerin görebileceğini Gizlilik ayarlarından seçin."
        />
        <SelectField label="İl" icon={MapPin} placeholder="Seçin" value={city} onPress={() => setPicker('city')} />
        <SelectField label="İlçe" placeholder={city ? 'Seçin' : 'Önce il seçin'} value={district} disabled={!city} onPress={() => setPicker('district')} />
        <Input
          label={isCorporate ? 'İşletme açıklaması' : 'Hakkımda'}
          multiline
          placeholder={isCorporate ? 'İşletmenizi ve hizmetlerinizi tanıtın' : 'Alıcıların sizi tanımasına yardımcı olun'}
          value={bio}
          onChangeText={setBio}
          maxLength={400}
          hint={`${bio.length}/400`}
        />
        <Button title="Kaydet" size="lg" loading={saving} onPress={() => void save()} />

        {store ? (
          <Card style={styles.infoCard}>
            <View style={styles.infoHead}>
              <Text variant="bodyStrong">Onaylı İşletme Bilgileri</Text>
              <Badge label={`Paket: ${store.plan}`} tone="primary" />
            </View>
            {store.business_type ? (
              <InfoRow label="İşletme türü" value={BUSINESS_TYPE_LABEL[store.business_type] ?? store.business_type} />
            ) : null}
            {store.sector ? <InfoRow label="Sektör" value={store.sector} /> : null}
            {store.tax_office ? <InfoRow label="Vergi dairesi" value={store.tax_office} /> : null}
            {store.tax_no ? <InfoRow label="VKN / TCKN" value={store.tax_no} /> : null}
            {listingLimit ? <InfoRow label="Aktif ilan hakkı" value={`${listingLimit.used} / ${listingLimit.max}`} /> : null}
            {store.address ? <InfoRow label="Adres" value={store.address} /> : null}
          </Card>
        ) : (
          <Card style={[styles.upgradeCard, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
            <Text variant="bodyStrong" tone="primary">
              Kurumsal Hesaba Geç
            </Text>
            <Text variant="caption" tone="muted">
              Bireysel hesapta en fazla {listingLimit?.max ?? 5} aktif ilan yayınlayabilirsiniz. İşletme başvurusuyla kurumsal rozet ve 50+ ilan hakkı açılır.
            </Text>
            <Button title="Başvuru yap" size="sm" variant="outline" onPress={() => router.push('/ayarlar/magaza')} />
          </Card>
        )}
      </KeyboardAwareScrollView>

      <OptionPicker visible={picker === 'city'} onClose={() => setPicker(null)} title="İl" value={city} onSelect={(v) => { setCity(v ?? ''); setDistrict(''); }} />
      <OptionPicker visible={picker === 'district'} onClose={() => setPicker(null)} title="İlçe" options={districts} value={district} onSelect={(v) => setDistrict(v ?? '')} />
      <Sheet
        visible={picker === 'photo'}
        onClose={() => setPicker(null)}
        title="Profil fotoğrafı"
        onDismissed={() => {
          const next = afterSheet;
          setAfterSheet(null);
          if (next === 'remove') void removeAvatar();
          else if (next) void changeAvatar(next);
        }}
      >
        <RowGroup>
          <ListRow icon={Camera} label="Fotoğraf çek" onPress={() => { setAfterSheet('camera'); setPicker(null); }} />
          <ListRow icon={UserRound} label="Galeriden seç" onPress={() => { setAfterSheet('library'); setPicker(null); }} />
          {me.data.profile?.avatar_url ? <ListRow icon={Trash2} label="Fotoğrafı kaldır" danger onPress={() => { setAfterSheet('remove'); setPicker(null); }} /> : null}
        </RowGroup>
        <Text variant="caption" tone="subtle" center>
          Seçtikten sonra kırpıp yakınlaştırabilirsiniz.
        </Text>
      </Sheet>
      <AvatarCropper
        photo={pendingPhoto}
        shape="circle"
        title="Profil fotoğrafı"
        busy={avatarBusy}
        onCancel={() => setPendingPhoto(null)}
        onConfirm={confirmAvatar}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text variant="caption" tone="muted" style={styles.infoLabel}>
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
  avatarWrap: { alignSelf: 'center', marginVertical: space.md },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  infoCard: { gap: space.sm, borderRadius: radius.lg },
  infoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  infoRow: { flexDirection: 'row', gap: space.sm },
  infoLabel: { width: 105 },
  upgradeCard: { gap: space.sm, borderRadius: radius.lg },
});
