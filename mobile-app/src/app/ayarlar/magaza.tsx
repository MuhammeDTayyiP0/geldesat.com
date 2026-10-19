import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ExternalLink, MapPin, Phone, Store } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import { OptionPicker } from '@/features/location/OptionPicker';
import { SUPPORT_EMAIL } from '@/lib/config';
import { cleanPhone, maskPhoneInput } from '@/lib/format';
import { Button, EmptyState, Header, Input, Loading, SelectField, space, toast, useTheme } from '@/ui';

/** Edit the account's store. Stores are opened by the GeldeSat team, not in the app. */
export default function StoreSettings() {
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

  // Fill the form when the store arrives (or after a save refreshes it).
  if (store && loadedFor !== store.id) {
    setLoadedFor(store.id);
    setName(store.name);
    setDescription(store.description ?? '');
    setCity(store.city ?? '');
    setPhone(store.phone ? maskPhoneInput(store.phone) : '');
  }

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Mağazam" />
        <Loading />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Mağaza" />
        <EmptyState
          icon={Store}
          title="Kurumsal mağaza"
          message="Kurumsal mağazalar GeldeSat ekibi tarafından açılır. Başvuru için bize yazın."
          action={<Button title="Başvur" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Kurumsal%20ma%C4%9Faza%20ba%C5%9Fvurusu`)} />}
        />
      </View>
    );
  }

  const save = async () => {
    if (name.trim().length < 3) return toast.error('Mağaza adı en az 3 karakter olmalı.');
    setBusy(true);
    try {
      await account.updateStore({ name: name.trim(), description: description.trim() || undefined, city: city || undefined, phone: cleanPhone(phone) || undefined });
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
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
});
