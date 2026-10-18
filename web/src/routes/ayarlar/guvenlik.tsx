import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Laptop, Mail, MailWarning, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { timeAgo } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/guvenlik")({
  head: () => ({ meta: [{ title: "Hesap ve güvenlik | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SecuritySettings,
});

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

  async function loadSessions() {
    const { data } = await authClient.listSessions();
    setSessions((data as SessionRow[] | null) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    authClient
      .listAccounts()
      .then(({ data }) => setHasPassword(Boolean(data?.some((a) => a.providerId === "credential"))))
      .catch(() => setHasPassword(true));
    void loadSessions().catch(() => setSessions([]));
  }, [user]);

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const verified = Boolean(session?.user?.emailVerified);
  const currentToken = session?.session?.token;

  async function sendVerification() {
    if (!user?.primaryEmail) return;
    setVerifyBusy(true);
    try {
      const { error } = await authClient.sendVerificationEmail({ email: user.primaryEmail, callbackURL: "/ayarlar/guvenlik" });
      if (error) throw new Error(error.message || "Gönderilemedi");
      toast.success("Doğrulama bağlantısı e-postanıza gönderildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Doğrulama e-postası gönderilemedi");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function signOutOthers() {
    const { error } = await authClient.revokeOtherSessions();
    if (error) return toast.error(error.message || "Oturumlar kapatılamadı");
    toast.success("Diğer cihazlardaki oturumlar kapatıldı");
    void loadSessions();
  }

  return (
    <AccountShell title="Hesap ve güvenlik" description="Giriş bilgileriniz ve açık oturumlarınız.">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">E-posta</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <Mail className="size-4 shrink-0 text-muted" />
              <span className="truncate font-medium">{user.primaryEmail}</span>
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
              <span>Doğrulanmış e-posta, Google ile giriş ve şifre kurtarma için gereklidir.</span>
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
          <PasswordForm onChanged={() => void loadSessions()} />
        )}

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Açık oturumlar</h2>
            {sessions && sessions.length > 1 ? (
              <Button size="sm" variant="outline" onClick={() => void signOutOthers()}>
                Diğer cihazlardan çıkış yap
              </Button>
            ) : null}
          </div>
          {sessions === null ? (
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
                      <p className="text-xs text-muted">Son etkinlik: {timeAgo(String(s.updatedAt))}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
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
      if (error) throw new Error(error.status === 400 || error.status === 401 ? "Mevcut şifre hatalı." : error.message || "Şifre değiştirilemedi");
      toast.success(others ? "Şifre güncellendi, diğer cihazlardan çıkış yapıldı" : "Şifre güncellendi");
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
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
