import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/LogoMark";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/sifre-sifirla")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    ...(typeof search.token === "string" ? { token: search.token } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  head: () => ({
    meta: [{ title: "Şifre Sıfırla | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token, error } = Route.useSearch();
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4 py-12 pb-32">
      <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="size-10 text-brand" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Şifre sıfırlama</h1>
            <p className="text-sm text-muted">
              {token ? "Hesabınız için yeni bir şifre belirleyin." : "E-posta adresinize sıfırlama bağlantısı gönderelim."}
            </p>
          </div>
        </div>
        {error ? (
          <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.
          </p>
        ) : null}
        {token && !error ? <NewPasswordForm token={token} /> : <RequestForm />}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Girişe dön
          </Link>
        </p>
      </div>
    </div>
  );
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İstek gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-muted">
        Bu adresle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı birkaç dakika içinde gelecek. Gereksiz
        klasörünü de kontrol edin.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="reset-email">E-posta</Label>
        <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </Button>
    </form>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) throw new Error(error.message);
      toast.success("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
      window.location.href = "/login";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="new-password">Yeni şifre</Label>
        <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="new-password-repeat">Yeni şifre (tekrar)</Label>
        <Input id="new-password-repeat" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Kaydediliyor…" : "Şifreyi güncelle"}
      </Button>
    </form>
  );
}
