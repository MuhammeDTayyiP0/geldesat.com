import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, Mail, Lock, User, Eye, EyeOff, Check } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { LogoMark } from '@/src/components/brand/LogoMark';
import { mobileSignIn, mobileSignUp } from '@/src/api/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in'); // 'in': Giriş, 'up': Kayıt
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Geçersiz Bilgi', 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Geçersiz Bilgi', 'Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (mode === 'up' && !termsAccepted) {
      Alert.alert('Sözleşme onayı gerekli', 'Kayıt olmak için üyelik sözleşmesini ve gizlilik politikasını kabul edin.');
      return;
    }
    if (mode === 'up' && !name.trim()) {
      Alert.alert('Geçersiz Bilgi', 'Lütfen ad ve soyadınızı girin.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'in') {
        const res = await mobileSignIn(email, password);
        if (res.success) {
          Alert.alert('Giriş Başarılı', `Hoş geldiniz, ${res.user?.name}!`, [
            { text: 'Tamam', onPress: () => router.replace('/(tabs)/profil') },
          ]);
        } else {
          Alert.alert('Hata', res.error || 'Giriş yapılamadı.');
        }
      } else {
        const res = await mobileSignUp(name, email, password);
        if (res.success) {
          Alert.alert('Kayıt Başarılı', 'Hesabınız başarıyla oluşturuldu.', [
            { text: 'Tamam', onPress: () => router.replace('/(tabs)/profil') },
          ]);
        } else {
          Alert.alert('Hata', res.error || 'Kayıt işlemi başarısız.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      {/* Üst Kapatma Butonu */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <X size={20} color="#12151c" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo ve Başlık */}
        <View style={styles.brandHeader}>
          <LogoMark size={48} color="#1a4fd8" />
          <Text style={styles.title}>GeldeSat Hesabı</Text>
          <Text style={styles.subtitle}>
            İlan vermek, satıcılarla mesajlaşmak ve favorilerinizi kaydetmek için giriş yapın.
          </Text>
        </View>

        {/* Giriş / Kayıt Sekmesi */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'in' && styles.tabBtnActive]}
            onPress={() => setMode('in')}>
            <Text style={[styles.tabBtnText, mode === 'in' && styles.tabBtnTextActive]}>
              Giriş Yap
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'up' && styles.tabBtnActive]}
            onPress={() => setMode('up')}>
            <Text style={[styles.tabBtnText, mode === 'up' && styles.tabBtnTextActive]}>
              Kayıt Ol
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Alanları */}
        <View style={styles.formCard}>
          {mode === 'up' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ad Soyad</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#8a929e" style={styles.inputIcon} />
                <TextInput
                  placeholder="Örn: Ahmet Yılmaz"
                  placeholderTextColor="#8a929e"
                  value={name}
                  onChangeText={setName}
                  style={styles.textInput}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta Adresi</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#8a929e" style={styles.inputIcon} />
              <TextInput
                placeholder="ornek@geldesat.com"
                placeholderTextColor="#8a929e"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şifre</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#8a929e" style={styles.inputIcon} />
              <TextInput
                placeholder="En az 8 karakter"
                placeholderTextColor="#8a929e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.textInput}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={18} color="#8a929e" /> : <Eye size={18} color="#8a929e" />}
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'up' ? (
            <TouchableOpacity style={styles.termsAcceptRow} onPress={() => setTermsAccepted((value) => !value)} activeOpacity={0.8}>
              <View style={[styles.termsCheckbox, termsAccepted && styles.termsCheckboxActive]}>
                {termsAccepted ? <Check size={14} color="#ffffff" /> : null}
              </View>
              <Text style={styles.termsAcceptText}>
                <Text onPress={() => void Linking.openURL('https://www.geldesat.com/sayfa/uyelik')}>Üyelik sözleşmesini</Text> ve{' '}
                <Text onPress={() => void Linking.openURL('https://www.geldesat.com/sayfa/gizlilik')}>gizlilik politikasını</Text> okudum, kabul ediyorum.
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Gönder Butonu */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'in' ? 'Giriş Yap' : 'Ücretsiz Kayıt Ol'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bilgilendirme Notu */}
        <View style={styles.termsBox}>
          <Text style={styles.termsText}>
            Giriş yaparak GeldeSat Kullanıcı Sözleşmesi ve Gizlilik Politikası'nı kabul etmiş sayılırsınız.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#12151c',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#5a6270',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f5f8',
    borderRadius: 10,
    padding: 4,
    width: '100%',
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a6270',
  },
  tabBtnTextActive: {
    color: '#12151c',
    fontWeight: '700',
  },
  formCard: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 44,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#12151c',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1a4fd8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  termsBox: {
    marginTop: 24,
    paddingHorizontal: 10,
  },
  termsAcceptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 },
  termsCheckbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#d8dee6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  termsCheckboxActive: { borderColor: '#1a4fd8', backgroundColor: '#1a4fd8' },
  termsAcceptText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#5a6270' },
  termsText: {
    fontSize: 11,
    color: '#8a929e',
    textAlign: 'center',
    lineHeight: 16,
  },
});
