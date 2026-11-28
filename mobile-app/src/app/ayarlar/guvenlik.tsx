import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useQuery } from '@tanstack/react-query';
import { Download, KeyRound, Laptop, LogOut, Mail, Pencil, Smartphone, UserX } from 'lucide-react-native';
import { ApiError, errorMessage, timedFetch } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { changePassword, requestPasswordReset, sendVerificationEmail, signOut, signOutOtherDevices } from '@/auth/auth';
import { clearSession, getToken, useSession } from '@/auth/session';
import { clearLocalPushRegistration } from '@/lib/push';
import { API_BASE_URL, SITE_URL } from '@/lib/config';
import { exportAccountData } from '@/features/account/exportData';
import { formatDate, timeAgo } from '@/lib/format';
import { Badge, Button, Card, Header, Input, ListRow, RowGroup, Sheet, Text, confirm, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

type AuthSessionPayload = {
  session?: { id?: string; token?: string };
  user?: { id?: string; email?: string; emailVerified?: boolean };
} | null;

type AuthAccount = { id: string; providerId: string };

type AuthSessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: string;
  createdAt: string;
};

const AUTH_ORIGIN_HEADERS = { Origin: SITE_URL, Referer: `${SITE_URL}/` };

async function authFetch<T>(path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (!token) throw new ApiError('Oturum süresi doldu, lütfen yeniden giriş yapın.', 401);
  const response = await timedFetch(`${API_BASE_URL}/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', ...AUTH_ORIGIN_HEADERS }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response.json().catch(() => null)) as ({ message?: string; error?: string } & T) | null;
  if (response.status === 401 && getToken() === token) {
    void clearSession();
    void clearLocalPushRegistration();
  }
  if (!response.ok) {
    throw new ApiError(data?.message || data?.error || 'İşlem tamamlanamadı.', response.status);
  }
  return (data ?? null) as T;
}

function deviceLabel(ua: string | null | undefined): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Bilinmeyen cihaz', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Tarayıcı';
  return { label: [browser, os].filter(Boolean).join(' · '), mobile };
}

export default function SecuritySettingsScreen() {
  return (
    <RequireSignIn title="Hesap ve güvenlik">
      <SecuritySettings />
    </RequireSignIn>
  );
}

function SecuritySettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const deletion = useQuery({ queryKey: keys.deletion, queryFn: account.deletionStatus });
  const authSession = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => authFetch<AuthSessionPayload>('/get-session'),
  });
  const accounts = useQuery({
    queryKey: ['auth', 'accounts'],
    queryFn: () => authFetch<AuthAccount[]>('/list-accounts'),
  });
  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authFetch<AuthSessionRow[]>('/list-sessions'),
  });

  const email = authSession.data?.user?.email || (session.status === 'signedIn' ? session.user.email : '');
  const emailVerified = authSession.data?.user?.emailVerified;
  const hasPassword = accounts.data ? accounts.data.some((a) => a.providerId === 'credential') : true;
  const currentToken = authSession.data?.session?.token ?? getToken();

  const submit = async () => {
    if (next.length < 8) return toast.error('Yeni şifre en az 8 karakter olmalı.');
    if (next !== repeat) return toast.error('Yeni şifreler aynı değil.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success('Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (token: string) => {
    setRevokingToken(token);
    try {
      await authFetch('/revoke-session', { token });
      toast.success('Oturum kapatıldı');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRevokingToken(null);
    }
  };

  const purgeAt = deletion.data?.purgeAt;

  const downloadMyData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportAccountData();
    } catch (e) {
      toast.error(errorMessage(e, 'Verileriniz indirilemedi.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Hesap ve güvenlik" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
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
                  // The listings are back: everything showing them refreshes.
                  void queryClient.invalidateQueries({ queryKey: keys.myListings });
                  void queryClient.invalidateQueries({ queryKey: keys.me });
                  toast.success('Hesabınız geri alındı');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            />
          </Card>
        ) : null}

        <RowGroup title="E-posta">
          <ListRow
            icon={Mail}
            label={email || 'E-posta'}
            right={
              emailVerified === true ? (
                <Badge label="Doğrulandı" tone="ok" />
              ) : emailVerified === false ? (
                <Badge label="Doğrulanmadı" tone="warn" />
              ) : undefined
            }
          />
          <ListRow icon={Pencil} label="E-posta adresini değiştir" onPress={() => setEmailSheetOpen(true)} />
          {emailVerified === false ? (
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
          ) : null}
        </RowGroup>

        {hasPassword ? (
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
            <Input
              label="Yeni şifre (tekrar)"
              secureTextEntry
              value={repeat}
              onChangeText={setRepeat}
              autoComplete="new-password"
              textContentType="newPassword"
              error={repeat && next !== repeat ? 'Şifreler aynı değil' : null}
            />
            <Button title="Şifreyi değiştir" loading={busy} disabled={!current || !next || !repeat} onPress={() => void submit()} />
          </View>
        ) : (
          <Card style={styles.gap}>
            <Text variant="subheading">Şifre</Text>
            <Text variant="caption" tone="muted">
              Google ile giriş yapıyorsunuz, hesabınızın henüz bir şifresi yok. Aşağıdan e-postanıza şifre belirleme bağlantısı gönderebilirsiniz.
            </Text>
          </Card>
        )}

        <RowGroup title="Açık oturumlar">
          {sessions.isLoading ? (
            <ListRow label="Oturumlar yükleniyor…" />
          ) : sessions.isError ? (
            <ListRow label="Oturumlar yüklenemedi" detail="Tekrar denemek için dokunun" onPress={() => void sessions.refetch()} />
          ) : (sessions.data ?? []).length ? (
            (sessions.data ?? []).map((s) => {
              const d = deviceLabel(s.userAgent);
              const isCurrent = !!currentToken && s.token === currentToken;
              return (
                <ListRow
                  key={s.id}
                  icon={d.mobile ? Smartphone : Laptop}
                  label={d.label}
                  detail={`Son yenileme: ${timeAgo(s.updatedAt)}`}
                  right={
                    isCurrent ? (
                      <Badge label="Bu cihaz" tone="primary" />
                    ) : (
                      <Button
                        title="Kapat"
                        size="sm"
                        variant="ghost"
                        loading={revokingToken === s.token}
                        onPress={() => void revokeSession(s.token)}
                      />
                    )
                  }
                />
              );
            })
          ) : (
            <ListRow label="Aktif oturum bulunamadı" />
          )}
        </RowGroup>

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
            icon={LogOut}
            label="Diğer cihazlardan çıkış yap"
            detail="Bu telefon dışındaki tüm oturumlar kapanır"
            onPress={async () => {
              const ok = await confirm({
                title: 'Diğer cihazlardan çıkış yapılsın mı?',
                message: 'Başka telefon ve bilgisayarlardaki GeldeSat oturumlarınız kapanır; oralara bildirim gitmez.',
                confirmText: 'Çıkış yap',
              });
              if (!ok) return;
              try {
                await signOutOtherDevices();
                void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
                toast.success('Diğer cihazlardaki oturumlar kapatıldı.');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
          <ListRow
            icon={Download}
            label={exporting ? 'Verileriniz hazırlanıyor…' : 'Verilerimi indir (KVKK)'}
            detail="Profil, ilan, mesaj ve favorileriniz (JSON)"
            disabled={exporting}
            onPress={() => void downloadMyData()}
          />
          {!purgeAt ? <ListRow icon={UserX} label="Hesabımı sil" danger onPress={() => setDeleteOpen(true)} /> : null}
        </RowGroup>
      </KeyboardAwareScrollView>

      <ChangeEmailSheet visible={emailSheetOpen} onClose={() => setEmailSheetOpen(false)} />

      <DeleteAccountSheet
        visible={deleteOpen}
        hasPassword={hasPassword}
        onClose={() => setDeleteOpen(false)}
        onDeleted={async () => {
          await signOut();
          toast.info('Hesabınız 30 gün sonra silinecek. Vazgeçerseniz giriş yapıp Ayarlar → Şifre ve güvenlik bölümünden geri alın.');
          router.navigate('/');
        }}
      />
    </View>
  );
}

function ChangeEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return toast.error('Geçerli bir e-posta adresi girin.');
    setBusy(true);
    try {
      await authFetch('/change-email', { newEmail: trimmed, callbackURL: `${SITE_URL}/ayarlar/guvenlik` });
      toast.success('Onay bağlantısı gönderildi. Değişiklik onaylanınca geçerli olur.');
      setNewEmail('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="E-posta adresini değiştir"
      subtitle="Yeni adresinize onay bağlantısı gönderilir."
      footer={
        <Button
          title="Onay bağlantısı gönder"
          block
          style={styles.flex}
          loading={busy}
          disabled={!newEmail.trim()}
          onPress={() => void submit()}
        />
      }
    >
      <Input
        label="Yeni e-posta adresi"
        placeholder="ornek@eposta.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={newEmail}
        onChangeText={setNewEmail}
      />
    </Sheet>
  );
}

const CONFIRM_WORD = 'SİL';

function DeleteAccountSheet({
  visible,
  hasPassword,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  hasPassword: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const deletedRef = useRef(false);
  const wordOk = word.trim().toLocaleUpperCase('tr').replace(/I/g, 'İ') === CONFIRM_WORD;
  const ready = wordOk && (!hasPassword || password.length > 0);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        setPassword('');
        setWord('');
        setConfirmStep(false);
        if (!deletedRef.current) return;
        deletedRef.current = false;
        void onDeleted();
      }}
      title="Hesabımı sil"
      footer={
        <Button
          title={confirmStep ? 'Evet, hesabımı kalıcı sil' : 'Hesabımı sil'}
          variant="danger"
          block
          style={styles.flex}
          disabled={!ready || busy}
          loading={busy}
          onPress={async () => {
            if (!ready) return;
            if (!confirmStep) {
              setConfirmStep(true);
              return;
            }
            setBusy(true);
            try {
              await account.requestDeletion(hasPassword ? password : undefined);
              setPassword('');
              setWord('');
              setConfirmStep(false);
              deletedRef.current = true;
              onClose();
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
        İlanlarınız hemen gizlenir ve tüm oturumlarınız kapanır. 30 gün içinde vazgeçerseniz giriş yapıp Ayarlar → Şifre ve güvenlik bölümünden
        hesabınızı geri alabilirsiniz; giriş yapmak tek başına geri almaz. Bu sürenin sonunda verileriniz kalıcı olarak silinir.
      </Text>
      {hasPassword ? (
        <Input
          label="Şifreniz"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      ) : (
        <Text variant="caption" tone="muted">
          Google ile giriş yaptıysanız şifre gerekmez (son 24 saatte giriş yapmış olmalısınız).
        </Text>
      )}
      <Input
        label="Onaylamak için SİL yazın"
        placeholder="SİL"
        autoCapitalize="characters"
        autoCorrect={false}
        value={word}
        onChangeText={setWord}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  gap: { gap: space.md },
});
