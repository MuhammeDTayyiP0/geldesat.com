import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountShell } from "@/components/account/AccountShell";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ErrorState } from "@/components/common/ErrorState";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { errorText } from "@/lib/error-text";
import { getAccountSettings, updateUserPrefs } from "@/lib/server/settings";
import {
  BROWSE_SORT_LABELS,
  DEFAULT_USER_PREFS,
  type BrowsePrefs,
  type BrowseSort,
  type BrowseView,
  type SellerPrefs,
} from "@/lib/user-prefs";

export const Route = createFileRoute("/ayarlar/tercihler")({
  head: () => ({ meta: [{ title: "Alışveriş ve satıcı | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ShoppingAndSellerPrefs,
});

function ShoppingAndSellerPrefs() {
  const { user, isPending } = useCurrentUserState();
  const [browse, setBrowse] = useState<BrowsePrefs | null>(null);
  const [seller, setSeller] = useState<SellerPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    getAccountSettings()
      .then((s) => {
        setBrowse(s.user_prefs.browse_prefs);
        setSeller(s.user_prefs.seller_prefs);
      })
      .catch(() => setFailed(true));
  }, [user, retry]);

  if (failed) {
    return (
      <AccountShell title="Alışveriş ve satıcı">
        <ErrorState
          message="Tercihleriniz yüklenemedi. Tekrar deneyin."
          onRetry={() => {
            setFailed(false);
            setRetry((r) => r + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && (!browse || !seller))) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !browse || !seller) return <RedirectToSignIn />;

  async function saveBrowse(next: BrowsePrefs) {
    const prev = browse;
    setBrowse(next);
    setBusy(true);
    try {
      const res = await updateUserPrefs({ data: { browse_prefs: next } });
      setBrowse(res.user_prefs.browse_prefs);
      try {
        window.localStorage.setItem("gds_browse_prefs", JSON.stringify(res.user_prefs.browse_prefs));
      } catch {
        // ignore storage errors
      }
      toast.success("Kaydedildi");
    } catch (err) {
      setBrowse(prev);
      toast.error(errorText(err, "Kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  async function saveSeller(next: SellerPrefs, silent = false) {
    const prev = seller;
    setSeller(next);
    setBusy(true);
    try {
      const res = await updateUserPrefs({ data: { seller_prefs: next } });
      setSeller(res.user_prefs.seller_prefs);
      if (!silent) toast.success("Kaydedildi");
    } catch (err) {
      setSeller(prev);
      toast.error(errorText(err, "Kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Alışveriş ve satıcı" description="Arama varsayılanlarınızı ve alıcılarla iletişim kurallarınızı yönetin.">
      <div className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <h2 className="text-base font-semibold">Alışveriş ve arama varsayılanları</h2>
            <p className="mt-0.5 text-xs text-muted">Arama ve vitrin sayfalarında tercih ettiğiniz başlangıç ayarları.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bp-city">Varsayılan şehir</Label>
              <Select
                id="bp-city"
                value={browse.default_city}
                disabled={busy}
                onChange={(e) => void saveBrowse({ ...browse, default_city: e.target.value })}
              >
                <option value="">Tüm Türkiye</option>
                {TURKEY_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="bp-sort">Varsayılan sıralama</Label>
              <Select
                id="bp-sort"
                value={browse.default_sort}
                disabled={busy}
                onChange={(e) => void saveBrowse({ ...browse, default_sort: e.target.value as BrowseSort })}
              >
                {Object.entries(BROWSE_SORT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>İlan görünümü</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["grid", "Kart görünümü"],
                  ["list", "Liste görünümü"],
                ] as Array<[BrowseView, string]>
              ).map(([value, label]) => {
                const active = browse.default_view === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    onClick={() => void saveBrowse({ ...browse, default_view: value })}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-bg text-muted hover:bg-elevated"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <h2 className="text-base font-semibold">Satıcı iletişim tercihleri</h2>
            <p className="mt-0.5 text-xs text-muted">İlanlarınıza gelen teklifleri ve arama saatlerinizi belirleyin.</p>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-sm font-medium">Sohbette fiyat teklifi al</p>
              <p className="mt-0.5 text-xs text-muted">Kapatırsanız alıcılar ilanlarınıza doğrudan fiyat teklifi gönderemez.</p>
            </div>
            <ToggleSwitch
              label="Sohbette fiyat teklifi al"
              checked={seller.accept_offers}
              disabled={busy}
              onChange={(v) => void saveSeller({ ...seller, accept_offers: v })}
            />
          </div>

          <div className="space-y-3 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Aranabilir saat aralığı</p>
                <p className="mt-0.5 text-xs text-muted">Satıcı profilinizde alıcıların sizi arayabileceği saatleri gösterir.</p>
              </div>
              <ToggleSwitch
                label="Aranabilir saat aralığı"
                checked={seller.call_hours_enabled}
                disabled={busy}
                onChange={(v) => void saveSeller({ ...seller, call_hours_enabled: v })}
              />
            </div>
            {seller.call_hours_enabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sp-start">Başlangıç</Label>
                  <Input
                    id="sp-start"
                    type="time"
                    value={seller.call_hours_start}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSeller((prev) => (prev ? { ...prev, call_hours_start: v } : prev));
                      if (v) void saveSeller({ ...seller, call_hours_start: v }, true);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="sp-end">Bitiş</Label>
                  <Input
                    id="sp-end"
                    type="time"
                    value={seller.call_hours_end}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSeller((prev) => (prev ? { ...prev, call_hours_end: v } : prev));
                      if (v) void saveSeller({ ...seller, call_hours_end: v }, true);
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Müsait değil / Tatil modu</p>
                <p className="mt-0.5 text-xs text-muted">Profilinizin üstünde alıcılara bilgi notu gösterir.</p>
              </div>
              <ToggleSwitch
                label="Müsait değil modu"
                checked={seller.away_mode}
                disabled={busy}
                onChange={(v) =>
                  void saveSeller({
                    ...seller,
                    away_mode: v,
                    away_message: seller.away_message || DEFAULT_USER_PREFS.seller_prefs.away_message,
                  })
                }
              />
            </div>
            {seller.away_mode ? (
              <div>
                <Label htmlFor="sp-away-msg">Bilgi mesajı</Label>
                <Textarea
                  id="sp-away-msg"
                  value={seller.away_message}
                  onChange={(e) => setSeller({ ...seller, away_message: e.target.value.slice(0, 200) })}
                  onBlur={() => void saveSeller(seller)}
                  placeholder="Örn. Şu an şehir dışındayım, mesajlarınıza akşam dönüş yapacağım."
                  rows={2}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AccountShell>
  );
}
