import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, googleAuthEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/LogoMark";
import { safeRedirect } from "@/lib/auth/sign-in-gate";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: safeRedirect(search.redirect) } : {},
  head: () => ({
    meta: [
      { title: "Giriş Yap / Kayıt Ol | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const next = safeRedirect(redirect);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up" && !terms) {
      toast.error("Üyelik sözleşmesini kabul etmeden kayıt olunamaz.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await authClient.signUp.email({ email, password, name });
        if (error) throw new Error(error.message);
        toast.success("Hesap oluşturuldu");
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }
      window.location.href = next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4 py-12 pb-32">
      <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="size-10 text-brand" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GeldeSat hesabı</h1>
            <p className="text-sm text-muted">İlan, mesaj ve favori için giriş yapın.</p>
          </div>
        </div>
        {googleAuthEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full"
              onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: next })}
            >
              Google ile devam et
            </Button>
            <div className="my-6 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" />
              e-posta
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : <div className="mt-6" />}
        <div className="mb-4 flex rounded-lg bg-elevated p-1 text-sm">
          <button type="button" className={`flex-1 rounded-md py-2 ${mode === "in" ? "bg-surface font-medium shadow-card" : "text-muted"}`} onClick={() => setMode("in")}>
            Giriş
          </button>
          <button type="button" className={`flex-1 rounded-md py-2 ${mode === "up" ? "bg-surface font-medium shadow-card" : "text-muted"}`} onClick={() => setMode("up")}>
            Kayıt
          </button>
        </div>
        <form onSubmit={onEmail} className="space-y-3">
          {mode === "up" ? (
            <div>
              <Label htmlFor="signup-name">Ad Soyad</Label>
              <Input
                id="signup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız ve soyadınız"
                required
                minLength={2}
                autoComplete="name"
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="auth-email">E-posta</Label>
            <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="auth-password">Şifre</Label>
            <Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} />
            {mode === "in" ? (
              <Link to="/sifre-sifirla" className="mt-1 inline-block text-xs text-primary hover:underline">
                Şifremi unuttum
              </Link>
            ) : null}
          </div>
          {mode === "up" ? (
            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" className="mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
              <span>
                <Link to="/sayfa/$slug" params={{ slug: "uyelik" }} className="text-primary hover:underline">
                  Üyelik sözleşmesini
                </Link>{" "}
                ve{" "}
                <Link to="/sayfa/$slug" params={{ slug: "gizlilik" }} className="text-primary hover:underline">
                  gizlilik politikasını
                </Link>{" "}
                okudum, kabul ediyorum.
              </span>
            </label>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || (mode === "up" && !terms)}>
            {busy ? "Gönderiliyor…" : mode === "up" ? "Hesap oluştur" : "Giriş yap"}
          </Button>
        </form>
        {mode === "in" ? (
          <p className="mt-4 text-xs text-subtle">
            Kayıt olarak{" "}
            <Link to="/sayfa/$slug" params={{ slug: "uyelik" }} className="text-primary hover:underline">
              üyelik sözleşmesini
            </Link>{" "}
            ve{" "}
            <Link to="/sayfa/$slug" params={{ slug: "gizlilik" }} className="text-primary hover:underline">
              gizlilik politikasını
            </Link>{" "}
            kabul edersiniz.
          </p>
        ) : null}
      </div>
    </div>
  );
}
