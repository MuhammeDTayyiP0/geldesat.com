import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, parseSearch, toFilters, type CatalogSearch } from "@/lib/search-params";
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

function SearchPage() {
  const search = Route.useSearch();
  const { result, attributes } = Route.useLoaderData();
  const nav = useNavigate();
  const user = useCurrentUser();
  const [view, setView] = useState<"list" | "grid">("list");
  const [mobile, setMobile] = useState(false);
  const initial = useMemo<FilterState>(() => {
    let attrs: Record<string, string[]> = {};
    if (search.attrs) {
      try {
        const parsed = JSON.parse(search.attrs) as Record<string, string[]>;
        if (parsed && typeof parsed === "object") attrs = parsed;
      } catch {
        attrs = {};
      }
    }
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
    setMobile(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{search.q ? `“${search.q}”` : "Tüm ilanlar"}</h1>
          <p className="text-sm text-muted">{result.total} ilan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setMobile(true)}>
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
          {result.pages > 1 ? (
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.min(result.pages, 12) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => apply({ page: String(p) })}
                  className={`size-10 rounded-md ${p === result.page ? "bg-ink text-primary-fg" : "border border-border"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {mobile ? (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setMobile(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-xl bg-bg p-4" onClick={(e) => e.stopPropagation()}>
            <Filters value={filters} onChange={setFilters} onApply={() => apply()} attributes={attributes} />
          </div>
        </div>
      ) : null}
    </div>
  );
}