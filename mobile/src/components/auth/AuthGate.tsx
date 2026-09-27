import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { LogoMark } from '@/src/components/brand/LogoMark';
import { getStoredUser, mobileSignIn, mobileSignUp, MobileUser } from '@/src/api/auth';

interface AuthGateProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * Web sitesindeki <RedirectToSignIn /> mantığı:
 * Kullanıcı giriş yapmamışsa doğrudan Giriş / Kayıt ekranını gösterir.
 * Giriş yapıldığında asıl içeriği açar.
 */
export function AuthGate({
  children,
  title = 'GeldeSat Hesabı',
  subtitle = 'Bu özelliği kullanabilmek için lütfen giriş yapın veya ücretsiz hesap oluşturun.',
}: AuthGateProps) {
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);
  const [checking, setChecking] = useState(true);

  // Form state
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const checkUser = useCallback(async () => {
    setChecking(true);
    const user = await getStoredUser();
    setCurrentUser(user);
    setChecking(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkUser();
    }, [checkUser])
  );

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Geçersiz Bilgi', 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Geçersiz Bilgi', 'Şifre en az 6 karakter olmalıdır.');
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
        if (res.success && res.user) {
          setCurrentUser(res.user);
        } else {
          Alert.alert('Hata', res.error || 'Giriş yapılamadı.');
        }
      } else {
        const res = await mobileSignUp(name, email, password);
        if (res.success && res.user) {
          setCurrentUser(res.user);
        } else {
          Alert.alert('Hata', res.error || 'Kayıt işlemi başarısız.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#1a4fd8" />
      </View>
    );
  }

  // Kullanıcı giriş yaptıysa doğrudan çocuk bileşeni göster
  if (currentUser) {
    return <>{children}</>;
  }

  // Giriş yapmamışsa doğrudan giriş/kayıt formunu göster
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brandHeader}>
          <LogoMark size={44} color="#1a4fd8" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
                placeholder="En az 6 karakter"
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

        <View style={styles.termsBox}>
          <Text style={styles.termsText}>
            GeldeSat ile güvenli alışveriş ve anlık mesajlaşma deneyimi.
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12151c',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#5a6270',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    padding: 3,
    width: '100%',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
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
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 42,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#1a4fd8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  termsBox: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  termsText: {
    fontSize: 11,
    color: '#8a929e',
    textAlign: 'center',
  },
});
