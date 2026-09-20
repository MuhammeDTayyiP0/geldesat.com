import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, parseAttrs, parseSearch, toFilters, type CatalogSearch } from "@/lib/search-params";

import { ListingCard } from "@/components/listing/ListingCard";
import { Filters, type FilterState } from "@/components/listing/Filters";
import { ListingGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { Button } from "@/components/ui/button";
import { saveSearch } from "@/lib/server/social";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => parseSearch(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const cat = deps.category ? await getCategory({ data: { slug: deps.category } }) : null;
    const result = await searchCatalog({ data: toFilters(deps) });
    return { result, attributes: cat?.attributes ?? [] };
  },
  pendingComponent: ListingGridSkeleton,
  component: SearchPage,
});

/** Akıllı sayfalama: 1-2, current±1, son-2 + ... aralarında */
function buildPageRange(page: number, pages: number): (number | "...")[] {
  if (pages <= 10) return Array.from({ length: pages }, (_, i) => i + 1);
  const near = new Set(
    [1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages),
  );
  const sorted = Array.from(near).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...");
    out.push(sorted[i]);
  }
  return out;
}

function SearchPage() {
  const search = Route.useSearch();
  const { result, attributes } = Route.useLoaderData();
  const nav = useNavigate();
  const user = useCurrentUser();
  const [view, setView] = useState<"list" | "grid">("list");
  const [mobile, setMobile] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);

  function openMobile() {
    setMobile(true);
    // Double rAF: ensure element is in DOM before triggering CSS transition
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileVisible(true)));
  }

  function closeMobile() {
    setMobileVisible(false);
    // Wait for CSS transition (300ms) before removing from DOM
    setTimeout(() => setMobile(false), 300);
  }
  const initial = useMemo<FilterState>(() => {
    // Use the shared parseAttrs helper — no duplicate JSON parse logic
    const attrs = parseAttrs(search.attrs) ?? {};
    return {
      city: search.city,
      district: search.district,
      neighborhood: search.neighborhood,
      minPrice: search.minPrice,
      maxPrice: search.maxPrice,
      sort: search.sort,
      minYear: search.minYear,
      maxYear: search.maxYear,
      minKm: search.minKm,
      maxKm: search.maxKm,
      minM2: search.minM2,
      maxM2: search.maxM2,
      attrs,
    };
  }, [search]);
  const [filters, setFilters] = useState<FilterState>(initial);
  useEffect(() => setFilters(initial), [initial]);

  function apply(extra?: Partial<CatalogSearch>) {
    const next: CatalogSearch = {
      ...search,
      city: filters.city,
      district: filters.district,
      neighborhood: filters.neighborhood,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: filters.sort,
      minYear: filters.minYear,
      maxYear: filters.maxYear,
      minKm: filters.minKm,
      maxKm: filters.maxKm,
      minM2: filters.minM2,
      maxM2: filters.maxM2,
      attrs: attrsToSearch(filters.attrs),
      page: "1",
      ...extra,
    };
    void nav({ to: "/search", search: next });
    closeMobile();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{search.q ? `“${search.q}”` : "Tüm ilanlar"}</h1>
          <p className="text-sm text-muted">{result.total} ilan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="lg:hidden" onClick={openMobile}>
            Filtre
          </Button>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                saveSearch({ data: { query: search.q, filters: search } })
                  .then(() => toast.success("Arama kaydedildi. Uyan ilan olunca bildirim gelir."))
                  .catch(() => toast.error("Kayıt için giriş gerekli"))
              }
            >
              Kaydet
            </Button>
          ) : null}
          <div className="flex rounded-md border border-border">
            <button type="button" className={`grid size-11 place-items-center ${view === "list" ? "bg-elevated" : ""}`} onClick={() => setView("list")} aria-label="Liste">
              <ListIcon className="size-4" />
            </button>
            <button type="button" className={`grid size-11 place-items-center ${view === "grid" ? "bg-elevated" : ""}`} onClick={() => setView("grid")} aria-label="Izgara">
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Filters value={filters} onChange={setFilters} onApply={() => apply()} attributes={attributes} />
        </div>
        <div>
          {result.listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
              <p className="text-muted">{search.q || search.city ? "Sonuç yok. Filtreleri gevşetin veya başka bir kelime deneyin." : "Henüz ilan yok."}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  { q: "Civic", label: "Civic" },
                  { q: "3+1", label: "3+1" },
                  { q: "iPhone", label: "iPhone" },
                  { q: "kiralık", label: "Kiralık" },
                ].map((c) => (
                  <button
                    key={c.q}
                    type="button"
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
                    onClick={() => apply({ q: c.q, page: "1" })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <Link to="/ilan-ver" className="mt-4 inline-block text-sm text-primary">
                İlk ilanı siz verin
              </Link>
            </div>
          ) : (
            <div className={view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3"}>
              {result.listings.map((l: any) => (
                <ListingCard key={l.id} listing={l} variant={view} />
              ))}
            </div>
          )}
          {/* Sayfalama — sınırsız sayfa, Önceki/Sonraki butonları dahil */}
          {result.pages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => apply({ page: String(result.page - 1) })}
                className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Önceki
              </button>
              {buildPageRange(result.page, result.pages).map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="grid size-10 select-none place-items-center text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => apply({ page: String(p) })}
                    className={`size-10 rounded-md transition-colors ${
                      p === result.page
                        ? "bg-ink text-primary-fg"
                        : "border border-border hover:bg-elevated"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={result.page >= result.pages}
                onClick={() => apply({ page: String(result.page + 1) })}
                className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sonraki →
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {/* Mobile filtre — açılma/kapanma animasyonlu */}
      {mobile ? (
        <div
          className={`fixed inset-0 z-50 lg:hidden transition-colors duration-300 ${
            mobileVisible ? "bg-ink/40" : "bg-transparent"
          }`}
          onClick={closeMobile}
        >
          <div
            className={`absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-xl bg-bg p-4 transition-transform duration-300 ${
              mobileVisible ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <Filters value={filters} onChange={setFilters} onApply={() => apply()} attributes={attributes} />
          </div>
        </div>
      ) : null}
    </div>
  );
}