import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CheckCircle2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { Button, Card, Header, Input, Text, radius, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const CATEGORIES = [
  { value: 'bug', label: 'Hata bildir' },
  { value: 'suggestion', label: 'Özellik önerisi' },
  { value: 'account', label: 'Hesap / ilan desteği' },
  { value: 'other', label: 'Diğer' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

export default function FeedbackScreen() {
  return (
    <RequireSignIn title="Geri bildirim">
      <FeedbackForm />
    </RequireSignIn>
  );
}

function FeedbackForm() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [category, setCategory] = useState<Category>('suggestion');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 10) return toast.error('Lütfen en az 10 karakter yazın.');
    setBusy(true);
    try {
      await account.submitFeedback({
        category,
        message: message.trim(),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        app_version: Constants.expoConfig?.version ?? undefined,
      });
      setSent(true);
      setMessage('');
      toast.success('Geri bildiriminiz için teşekkürler!');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Geri bildirim" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        {sent ? (
          <Card style={styles.sentCard}>
            <CheckCircle2 size={36} color={c.ok} />
            <Text variant="subheading" center>
              Mesajınız alındı
            </Text>
            <Text variant="caption" tone="muted" center>
              Değerli geri bildiriminiz için teşekkür ederiz.
            </Text>
            <Button title="Yeni mesaj gönder" variant="outline" onPress={() => setSent(false)} />
          </Card>
        ) : (
          <>
            <View style={styles.catWrap}>
              <Text variant="label">Konu</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((item) => {
                  const active = category === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => setCategory(item.value)}
                      style={[
                        styles.catBtn,
                        { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface },
                      ]}
                    >
                      <Text variant="label" style={{ color: active ? c.primary : c.muted }} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label="Mesajınız"
              required
              multiline
              placeholder="Karşılaştığınız hatayı veya önerinizi yazın…"
              value={message}
              onChangeText={setMessage}
              maxLength={1500}
              hint={`${message.length}/1500`}
            />

            <Button title="Gönder" size="lg" loading={busy} disabled={message.trim().length < 10} onPress={() => void submit()} />
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  sentCard: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  catWrap: { gap: space.xs },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catBtn: { width: '48%', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.md, borderWidth: 1.5 },
});
