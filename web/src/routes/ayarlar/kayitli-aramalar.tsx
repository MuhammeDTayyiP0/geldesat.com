import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountShell } from "@/components/account/AccountShell";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ErrorState } from "@/components/common/ErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFlag } from "@/lib/use-flag";
import { errorText } from "@/lib/error-text";
import { parseSearch, type CatalogSearch } from "@/lib/search-params";
import {
  deleteSavedSearch,
  listSavedSearches,
  toggleSavedSearchNotify,
  type SavedSearch,
} from "@/lib/server/saved-searches";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/ayarlar/kayitli-aramalar")({
  head: () => ({ meta: [{ title: "Kayıtlı aramalarım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SavedSearchesPage,
});

function filterString(filters: SavedSearch["filters"], key: string): string | undefined {
  const val = filters[key];
  if (val === true) return "1";
  if (typeof val === "string" && val) return val;
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return undefined;
}

function summarizeSavedSearch(s: SavedSearch): string[] {
  const parts: string[] = [];
  if (s.q) parts.push(`“${s.q}”`);
  if (s.category_slug) parts.push(`Kategori: ${s.category_slug}`);
  const location = [filterString(s.filters, "neighborhood"), s.district, s.city].filter(Boolean).join(", ");
  if (location) parts.push(location);
  if (s.min_price != null || s.max_price != null) {
    const min = s.min_price != null ? formatPrice(s.min_price) : "0 ₺";
    const max = s.max_price != null ? formatPrice(s.max_price) : "∞";
    parts.push(`Fiyat: ${min} - ${max}`);
  }
  const minYear = filterString(s.filters, "minYear");
  const maxYear = filterString(s.filters, "maxYear");
  if (minYear || maxYear) parts.push(`Yıl: ${minYear ?? "Min"} - ${maxYear ?? "Max"}`);

  const minKm = filterString(s.filters, "minKm");
  const maxKm = filterString(s.filters, "maxKm");
  if (minKm || maxKm) parts.push(`KM: ${minKm ? formatNumber(Number(minKm)) : "0"} - ${maxKm ? formatNumber(Number(maxKm)) : "∞"}`);

  const minM2 = filterString(s.filters, "minM2");
  const maxM2 = filterString(s.filters, "maxM2");
  if (minM2 || maxM2) parts.push(`m²: ${minM2 ?? "0"} - ${maxM2 ?? "∞"}`);

  if (filterString(s.filters, "urgent") === "1") parts.push("Acil satılık");
  if (filterString(s.filters, "featured") === "1") parts.push("Vitrin");
  if (filterString(s.filters, "priceDropped") === "1") parts.push("Fiyatı düşenler");
  if (filterString(s.filters, "withPhotos") === "1") parts.push("Fotoğraflı");

  const sellerType = filterString(s.filters, "sellerType");
  if (sellerType === "store") parts.push("Mağazadan");
  else if (sellerType === "owner") parts.push("Sahibinden");

  const postedWithin = filterString(s.filters, "postedWithin");
  if (postedWithin) parts.push(`Son ${postedWithin} gün`);

  return parts.length ? parts : ["Tüm ilanlar"];
}

function toSearchParams(s: SavedSearch): CatalogSearch {
  const raw: Record<string, unknown> = {
    q: s.q ?? undefined,
    category: s.category_slug ?? undefined,
    city: s.city ?? undefined,
    district: s.district ?? undefined,
    minPrice: s.min_price != null ? String(s.min_price) : undefined,
    maxPrice: s.max_price != null ? String(s.max_price) : undefined,
    neighborhood: filterString(s.filters, "neighborhood"),
    sort: filterString(s.filters, "sort"),
    minYear: filterString(s.filters, "minYear"),
    maxYear: filterString(s.filters, "maxYear"),
    minKm: filterString(s.filters, "minKm"),
    maxKm: filterString(s.filters, "maxKm"),
    minM2: filterString(s.filters, "minM2"),
    maxM2: filterString(s.filters, "maxM2"),
    urgent: filterString(s.filters, "urgent"),
    featured: filterString(s.filters, "featured"),
    postedWithin: filterString(s.filters, "postedWithin"),
    withPhotos: filterString(s.filters, "withPhotos"),
    sellerType: filterString(s.filters, "sellerType"),
    priceDropped: filterString(s.filters, "priceDropped"),
    attrs: filterString(s.filters, "attrs"),
  };
  return parseSearch(raw);
}

function SavedSearchesPage() {
  const kayitliAramalar = useFlag("kayitli_aramalar");
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user || !kayitliAramalar) return;
    let alive = true;
    listSavedSearches()
      .then((rows) => {
        if (!alive) return;
        setFailed(false);
        setItems(rows);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [user, attempt, kayitliAramalar]);

  if (!kayitliAramalar) {
    return (
      <AccountShell title="Kayıtlı aramalarım">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <Bookmark className="mx-auto size-10 text-subtle" />
          <p className="mt-3 font-medium">Kayıtlı aramalar şu anda kullanıma kapalı.</p>
          <p className="mt-1 text-sm text-muted">Bu özellik geçici olarak devre dışı bırakıldı.</p>
          <Link to="/profil" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Hesabıma dön
          </Link>
        </div>
      </AccountShell>
    );
  }

  if (failed && !items) {
    return (
      <AccountShell title="Kayıtlı aramalarım">
        <ErrorState
          message="Kayıtlı aramalarınız yüklenemedi."
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !items)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !items) return <RedirectToSignIn />;

  async function handleToggleNotify(item: SavedSearch, next: boolean) {
    if (busyId) return;
    setBusyId(item.id);
    setItems((prev) => (prev ?? []).map((x) => (x.id === item.id ? { ...x, notify: next } : x)));
    try {
      await toggleSavedSearchNotify({ data: { id: item.id, notify: next } });
      toast.success(next ? "Bildirimler açıldı" : "Bildirimler kapatıldı");
    } catch (e) {
      setItems((prev) => (prev ?? []).map((x) => (x.id === item.id ? { ...x, notify: item.notify } : x)));
      toast.error(errorText(e, "Bildirim ayarı güncellenemedi"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: SavedSearch) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await deleteSavedSearch({ data: { id: item.id } });
      setItems((prev) => (prev ?? []).filter((x) => x.id !== item.id));
      toast.success("Kayıtlı arama silindi");
    } catch (e) {
      toast.error(errorText(e, "Kayıtlı arama silinemedi"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AccountShell
      title="Kayıtlı aramalarım"
      description="Kaydettiğiniz arama kriterleri ve yeni ilan bildirimleri."
    >
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <Bookmark className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-sm font-medium text-fg">Henüz kayıtlı aramanız yok.</p>
          <p className="mt-1 text-xs text-muted">
            Arama sayfasında “Aramayı kaydet” düğmesini kullanarak yeni ilanlardan haberdar olabilirsiniz.
          </p>
          <Link to="/search" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}>
            İlan ara
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {items.map((item) => {
            const summary = summarizeSavedSearch(item);
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h2 className="truncate text-sm font-semibold text-fg">{item.name}</h2>
                    <span className="text-xs text-subtle">{formatDate(item.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.map((part) => (
                      <span
                        key={part}
                        className="rounded-full border border-border bg-elevated/70 px-2.5 py-0.5 text-xs text-muted"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted">
                    <span>Bildirim</span>
                    <ToggleSwitch
                      label={`${item.name} bildirimleri`}
                      checked={item.notify}
                      disabled={busy}
                      onChange={(next) => void handleToggleNotify(item, next)}
                    />
                  </label>
                  <Link
                    to="/search"
                    search={toSearchParams(item)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLink className="size-3.5" />
                    Sonuçları gör
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void handleDelete(item)}
                    aria-label={`${item.name} aramasını sil`}
                    className="text-muted hover:bg-danger-solid/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
