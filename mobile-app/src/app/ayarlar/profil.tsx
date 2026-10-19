import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Camera, MapPin, Phone, Trash2, UserRound } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import { updateSessionUser } from '@/auth/session';
import { TURKEY_CITIES } from '@/data/locations';
import { OptionPicker } from '@/features/location/OptionPicker';
import { cleanPhone, maskPhoneInput } from '@/lib/format';
import { pickPhotos, preparePhoto } from '@/lib/photos';
import { Avatar, Button, Header, Input, ListRow, Loading, RowGroup, SelectField, Sheet, Text, space, toast, useTheme } from '@/ui';

export default function ProfileSettings() {
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
  const [loaded, setLoaded] = useState(false);

  // Fill the form once, when the profile first arrives.
  const p = me.data?.profile;
  if (p && !loaded) {
    setLoaded(true);
    setName(p.display_name);
    setPhone(p.phone ? maskPhoneInput(p.phone) : '');
    setBio(p.bio ?? '');
    setCity(p.city ?? '');
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
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (source: 'camera' | 'library') => {
    setPicker(null);
    const [photo] = await pickPhotos(source, 1);
    if (!photo) return;
    setAvatarBusy(true);
    try {
      await uploads.avatar(await preparePhoto(photo));
      await queryClient.invalidateQueries({ queryKey: keys.me });
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
        <Loading />
      </View>
    );
  }

  const districts = TURKEY_CITIES.find((x) => x.name === city)?.districts ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Profil bilgileri" right={<Button title="Kaydet" size="sm" variant="ghost" loading={saving} onPress={() => void save()} />} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Pressable onPress={() => setPicker('photo')} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Profil fotoğrafını değiştir">
          <Avatar name={name || 'Ü'} uri={me.data.profile?.avatar_url} size={96} />
          <View style={[styles.camera, { backgroundColor: c.primary, borderColor: c.bg }]}>
            {avatarBusy ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={16} color="#fff" />}
          </View>
        </Pressable>
        <Input label="Ad soyad" required icon={UserRound} value={name} onChangeText={setName} maxLength={60} />
        <Input
          label="Telefon"
          icon={Phone}
          keyboardType="phone-pad"
          placeholder="05xx xxx xx xx"
          value={phone}
          onChangeText={(t) => setPhone(maskPhoneInput(t))}
          hint="İlanlarınızda gösterilir. Kimlerin görebileceğini Gizlilik ayarlarından seçin."
        />
        <SelectField label="İl" icon={MapPin} placeholder="Seçin" value={city} onPress={() => setPicker('city')} />
        <SelectField label="İlçe" placeholder={city ? 'Seçin' : 'Önce il seçin'} value={district} disabled={!city} onPress={() => setPicker('district')} />
        <Input label="Hakkımda" multiline placeholder="Alıcıların sizi tanımasına yardımcı olun" value={bio} onChangeText={setBio} maxLength={400} hint={`${bio.length}/400`} />
        <Button title="Kaydet" size="lg" loading={saving} onPress={() => void save()} />
      </KeyboardAwareScrollView>

      <OptionPicker visible={picker === 'city'} onClose={() => setPicker(null)} title="İl" value={city} onSelect={(v) => { setCity(v ?? ''); setDistrict(''); }} />
      <OptionPicker visible={picker === 'district'} onClose={() => setPicker(null)} title="İlçe" options={districts} value={district} onSelect={(v) => setDistrict(v ?? '')} />
      <Sheet visible={picker === 'photo'} onClose={() => setPicker(null)} title="Profil fotoğrafı">
        <RowGroup>
          <ListRow icon={Camera} label="Fotoğraf çek" onPress={() => void changeAvatar('camera')} />
          <ListRow icon={UserRound} label="Galeriden seç" onPress={() => void changeAvatar('library')} />
          {me.data.profile?.avatar_url ? <ListRow icon={Trash2} label="Fotoğrafı kaldır" danger onPress={() => void removeAvatar()} /> : null}
        </RowGroup>
        <Text variant="caption" tone="subtle" center>
          Fotoğraf kare olarak kırpılır ve küçültülür.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  avatarWrap: { alignSelf: 'center', marginVertical: space.md },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
});
