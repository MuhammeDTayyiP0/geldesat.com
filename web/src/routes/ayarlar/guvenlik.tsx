import { authErrorText } from "@/lib/auth/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Download, Laptop, Mail, MailWarning, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { requestMyAccountDeletion } from "@/lib/server/settings";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { timeAgo } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/guvenlik")({
  head: () => ({ meta: [{ title: "Hesap ve güvenlik | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SecuritySettings,
});

const CONFIRM_WORD = "SİL";

type SessionRow = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; updatedAt: Date | string; createdAt: Date | string };

function deviceLabel(ua: string | null | undefined): { label: string; mobile: boolean } {
  if (!ua) return { label: "Bilinmeyen cihaz", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Tarayıcı";
  return { label: [browser, os].filter(Boolean).join(" · "), mobile };
}

function SecuritySettings() {
  const { user, isPending } = useCurrentUserState();
  const { data: session } = authClient.useSession();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function downloadMyData() {
    setDownloading(true);
    try {
      const res = await fetch("/api/hesap/verilerim");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || (res.status === 429 ? "Çok sık indirme denediniz. Biraz sonra tekrar deneyin." : "Verileriniz hazırlanamadı."));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "geldesat-verilerim.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(errorText(err, "Verileriniz indirilemedi"));
    } finally {
      setDownloading(false);
    }
  }

  async function loadSessions() {
    const { data, error } = await authClient.listSessions();
    if (error) throw new Error(authErrorText(error));
    setSessionsFailed(false);
    setSessions((data as SessionRow[] | null) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    authClient
      .listAccounts()
      .then(({ data, error }) => setHasPassword(error ? true : Boolean(data?.some((a) => a.providerId === "credential"))))
      .catch(() => setHasPassword(true));
    void loadSessions().catch(() => setSessionsFailed(true));
  }, [user]);

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const verified = Boolean(session?.user?.emailVerified);
  const currentToken = session?.session?.token;

  async function sendVerification() {
    if (!user?.primaryEmail) return;
    setVerifyBusy(true);
    try {
      const { error } = await authClient.sendVerificationEmail({ email: user.primaryEmail, callbackURL: "/login?verified=1&redirect=/ayarlar/guvenlik" });
      if (error) throw new Error(authErrorText(error, "Gönderilemedi"));
      toast.success("Doğrulama bağlantısı e-postanıza gönderildi");
    } catch (err) {
      toast.error(errorText(err, "Doğrulama e-postası gönderilemedi"));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function submitEmailChange(e: FormEvent) {
    e.preventDefault();
    const next = newEmail.trim();
    if (!next) return;
    setEmailBusy(true);
    try {
      const { error } = await authClient.changeEmail({ newEmail: next, callbackURL: "/ayarlar/guvenlik" });
      if (error) return toast.error(authErrorText(error, "E-posta değiştirilemedi"));
      toast.success("Onay bağlantısı gönderildi. Değişiklik onaylanınca geçerli olur.");
      setEmailOpen(false);
      setNewEmail("");
    } catch (err) {
      toast.error(errorText(err, "E-posta değiştirilemedi"));
    } finally {
      setEmailBusy(false);
    }
  }

  async function closeSession(token: string) {
    setSessionBusy(token);
    try {
      const { error } = await authClient.revokeSession({ token });
      if (error) return toast.error(authErrorText(error, "Oturum kapatılamadı"));
      toast.success("Oturum kapatıldı");
      void loadSessions().catch(() => setSessionsFailed(true));
    } catch (err) {
      toast.error(errorText(err, "Oturum kapatılamadı"));
    } finally {
      setSessionBusy(null);
    }
  }

  async function signOutOthers() {
    setSessionBusy("all");
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) return toast.error(authErrorText(error, "Oturumlar kapatılamadı"));
      toast.success("Diğer cihazlardaki oturumlar kapatıldı");
      void loadSessions().catch(() => setSessionsFailed(true));
    } catch (err) {
      toast.error(errorText(err, "Oturumlar kapatılamadı"));
    } finally {
      setSessionBusy(null);
    }
  }

  return (
    <AccountShell title="Hesap ve güvenlik" description="Giriş bilgileriniz, açık oturumlarınız, kişisel verileriniz ve hesap kapatma.">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">E-posta</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <Mail className="size-4 shrink-0 text-muted" />
              <span className="truncate font-medium">{user.primaryEmail}</span>
              <button
                type="button"
                onClick={() => {
                  setNewEmail("");
                  setEmailOpen(true);
                }}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Değiştir
              </button>
            </p>
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok">
                <CheckCircle2 className="size-3.5" /> Doğrulandı
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-1 text-xs font-medium text-warn">
                <MailWarning className="size-3.5" /> Doğrulanmadı
              </span>
            )}
          </div>
          {!verified ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-elevated/70 p-3 text-sm text-muted">
              <span>Doğrulanmış e-posta, Google ile giriş ve okunmamış mesaj e-postaları için gereklidir.</span>
              <Button size="sm" variant="outline" disabled={verifyBusy} onClick={() => void sendVerification()}>
                {verifyBusy ? "Gönderiliyor…" : "Doğrulama e-postası gönder"}
              </Button>
            </div>
          ) : null}
        </section>

        {hasPassword === false ? (
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
            <h2 className="text-base font-semibold">Şifre</h2>
            <p className="mt-2 text-sm text-muted">
              Google ile giriş yapıyorsunuz, hesabınızın şifresi yok. Şifre belirlemek için{" "}
              <Link to="/sifre-sifirla" className="font-medium text-primary hover:underline">
                şifre sıfırlama
              </Link>{" "}
              sayfasını kullanabilirsiniz.
            </p>
          </section>
        ) : (
          <PasswordForm onChanged={() => void loadSessions().catch(() => setSessionsFailed(true))} />
        )}

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Açık oturumlar</h2>
            {sessions && sessions.length > 1 ? (
              <Button size="sm" variant="outline" disabled={sessionBusy !== null} onClick={() => void signOutOthers()}>
                Diğer cihazlardan çıkış yap
              </Button>
            ) : null}
          </div>
          {sessionsFailed ? (
            <p className="mt-3 text-sm text-danger">Oturumlar yüklenemedi.</p>
          ) : sessions === null ? (
            <p className="mt-3 text-sm text-muted">Yükleniyor…</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {sessions.map((s) => {
                const d = deviceLabel(s.userAgent);
                const Icon = d.mobile ? Smartphone : Laptop;
                const current = s.token === currentToken;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Icon className="size-5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {d.label}
                        {current ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Bu cihaz</span> : null}
                      </p>
                      <p className="text-xs text-muted">Son oturum yenileme: {timeAgo(String(s.updatedAt))}</p>
                    </div>
                    {current ? null : (
                      <Button size="sm" variant="ghost" disabled={sessionBusy !== null} onClick={() => void closeSession(s.token)}>
                        Kapat
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Verilerimi indir</h2>
          <p className="mt-1 text-sm text-muted">
            Profiliniz, ilanlarınız, mesajlarınız, favorileriniz, değerlendirmeleriniz ve bildirimleriniz tek bir dosya (JSON) olarak
            indirilir. KVKK kapsamındaki bilgi edinme hakkınızdır.
          </p>
          <Button type="button" variant="outline" className="mt-4" disabled={downloading} onClick={() => void downloadMyData()}>
            <Download className="size-4" /> {downloading ? "Hazırlanıyor…" : "Verilerimi indir"}
          </Button>
        </section>

        <section className="rounded-2xl border border-danger/30 bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold text-danger">Hesabı sil</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">1</span>
              <span>
                <span className="font-medium">Hemen:</span> <span className="text-muted">oturumunuz kapanır, profiliniz, ilanlarınız ve mağazanız gizlenir.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">2</span>
              <span>
                <span className="font-medium">30 gün içinde:</span>{" "}
                <span className="text-muted">tekrar giriş yapıp “Hesabımı geri al” derseniz her şey eski haline döner.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">3</span>
              <span>
                <span className="font-medium">30 gün sonra:</span>{" "}
                <span className="text-muted">
                  hesabınız, ilanlarınız, fotoğraflarınız, favorileriniz, bildirimleriniz ve mağazanız kalıcı olarak silinir.
                </span>
              </span>
            </li>
          </ol>
          <p className="mt-4 rounded-xl bg-elevated/70 p-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-fg">Mesajlar:</span> yazıştığınız kişiler kendi sohbet geçmişlerini görmeye devam eder; siz
            “Silinmiş kullanıcı” olarak görünürsünüz. Bir sohbet iki taraftan da kalktığında (silindiğinde veya hesaplar kapandığında) 60 gün daha
            kimseye gösterilmeden saklanır, ardından tamamen silinir. Yazdığınız satıcı değerlendirmeleri de “Silinmiş kullanıcı” adıyla kalır.
          </p>
          <p className="mt-3 text-sm text-muted">Silmeden önce verilerinizi indirmenizi öneririz.</p>
          <Button type="button" variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Hesabımı sil
          </Button>
        </section>
      </div>

      <DeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} needsPassword={hasPassword !== false} />

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <form onSubmit={(e) => void submitEmailChange(e)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>E-posta adresini değiştir</DialogTitle>
              <DialogDescription>Yeni adresinize onay bağlantısı gönderilir. Onayladığınızda yeni adresiniz geçerli olur.</DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="new-email-input">Yeni e-posta adresi</Label>
              <Input
                id="new-email-input"
                type="email"
                autoComplete="email"
                placeholder="ornek@eposta.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={emailBusy || !newEmail.trim()}>
                {emailBusy ? "Gönderiliyor…" : "Onay bağlantısı gönder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("Yeni şifre en az 8 karakter olmalı.");
    if (next !== confirm) return toast.error("Yeni şifreler eşleşmiyor.");
    if (next === current) return toast.error("Yeni şifre eskisiyle aynı olamaz.");
    setBusy(true);
    try {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: others });
      if (error) throw new Error(error.status === 400 || error.status === 401 ? "Mevcut şifre hatalı." : authErrorText(error, "Şifre değiştirilemedi"));
      toast.success(others ? "Şifre güncellendi, diğer cihazlardan çıkış yapıldı" : "Şifre güncellendi");
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged();
    } catch (err) {
      toast.error(errorText(err, "Şifre değiştirilemedi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
      <h2 className="text-base font-semibold">Şifre değiştir</h2>
      <div>
        <Label htmlFor="pw-current">Mevcut şifre</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pw-new">Yeni şifre</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Yeni şifre (tekrar)</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="size-4 accent-primary" />
        Diğer cihazlardaki oturumları kapat
      </label>
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? "Güncelleniyor…" : "Şifreyi güncelle"}
        </Button>
      </div>
    </form>
  );
}

function DeleteDialog({ open, onOpenChange, needsPassword }: { open: boolean; onOpenChange: (o: boolean) => void; needsPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  // A cancelled dialog must not keep the typed password around.
  useEffect(() => {
    if (open) return;
    setPassword("");
    setWord("");
  }, [open]);
  const ready = word.trim().toLocaleUpperCase("tr").replace(/I/g, "İ") === CONFIRM_WORD && (!needsPassword || password.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await requestMyAccountDeletion({ data: needsPassword ? { password } : {} });
      // The server already ended every session; clear this browser's cookies too.
      await authClient.signOut().catch(() => undefined);
      toast.success("Hesabınız 30 gün içinde silinecek. Bu sürede giriş yapıp sitedeki “Hesabımı geri al” düğmesine basarak geri alabilirsiniz.");
      setTimeout(() => (window.location.href = "/"), 1200);
    } catch (err) {
      toast.error(errorText(err, "Hesap silinemedi"));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Hesabınız silinsin mi?</DialogTitle>
            <DialogDescription>Hesabınız hemen gizlenir ve 30 gün sonra kalıcı olarak silinir. Bu süre içinde giriş yapıp “Hesabımı geri al” düğmesine basarak geri alabilirsiniz.</DialogDescription>
          </DialogHeader>
          {needsPassword ? (
            <div>
              <Label htmlFor="del-password">Şifreniz</Label>
              <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="del-word">
              Onaylamak için <span className="font-bold">{CONFIRM_WORD}</span> yazın
            </Label>
            <Input id="del-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" disabled={!ready || busy}>
              {busy ? "İşleniyor…" : "Hesabımı sil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
