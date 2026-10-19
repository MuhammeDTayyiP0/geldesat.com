import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Mail, UserX } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { changePassword, requestPasswordReset, sendVerificationEmail, signOut } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { formatDate } from '@/lib/format';
import { unregisterPush } from '@/lib/push';
import { Button, Card, Header, Input, ListRow, RowGroup, Sheet, Text, confirm, space, toast, useTheme } from '@/ui';

export default function SecuritySettings() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deletion = useQuery({ queryKey: keys.deletion, queryFn: account.deletionStatus });
  const email = session.status === 'signedIn' ? session.user.email : '';

  const submit = async () => {
    if (next.length < 8) return toast.error('Yeni şifre en az 8 karakter olmalı.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      toast.success('Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const purgeAt = deletion.data?.purgeAt;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Şifre ve güvenlik" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {purgeAt ? (
          <Card style={[styles.gap, { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft }]}>
            <Text variant="label" tone="danger">
              Hesabınız {formatDate(purgeAt)} tarihinde silinecek
            </Text>
            <Text variant="caption" tone="muted">
              İlanlarınız gizlendi. Bu tarihe kadar hesabınızı geri alabilirsiniz.
            </Text>
            <Button
              title="Hesabımı geri al"
              size="sm"
              onPress={async () => {
                try {
                  await account.restore();
                  await queryClient.invalidateQueries({ queryKey: keys.deletion });
                  toast.success('Hesabınız geri alındı');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            />
          </Card>
        ) : null}

        <View style={styles.gap}>
          <Text variant="subheading">Şifre değiştir</Text>
          <Input label="Mevcut şifre" secureTextEntry value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" />
          <Input
            label="Yeni şifre"
            secureTextEntry
            value={next}
            onChangeText={setNext}
            autoComplete="new-password"
            textContentType="newPassword"
            hint="En az 8 karakter"
          />
          <Button title="Şifreyi değiştir" loading={busy} disabled={!current || !next} onPress={() => void submit()} />
          <Text variant="caption" tone="subtle">
            Google ile giriş yaptıysanız şifreniz yoktur; aşağıdan e-postanıza şifre belirleme bağlantısı isteyebilirsiniz.
          </Text>
        </View>

        <RowGroup title="Hesap">
          <ListRow
            icon={KeyRound}
            label="Şifre belirleme bağlantısı gönder"
            detail={email}
            onPress={async () => {
              try {
                await requestPasswordReset(email);
                toast.success('Bağlantı e-postanıza gönderildi');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
          <ListRow
            icon={Mail}
            label="Doğrulama e-postasını tekrar gönder"
            onPress={async () => {
              try {
                await sendVerificationEmail(email);
                toast.success('Doğrulama e-postası gönderildi');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
          {!purgeAt ? <ListRow icon={UserX} label="Hesabımı sil" danger onPress={() => setDeleteOpen(true)} /> : null}
        </RowGroup>
      </KeyboardAwareScrollView>

      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={async () => {
          setDeleteOpen(false);
          await signOut(unregisterPush);
          toast.info('Hesabınız 30 gün içinde silinecek. Bu süre içinde giriş yaparak geri alabilirsiniz.');
          router.navigate('/');
        }}
      />
    </View>
  );
}

function DeleteAccountSheet({ visible, onClose, onDeleted }: { visible: boolean; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Hesabımı sil"
      footer={
        <Button
          title="Hesabımı sil"
          variant="danger"
          block
          style={styles.flex}
          loading={busy}
          onPress={async () => {
            const ok = await confirm({
              title: 'Emin misiniz?',
              message: 'İlanlarınız hemen gizlenir ve hesabınız 30 gün sonra kalıcı olarak silinir.',
              confirmText: 'Sil',
              destructive: true,
            });
            if (!ok) return;
            setBusy(true);
            try {
              await account.requestDeletion(password || undefined);
              setPassword('');
              await onDeleted();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Text tone="muted">
        Hesabınızı silmek istediğinizde ilanlarınız gizlenir, oturumlarınız kapanır. 30 gün içinde giriş yaparak hesabınızı geri alabilirsiniz; bu sürenin
        sonunda verileriniz kalıcı olarak silinir.
      </Text>
      <Input
        label="Şifreniz"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        hint="Google ile giriş yaptıysanız boş bırakın (son 24 saatte giriş yapmış olmalısınız)."
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  gap: { gap: space.md },
});
