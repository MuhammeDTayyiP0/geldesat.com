import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Lock, Mail, UserRound, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { errorMessage } from '@/api/client';
import { keys, queryClient, useConfig } from '@/api/queries';
import { requestPasswordReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/auth/auth';
import { Button, IconButton, Input, BrandIcon, Segmented, Text, hairline, radius, space, toast, useTheme, type TextInputRef } from '@/ui';

type Mode = 'signin' | 'signup' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { data: config } = useConfig();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const emailRef = useRef<TextInputRef>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const done = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: keys.me });
    toast.success(message);
    close();
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) return setError('Geçerli bir e-posta adresi girin.');
    if (mode === 'signup' && name.trim().length < 2) return setError('Adınızı ve soyadınızı girin.');
    if (mode !== 'forgot' && password.length < 8) return setError('Şifre en az 8 karakter olmalı.');
    setBusy('email');
    try {
      if (mode === 'signin') {
        const user = await signInWithEmail(mail, password);
        done(`Hoş geldiniz, ${user.name.split(' ')[0]}`);
      } else if (mode === 'signup') {
        const user = await signUpWithEmail(name, mail, password);
        if (user) done('Hesabınız oluşturuldu');
        else {
          setMode('signin');
          setNotice('Hesabınız oluşturuldu. E-postanıza gelen bağlantıyla adresinizi doğrulayıp giriş yapın.');
        }
      } else {
        await requestPasswordReset(mail);
        setNotice('Bu adresle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı birkaç dakika içinde gelecek. Gereksiz klasörünü de kontrol edin.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      const user = await signInWithGoogle();
      if (user) done(`Hoş geldiniz, ${user.name.split(' ')[0]}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.surface }]}>
      <View style={[styles.close, { paddingTop: insets.top > 30 ? space.sm : insets.top + space.sm }]}>
        <IconButton icon={X} label="Kapat" onPress={close} />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { borderColor: c.border }]}>
            <BrandIcon size={68} />
          </View>
          <Text variant="title" center>
            {mode === 'signup' ? 'Hesap oluşturun' : mode === 'forgot' ? 'Şifrenizi mi unuttunuz?' : 'GeldeSat’a giriş yapın'}
          </Text>
          <Text tone="muted" center>
            {reason ??
              (mode === 'forgot'
                ? 'E-posta adresinize sıfırlama bağlantısı gönderelim.'
                : 'İlan verin, mesajlaşın ve favorilerinizi her cihazda görün.')}
          </Text>
        </View>

        {mode !== 'forgot' ? (
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: 'signin', label: 'Giriş yap' },
              { value: 'signup', label: 'Üye ol' },
            ]}
          />
        ) : null}

        {notice ? (
          <View style={[styles.notice, { backgroundColor: c.okSoft }]}>
            <Text variant="caption" tone="ok">
              {notice}
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {mode === 'signup' ? (
            <Input
              label="Ad soyad"
              icon={UserRound}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          ) : null}
          <Input
            ref={emailRef}
            label="E-posta"
            icon={Mail}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType={mode === 'forgot' ? 'send' : 'next'}
            onSubmitEditing={() => (mode === 'forgot' ? void submit() : passwordRef.current?.focus())}
          />
          {mode !== 'forgot' ? (
            <Input
              ref={passwordRef}
              label="Şifre"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              hint={mode === 'signup' ? 'En az 8 karakter' : undefined}
            />
          ) : null}
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button
            title={mode === 'signin' ? 'Giriş yap' : mode === 'signup' ? 'Üye ol' : 'Sıfırlama bağlantısı gönder'}
            size="lg"
            loading={busy === 'email'}
            disabled={busy !== null}
            onPress={() => void submit()}
          />
          {mode === 'signin' ? (
            <Pressable onPress={() => setMode('forgot')} style={styles.link} hitSlop={8}>
              <Text variant="label" tone="primary">
                Şifremi unuttum
              </Text>
            </Pressable>
          ) : mode === 'forgot' ? (
            <Pressable onPress={() => setMode('signin')} style={styles.link} hitSlop={8}>
              <Text variant="label" tone="primary">
                Girişe dön
              </Text>
            </Pressable>
          ) : null}
        </View>

        {mode !== 'forgot' && config?.auth?.google && Platform.OS !== 'web' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: c.border }]} />
              <Text variant="caption" tone="subtle">
                veya
              </Text>
              <View style={[styles.line, { backgroundColor: c.border }]} />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void google()}
              style={({ pressed }) => [styles.google, { borderColor: c.border, backgroundColor: pressed ? c.elevated : c.surface }]}
            >
              <GoogleMark />
              <Text variant="bodyStrong">{busy === 'google' ? 'Bağlanıyor…' : 'Google ile devam et'}</Text>
            </Pressable>
          </>
        ) : null}

        {mode === 'signup' ? (
          <Text variant="caption" tone="subtle" center>
            Üye olarak{' '}
            <Text variant="caption" tone="primary" onPress={() => router.push({ pathname: '/sayfa/[slug]', params: { slug: 'uyelik' } })}>
              Üyelik Sözleşmesi
            </Text>{' '}
            ve{' '}
            <Text variant="caption" tone="primary" onPress={() => router.push({ pathname: '/sayfa/[slug]', params: { slug: 'kvkk' } })}>
              KVKK Aydınlatma Metni
            </Text>
            ’ni kabul etmiş olursunuz.
          </Text>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  close: { alignItems: 'flex-end', paddingHorizontal: space.sm },
  content: { paddingHorizontal: space.xl, gap: space.xl },
  brand: { alignItems: 'center', gap: space.sm, marginTop: space.sm },
  logo: { borderRadius: 16, borderWidth: hairline, overflow: 'hidden', alignSelf: 'center', marginBottom: space.sm },
  notice: { padding: space.md, borderRadius: radius.md },
  form: { gap: space.lg },
  link: { alignSelf: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: hairline },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
