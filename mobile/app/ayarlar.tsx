import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight, KeyRound, LogOut, Mail, Search, ShieldCheck, Store, Trash2, UserRound, X } from 'lucide-react-native';
import { AuthGate } from '@/src/components/auth/AuthGate';
import { getStoredUser, mobileSignOut, MobileUser } from '@/src/api/auth';
import { deleteMobileSavedSearch, getMobileProfile, MobileProfile, mobileChangePassword, registerMobilePushToken, unregisterMobilePushToken, updateMobileProfile, updateMobileStore } from '@/src/api/client';
import { TURKEY_CITIES } from '@/src/data/locations';
import { clearRegisteredPushToken, getRegisteredPushToken, registerForPushNotificationsAsync } from '@/src/services/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<{ id: string; name: string; slug: string; plan: string; city: string; description: string } | null>(null);
  const [savedSearches, setSavedSearches] = useState<Array<{ id: string; label: string; query: string; filters: string }>>([]);
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const loadUser = useCallback(async () => {
    const user = await getStoredUser();
    setCurrentUser(user);
    setPushToken(await getRegisteredPushToken());
    if (!user?.token) {
      setProfile(null);
      return;
    }
    setProfileBusy(true);
    try {
      const response = await getMobileProfile(user.token);
      if (!response.success || !response.profile) throw new Error(response.error || 'Profil yüklenemedi.');
      setProfile(response.profile);
      setStore(response.store ?? null);
      setStoreName(response.store?.name ?? '');
      setStoreDescription(response.store?.description ?? '');
      setSavedSearches(response.savedSearches ?? []);
    } catch (error) {
      Alert.alert('Profil yüklenemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setProfileBusy(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void loadUser(); }, [loadUser]));

  const updateField = (field: keyof Pick<MobileProfile, 'display_name' | 'phone' | 'bio' | 'city' | 'district'>, value: string) => {
    setProfile((current) => current ? { ...current, [field]: value } : current);
  };

  const handleSaveProfile = async () => {
    if (!currentUser?.token || !profile) return;
    setSaving(true);
    try {
      await updateMobileProfile(currentUser.token, profile);
      Alert.alert('Kaydedildi', 'Profil bilgileriniz güncellendi.');
    } catch (error) {
      Alert.alert('Kaydedilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStore = async () => {
    if (!currentUser?.token) return;
    if (storeName.trim().length < 3) {
      Alert.alert('Mağaza adı gerekli', 'Mağaza adı en az 3 karakter olmalıdır.');
      return;
    }
    setSaving(true);
    try {
      const savedStore = await updateMobileStore(currentUser.token, {
        name: storeName.trim(),
        description: storeDescription,
        city: profile?.city ?? '',
        phone: profile?.phone ?? '',
      });
      setStore({ id: savedStore.id, slug: savedStore.slug, name: storeName.trim(), plan: store?.plan ?? 'BASIC', city: profile?.city ?? '', description: storeDescription });
      Alert.alert('Kaydedildi', 'Mağaza bilgileriniz güncellendi.');
    } catch (error) {
      Alert.alert('Kaydedilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSearch = (id: string) => {
    if (!currentUser?.token) return;
    Alert.alert('Kayıtlı aramayı sil', 'Bu kayıtlı aramayı silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          await deleteMobileSavedSearch(currentUser.token!, id);
          setSavedSearches((items) => items.filter((item) => item.id !== id));
        } catch (error) {
          Alert.alert('Silinemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
        }
      } },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentUser?.token) return;
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert('Şifreyi kontrol edin', 'Yeni şifre en az 8 karakter olmalı ve iki alan eşleşmelidir.');
      return;
    }
    setSecurityBusy(true);
    try {
      await mobileChangePassword(currentUser.token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Güncellendi', 'Şifreniz değiştirildi.');
    } catch (error) {
      Alert.alert('Değiştirilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        await mobileSignOut();
        setCurrentUser(null);
        setProfile(null);
        router.replace('/login' as any);
      } },
    ]);
  };

  const handlePushToggle = async () => {
    if (!currentUser?.token || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushToken) {
        await unregisterMobilePushToken(currentUser.token, pushToken);
        await clearRegisteredPushToken();
        setPushToken(null);
        Alert.alert('Bildirimler kapatıldı', 'Bu cihaz için push bildirimleri kapatıldı.');
      } else {
        const registered = await registerForPushNotificationsAsync();
        if (!registered) {
          Alert.alert('İzin gerekli', 'Push bildirimlerini açmak için cihaz ayarlarından GeldeSat bildirimlerine izin verin.');
          return;
        }
        await registerMobilePushToken(currentUser.token, registered, Platform.OS === 'ios' ? 'ios' : 'android');
        setPushToken(registered);
        Alert.alert('Bildirimler açıldı', 'Mesaj ve ilan güncellemelerini bu cihazda alacaksınız.');
      }
    } catch (error) {
      Alert.alert('İşlem tamamlanamadı', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <AuthGate
      title="Ayarlar"
      subtitle="Hesabınızı ve ilanlarınızı yönetmek için giriş yapın veya ücretsiz hesap oluşturun.">
      <Stack.Screen options={{ title: 'Ayarlar', headerTitle: 'Ayarlar' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.pageTitle}>Hesap Ayarları</Text>
            <Text style={styles.emailSubtitle} numberOfLines={1}>{currentUser?.email}</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.75}>
            <LogOut size={16} color="#5a6270" />
            <Text style={styles.signOutLabel}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profileBusy ? '…' : profile?.active_count ?? 0}</Text>
            <Text style={styles.statLabel}>Aktif İlan</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profileBusy ? '…' : profile?.rating_avg ? profile.rating_avg.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Satıcı Puanı</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <Bell size={19} color="#1a4fd8" />
            <Text style={styles.sectionTitle}>Push Bildirimleri</Text>
          </View>
          <Text style={styles.sectionDescription}>Yeni mesaj ve ilan güncellemelerini bu cihazda alın.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void handlePushToggle()} disabled={pushBusy || !currentUser?.token} activeOpacity={0.8} accessibilityRole="button">
            {pushBusy ? <ActivityIndicator color="#1a4fd8" /> : <Text style={styles.secondaryButtonText}>{pushToken ? 'Bu Cihazda Kapat' : 'Bildirimleri Aç'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <UserRound size={19} color="#1a4fd8" />
            <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          </View>
          {profile ? (
            <>
              <ProfileInput label="Ad Soyad" value={profile.display_name} onChangeText={(value) => updateField('display_name', value)} />
              <ProfileInput label="Telefon Numarası" value={profile.phone} placeholder="5xx xxx xx xx" keyboardType="phone-pad" onChangeText={(value) => updateField('phone', value)} />
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Şehir</Text>
                <TouchableOpacity style={styles.citySelector} onPress={() => setCityPickerOpen(true)} accessibilityRole="button">
                  <Text style={[styles.citySelectorText, !profile.city && styles.cityPlaceholder]}>{profile.city || 'Şehir seçin'}</Text>
                  <ChevronRight size={17} color="#8a929e" />
                </TouchableOpacity>
              </View>
              <ProfileInput label="Hakkında" value={profile.bio} placeholder="Satıcı profilinizde görünecek kısa bir tanıtım yazısı" multiline onChangeText={(value) => updateField('bio', value)} />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Bilgileri Kaydet</Text>}
              </TouchableOpacity>
            </>
          ) : profileBusy ? (
            <ActivityIndicator style={styles.profileLoader} color="#1a4fd8" />
          ) : (
            <InfoRow label="Ad Soyad" value={currentUser?.name || '—'} />
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <ShieldCheck size={19} color="#1a4fd8" />
            <Text style={styles.sectionTitle}>E-posta ve Güvenlik Ayarları</Text>
          </View>
          <View style={styles.emailPanel}>
            <Mail size={18} color="#5a6270" />
            <View style={styles.emailInfo}>
              <Text style={styles.fieldLabel}>Kayıtlı Giriş E-postası</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>{currentUser?.email}</Text>
            </View>
          </View>
          <View style={styles.passwordDivider} />
          <View style={styles.passwordHeading}><KeyRound size={16} color="#5a6270" /><Text style={styles.passwordTitle}>Şifre Değiştir</Text></View>
          <ProfileInput label="Mevcut Şifre" value={currentPassword} secureTextEntry onChangeText={setCurrentPassword} />
          <ProfileInput label="Yeni Şifre" value={newPassword} secureTextEntry placeholder="En az 8 karakter" onChangeText={setNewPassword} />
          <ProfileInput label="Yeni Şifre (Tekrar)" value={confirmPassword} secureTextEntry placeholder="Yeni şifrenizi doğrulayın" onChangeText={setConfirmPassword} />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleChangePassword} disabled={securityBusy || !currentPassword || !newPassword} activeOpacity={0.8}>
            {securityBusy ? <ActivityIndicator color="#1a4fd8" /> : <Text style={styles.secondaryButtonText}>Şifreyi Güncelle</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <Store size={19} color="#1a4fd8" />
            <Text style={styles.sectionTitle}>Kurumsal Mağaza</Text>
          </View>
          <Text style={styles.sectionDescription}>İlanlarınız mağaza sayfanızda özel bir vitrinde toplanır.</Text>
          <ProfileInput label="Mağaza Adı" value={storeName} placeholder="Mağaza adı" onChangeText={setStoreName} />
          <ProfileInput label="Mağaza Açıklaması" value={storeDescription} placeholder="İşletmeniz hakkında kısa bilgi" multiline onChangeText={setStoreDescription} />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveStore} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#1a4fd8" /> : <Text style={styles.secondaryButtonText}>{store ? 'Mağazayı Güncelle' : 'Mağaza Aç'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kayıtlı Aramalar</Text>
          <Text style={styles.sectionDescription}>Kriterlerinize uyan yeni ilanlardan haberdar olun.</Text>
          {savedSearches.length === 0 ? (
            <View style={styles.emptySearches}><Text style={styles.emptySearchesText}>Henüz kayıtlı aramanız bulunmuyor.</Text></View>
          ) : savedSearches.map((item) => (
            <View key={item.id} style={styles.savedSearchRow}>
              <TouchableOpacity style={styles.savedSearchMain} onPress={() => {
                let category = '';
                try { category = JSON.parse(item.filters)?.category || ''; } catch { /* Keep the saved query even if old filter data is malformed. */ }
                router.push({ pathname: '/(tabs)/kategoriler', params: { q: item.query || '', filters: item.filters || '', category } } as any);
              }}>
                <Search size={16} color="#1a4fd8" />
                <Text style={styles.savedSearchLabel} numberOfLines={1}>{item.label || item.query || 'Kayıtlı Arama'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteSearch(item.id)} hitSlop={8}>
                <Trash2 size={17} color="#b42318" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Modal visible={cityPickerOpen} animationType="slide" statusBarTranslucent={Platform.OS === 'android'} navigationBarTranslucent={Platform.OS === 'android'} onRequestClose={() => setCityPickerOpen(false)}>
          <View style={[styles.cityModal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
            <View style={styles.cityModalHeader}><Text style={styles.cityModalTitle}>Şehir seçin</Text><TouchableOpacity onPress={() => setCityPickerOpen(false)} style={styles.cityClose}><X size={20} color="#12151c" /></TouchableOpacity></View>
            <View style={styles.citySearch}><Search size={17} color="#7a8492" /><TextInput value={citySearch} onChangeText={setCitySearch} placeholder="Şehir ara" placeholderTextColor="#8a929e" style={styles.citySearchInput} autoFocus /></View>
            <FlatList data={TURKEY_CITIES.filter((city) => city.name.toLocaleLowerCase('tr').includes(citySearch.trim().toLocaleLowerCase('tr')))} keyExtractor={(city) => String(city.id)} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <TouchableOpacity style={styles.cityRow} onPress={() => { updateField('city', item.name); updateField('district', ''); setCityPickerOpen(false); setCitySearch(''); }}><Text style={styles.cityRowText}>{item.name}</Text><ChevronRight size={16} color="#a0a8b3" /></TouchableOpacity>} />
          </View>
        </Modal>

      </ScrollView>
    </AuthGate>
  );
}

function ProfileInput({ label, value, onChangeText, placeholder, keyboardType, multiline, secureTextEntry }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a929e"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.profileInput, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
  headingCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: '#12151c', fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.35 },
  emailSubtitle: { color: '#5a6270', fontSize: 13, marginTop: 3 },
  signOutButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#ffffff' },
  signOutLabel: { color: '#5a6270', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minHeight: 82, justifyContent: 'center', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#ffffff', padding: 12 },
  statValue: { color: '#12151c', fontSize: 23, lineHeight: 28, fontWeight: '700' },
  statLabel: { color: '#5a6270', fontSize: 12 },
  sectionCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#ffffff', padding: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#d8dee6' },
  sectionTitle: { color: '#12151c', fontSize: 15, fontWeight: '700' },
  inputGroup: { gap: 5, marginTop: 12 },
  profileInput: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#ffffff', color: '#12151c', fontSize: 14 },
  multilineInput: { minHeight: 82, paddingTop: 10 },
  saveButton: { height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#1a4fd8', marginTop: 16 },
  saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  profileLoader: { paddingVertical: 20 },
  passwordDivider: { height: 1, backgroundColor: '#d8dee6', marginTop: 18, marginBottom: 12 },
  passwordHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  passwordTitle: { color: '#12151c', fontSize: 14, fontWeight: '600' },
  secondaryButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#d8dee6', borderRadius: 8, backgroundColor: '#ffffff', marginTop: 14 },
  secondaryButtonText: { color: '#1a4fd8', fontSize: 13, fontWeight: '600' },
  sectionDescription: { color: '#5a6270', fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptySearches: { minHeight: 72, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#d8dee6', borderRadius: 8, padding: 14, marginTop: 14 },
  emptySearchesText: { color: '#5a6270', textAlign: 'center', fontSize: 13 },
  savedSearchRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d8dee6' },
  savedSearchMain: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedSearchLabel: { flex: 1, color: '#12151c', fontSize: 14, fontWeight: '500' },
  infoRow: { paddingVertical: 10, gap: 3 },
  fieldLabel: { color: '#5a6270', fontSize: 12 },
  fieldValue: { color: '#12151c', fontSize: 14, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
  emailPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderWidth: 1, borderColor: '#d8dee6', borderRadius: 9, backgroundColor: '#f8f9fb' },
  emailInfo: { flex: 1, gap: 3 },
  citySelector: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff' },
  citySelectorText: { color: '#12151c', fontSize: 14 }, cityPlaceholder: { color: '#8a929e' },
  cityModal: { flex: 1, backgroundColor: '#f3f5f8', paddingHorizontal: 18 }, cityModalHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cityModalTitle: { color: '#12151c', fontSize: 20, fontWeight: '700' }, cityClose: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 21 }, citySearch: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginVertical: 12, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1, borderColor: '#d8dee6' }, citySearchInput: { flex: 1, color: '#12151c', fontSize: 14 }, cityRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d8dee6' }, cityRowText: { color: '#12151c', fontSize: 15 },
});
