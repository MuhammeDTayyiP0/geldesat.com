import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, RefreshCw, SearchX, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AccountShell } from "@/components/account/AccountShell";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { checkServerVersion, CURRENT_BUILD_ID } from "@/lib/app-version";
import { errorText } from "@/lib/error-text";
import { removeRecentListing } from "@/lib/server/social";

export const Route = createFileRoute("/ayarlar/depolama")({
  head: () => ({ meta: [{ title: "Veri ve depolama | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StorageSettings,
});

function StorageSettings() {
  const { user, isPending } = useCurrentUserState();
  const [clearingRecent, setClearingRecent] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  async function clearRecent() {
    setClearingRecent(true);
    try {
      await removeRecentListing({ data: { listingId: null } });
      toast.success("Son baktığınız ilanlar temizlendi");
    } catch (err) {
      toast.error(errorText(err, "Temizlenemedi"));
    } finally {
      setClearingRecent(false);
    }
  }

  function clearSearchHistory() {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && (k.includes("search") || k.includes("recent_q") || k.includes("gds_search"))) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) window.localStorage.removeItem(k);
      toast.success("Bu tarayıcıdaki arama geçmişi temizlendi");
    } catch {
      toast.error("Arama geçmişi temizlenemedi");
    }
  }

  async function checkUpdates() {
    setCheckingUpdate(true);
    try {
      const { outdated } = await checkServerVersion();
      if (outdated) {
        toast.info("Yeni sürüm bulundu, sayfa yenileniyor…");
        setTimeout(() => window.location.reload(), 500);
        return;
      }
      toast.success("Güncel sürümü kullanıyorsunuz");
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <AccountShell title="Veri ve depolama" description="Geçmişinizi temizleyin ve uygulama sürümünü kontrol edin.">
      <div className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <History className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Son baktıklarım</h2>
              <p className="mt-0.5 text-xs text-muted">Hesabınızdaki son incelenen 50 ilan geçmişini temizler.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={clearingRecent} onClick={() => void clearRecent()}>
            {clearingRecent ? "Temizleniyor…" : "Geçmişi temizle"}
          </Button>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <SearchX className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Yerel arama geçmişi</h2>
              <p className="mt-0.5 text-xs text-muted">Bu tarayıcıda kaydedilen son arama önerilerini siler.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearSearchHistory}>
            Aramaları sil
          </Button>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Web uygulama sürümü</h2>
              <p className="mt-0.5 text-xs text-muted">
                Yapı kodu: <span className="font-mono text-fg">{CURRENT_BUILD_ID}</span>. Ana ekrana eklediğinizde eski sürüm kalırsa buradan tazeleyebilirsiniz.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={checkingUpdate} onClick={() => void checkUpdates()}>
              {checkingUpdate ? "Kontrol ediliyor…" : "Güncellemeyi kontrol et"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" /> Yenile
            </Button>
          </div>
        </section>
      </div>
    </AccountShell>
  );
}
