import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ImageIcon, MapPin, Trash2, X } from "lucide-react";
import { ErrorState } from "@/components/common/ErrorState";
import { clearCompare, removeCompare, useCompareList } from "@/components/listing/CompareBar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { photoSrc } from "@/lib/images";
import { getListingsByIds } from "@/lib/server/catalog";
import type { ListingCard } from "@/lib/server/helpers";
import { useFlag } from "@/lib/use-flag";
import { cn, formatNumber, formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/karsilastir")({
  head: () => ({
    meta: [
      { title: "İlan Karşılaştırma | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ComparePage,
});

function formatAttrDisplay(key: string, val: string | number | undefined): string {
  if (val === undefined || val === "") return "—";
  const str = String(val);
  if (str === "true") return "Evet";
  if (str === "false") return "Hayır";
  if (key !== "Yıl" && key !== "Model Yılı" && /^\d+$/.test(str)) {
    return formatNumber(Number(str));
  }
  return str;
}

function ComparePage() {
  const compareEnabled = useFlag("ilan_karsilastirma");
  const items = useCompareList();
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!compareEnabled || !ids.length) {
      setListings([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getListingsByIds({ data: { ids } })
      .then((rows) => {
        if (!cancelled) {
          setListings(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // `ids` is tracked via `idsKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareEnabled, idsKey, attempt]);

  const attrKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const l of listings) {
      for (const [k, v] of Object.entries(l.attrs ?? {})) {
        if (k.startsWith("_") || v === "" || v == null || seen.has(k)) continue;
        seen.add(k);
        keys.push(k);
      }
    }
    return keys;
  }, [listings]);

  if (!compareEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ArrowLeftRight className="mx-auto size-10 text-subtle" />
        <h1 className="mt-4 text-xl font-semibold">İlan Karşılaştırma</h1>
        <p className="mt-2 text-sm text-muted">Bu özellik şu anda kullanıma kapalı.</p>
        <Link to="/" className={buttonVariants({ className: "mt-6" })}>
          Anasayfaya dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> İlanlara dön
          </Link>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">İlan Karşılaştırma</h1>
          <p className="mt-0.5 text-sm text-muted">
            {items.length > 0 ? `${items.length} ilan seçildi (en fazla 4 ilan)` : "Yan yana karşılaştırmak için ilan ekleyin."}
          </p>
        </div>
        {items.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={clearCompare} className="text-danger hover:text-danger">
            <Trash2 className="size-4" /> Tümünü temizle
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <ArrowLeftRight className="mx-auto size-9 text-subtle" />
          <p className="mt-3 text-base font-medium">Karşılaştırma listeniz boş</p>
          <p className="mt-1 text-sm text-muted">İlan detay sayfalarındaki “Karşılaştır” butonunu kullanarak en fazla 4 ilan ekleyebilirsiniz.</p>
          <Link to="/search" className={buttonVariants({ className: "mt-5" })}>
            İlanlara göz at
          </Link>
        </div>
      ) : failed ? (
        <ErrorState message="Karşılaştırılacak ilanlar yüklenemedi." onRetry={() => setAttempt((n) => n + 1)} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-medium">Seçili ilanlar artık yayında değil.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearCompare}>
            Listeyi temizle
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border align-top">
                <th scope="col" className="sticky left-0 z-10 w-40 min-w-[140px] bg-surface p-4 text-xs font-semibold uppercase tracking-wider text-subtle">
                  İlanlar ({listings.length})
                </th>
                {listings.map((l) => (
                  <th key={l.id} scope="col" className="min-w-[200px] border-l border-border p-4 font-normal">
                    <div className="space-y-2.5">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-elevated">
                        <Link to="/ilan/$slug" params={{ slug: l.slug }} className="block size-full">
                          {l.images[0] ? (
                            <img src={photoSrc(l.images[0], 480)} alt={l.title} className="size-full object-cover" />
                          ) : (
                            <div className="grid size-full place-items-center">
                              <ImageIcon className="size-7 text-subtle" />
                            </div>
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeCompare(l.id)}
                          aria-label={`${l.title} karşılaştırmadan kaldır`}
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-surface/90 text-fg shadow-sm backdrop-blur hover:bg-surface"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <Link
                        to="/ilan/$slug"
                        params={{ slug: l.slug }}
                        className="line-clamp-2 block text-sm font-semibold leading-snug text-fg hover:text-primary"
                      >
                        {l.title}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCompare(l.id)}
                        className="h-7 px-2 text-xs text-muted hover:text-danger"
                      >
                        <X className="size-3.5" /> Kaldır
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-elevated/35">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold text-muted">
                  Fiyat
                </th>
                {listings.map((l) => (
                  <td key={l.id} className="border-l border-border px-4 py-3 font-display text-base font-bold tabular-nums text-primary">
                    {formatPrice(l.price, l.currency)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold text-muted">
                  Konum
                </th>
                {listings.map((l) => {
                  const place = [l.district, l.city].filter(Boolean).join(", ") || "Türkiye";
                  return (
                    <td key={l.id} className="border-l border-border px-4 py-3 text-fg">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                        {place}
                      </span>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border bg-elevated/35">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold text-muted">
                  Kategori
                </th>
                {listings.map((l) => (
                  <td key={l.id} className="border-l border-border px-4 py-3 text-fg">
                    {l.category_name || "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold text-muted">
                  İlan No
                </th>
                {listings.map((l) => (
                  <td key={l.id} className="border-l border-border px-4 py-3 tabular-nums text-muted">
                    #{l.listing_no}
                  </td>
                ))}
              </tr>

              {attrKeys.map((key, idx) => {
                const values = listings.map((l) => formatAttrDisplay(key, l.attrs?.[key]));
                const differs = listings.length > 1 && new Set(values).size > 1;
                return (
                  <tr
                    key={key}
                    className={cn("border-b border-border last:border-b-0", idx % 2 === 0 && "bg-elevated/35")}
                  >
                    <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold text-muted">
                      <span>{key}</span>
                      {differs ? (
                        <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" title="Farklı değerler" />
                      ) : null}
                    </th>
                    {listings.map((l, colIdx) => (
                      <td key={l.id} className={cn("border-l border-border px-4 py-3", differs ? "font-medium text-fg" : "text-muted")}>
                        {values[colIdx]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
