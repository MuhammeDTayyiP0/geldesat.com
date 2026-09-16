import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, parseSearch, toFilters } from "@/lib/search-params";
import { ListingCard } from "@/components/listing/ListingCard";
import { Filters, type FilterState } from "@/components/listing/Filters";
import { SubcategoryGrid } from "@/components/listing/CategoryPicker";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/category/$slug")({
  validateSearch: (s: Record<string, unknown>) => parseSearch(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const cat = await getCategory({ data: { slug: params.slug } });
    const result = await searchCatalog({ data: { ...toFilters(deps), category: params.slug } });
    return { cat, result };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { cat, result } = Route.useLoaderData();
  const nav = useNavigate();
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

  if (!cat.category) {
    return <p className="p-10 text-center text-muted">Kategori bulunamadı.</p>;
  }

  function apply() {
    void nav({
      to: "/category/$slug",
      params: { slug },
      search: {
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
      },
    });
    setMobile(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/">Anasayfa</Link>
        {cat.path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link to="/category/$slug" params={{ slug: p.slug }} className="hover:text-fg">
              {p.name}
            </Link>
          </span>
        ))}
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">{cat.category.name}</h1>
      <p className="mt-1 text-sm text-muted">{result.total} ilan</p>
      <SubcategoryGrid items={cat.children} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Filters value={filters} onChange={setFilters} onApply={apply} attributes={cat.attributes} />
        </div>
        <div>
          <Button variant="outline" className="mb-4 lg:hidden" onClick={() => setMobile(true)}>
            Filtre
          </Button>
          {result.listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
              <p className="text-muted">Bu kategoride ilan yok.</p>
              <Link to="/ilan-ver" className="mt-3 inline-block text-sm text-primary">
                İlk ilanı siz verin
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {result.listings.map((l) => (
                <ListingCard key={l.id} listing={l} variant="list" />
              ))}
            </div>
          )}
        </div>
      </div>
      {mobile ? (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setMobile(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-xl bg-bg p-4" onClick={(e) => e.stopPropagation()}>
            <Filters value={filters} onChange={setFilters} onApply={apply} attributes={cat.attributes} />
          </div>
        </div>
      ) : null}
    </div>
  );
}