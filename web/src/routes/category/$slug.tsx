import { Pagination } from "@/components/listing/Pagination";
import { useModalPanel } from "@/lib/use-modal-panel";
import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronRight, LayoutGrid, List as ListIcon, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useViewPreference } from "@/lib/use-view-pref";
import { getCategory, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, parseAttrs, parseSearch, toFilters } from "@/lib/search-params";
import { buildCategorySeo, getCategoryHierarchicalName, BASE_URL, DEFAULT_OG_IMAGE, jsonLd, listingsHeading } from "@/lib/seo";

import { ListingCard } from "@/components/listing/ListingCard";
import { Filters, type FilterState } from "@/components/listing/Filters";
import { SubcategoryGrid } from "@/components/listing/CategoryPicker";
import { ListingGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/common/NotFound";

const SORT_OPTIONS = [
  { value: "date_desc", label: "En yeni ilanlar" },
  { value: "price_asc", label: "Fiyat: Düşükten yükseğe" },
  { value: "price_desc", label: "Fiyat: Yüksekten düşüğe" },
  { value: "date_asc", label: "En eski ilanlar" },
] as const;

export const Route = createFileRoute("/category/$slug")({
  validateSearch: (s: Record<string, unknown>) => parseSearch(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const [cat, result] = await Promise.all([
      getCategory({ data: { slug: params.slug } }),
      searchCatalog({ data: { ...toFilters(deps), category: params.slug } }),
    ]);
    if (!cat || !cat.category) {
      throw notFound();
    }
    return { cat, result };
  },
  notFoundComponent: () => (
    <NotFound
      type="category"
      title="Kategori Bulunamadı"
      message="Ulaşmaya çalıştığınız ilan kategorisi sistemimizde bulunamadı veya adı değiştirilmiş olabilir."
    />
  ),
  head: ({ loaderData, match }) => {
    if (!loaderData?.cat?.category) {
      return {
        meta: [
          { title: "Kategori Bulunamadı | GeldeSat" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const { category, path } = loaderData.cat;
    const result = loaderData.result;
    const search = match.search as Record<string, unknown> | undefined;

    const seo = buildCategorySeo({
      category,
      path,
      result,
      search: {
        city: typeof search?.city === "string" ? search.city : undefined,
        district: typeof search?.district === "string" ? search.district : undefined,
      },
    });

    // ItemList — kategorideki ilk 10 ilan
    const itemListElements = (result?.listings ?? []).slice(0, 10).map(
      (l: { slug: string; title: string }, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        name: l.title,
        url: `${BASE_URL}/ilan/${l.slug}`,
      }),
    );

    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        // An empty category has nothing to rank with; thousands of them would dilute the site.
        { name: "robots", content: result?.total ? "index,follow" : "noindex,follow" },
        // Open Graph
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: seo.pageUrl },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        // Twitter / X
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ],
      links: seo.paginationLinks,
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org/",
            "@type": "BreadcrumbList",
            itemListElement: seo.breadcrumbItems,
          }),
        },
        ...(itemListElements.length > 0
          ? [
              {
                type: "application/ld+json",
                children: jsonLd({
                  "@context": "https://schema.org/",
                  "@type": "ItemList",
                  name: seo.h1,
                  description: seo.description,
                  url: seo.pageUrl,
                  numberOfItems: result?.total ?? 0,
                  itemListElement: itemListElements,
                }),
              },
            ]
          : []),
      ],
    };
  },

  pendingComponent: ListingGridSkeleton,
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { cat, result } = Route.useLoaderData();
  const nav = useNavigate();
  const [view, setView] = useViewPreference();
  const [mobile, setMobile] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);

  const panel = useModalPanel(mobile, () => closeMobile());
  const [sortOpen, setSortOpen] = useState(false);
  const sortPanel = useModalPanel(sortOpen, () => setSortOpen(false));

  // Lock body scroll when mobile filter or sort drawer is open
  useEffect(() => {
    const root = document.documentElement;
    if (mobile || sortOpen) root.classList.add("mobile-nav-lock");
    else root.classList.remove("mobile-nav-lock");
    return () => root.classList.remove("mobile-nav-lock");
  }, [mobile, sortOpen]);

  function openMobile() {
    setMobile(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileVisible(true)));
  }

  function closeMobile() {
    setMobileVisible(false);
    setTimeout(() => setMobile(false), 300);
  }

  function resetFilters() {
    setFilters({ attrs: {} });
    void nav({ to: "/category/$slug", params: { slug }, search: { page: "1" } });
    closeMobile();
  }
  const initial = useMemo<FilterState>(() => {
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

  // The loader answers an unknown category with the 404 page.
  if (!cat.category) return null;

  function apply(extra?: { page?: string }, values: FilterState = filters) {
    const filters = values;
    void nav({
      to: "/category/$slug",
      params: { slug },
      search: {
        ...search,
        city: filters.city,
        district: filters.district,
        neighborhood: filters.district === search.district && filters.city === search.city ? search.neighborhood : undefined,
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
        page: extra?.page ?? "1",
      },
    });
    closeMobile();
  }

  const hasFilters = Object.entries(search).some(([key, value]) => key !== "page" && key !== "sort" && Boolean(value));
  const hierarchicalName = getCategoryHierarchicalName(cat.path, cat.category.name);
  const locationPrefix = [search.district, search.city].filter(Boolean).join(" ");
  const pageHeading = listingsHeading([locationPrefix, hierarchicalName].filter(Boolean).join(" "));

  function removeFromSearch(patch: Record<string, string | undefined>) {
    void nav({ to: "/category/$slug", params: { slug }, search: { ...search, ...patch, page: "1" } });
  }

  const activeChips: Array<{ id: string; label: string; onRemove: () => void }> = [];
  if (search.city) {
    activeChips.push({
      id: "city",
      label: search.district ? `${search.city} / ${search.district}` : search.city,
      onRemove: () => removeFromSearch({ city: undefined, district: undefined, neighborhood: undefined }),
    });
  }
  if (search.minPrice || search.maxPrice) {
    const label =
      search.minPrice && search.maxPrice
        ? `${Number(search.minPrice).toLocaleString("tr-TR")} – ${Number(search.maxPrice).toLocaleString("tr-TR")} ₺`
        : search.minPrice
          ? `En az ${Number(search.minPrice).toLocaleString("tr-TR")} ₺`
          : `En fazla ${Number(search.maxPrice).toLocaleString("tr-TR")} ₺`;
    activeChips.push({ id: "price", label, onRemove: () => removeFromSearch({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (search.minYear || search.maxYear) {
    activeChips.push({
      id: "year",
      label: `Yıl: ${search.minYear ?? "…"} – ${search.maxYear ?? "…"}`,
      onRemove: () => removeFromSearch({ minYear: undefined, maxYear: undefined }),
    });
  }
  if (search.minKm || search.maxKm) {
    activeChips.push({
      id: "km",
      label: `KM: ${search.minKm ?? "…"} – ${search.maxKm ?? "…"}`,
      onRemove: () => removeFromSearch({ minKm: undefined, maxKm: undefined }),
    });
  }
  if (search.minM2 || search.maxM2) {
    activeChips.push({
      id: "m2",
      label: `m²: ${search.minM2 ?? "…"} – ${search.maxM2 ?? "…"}`,
      onRemove: () => removeFromSearch({ minM2: undefined, maxM2: undefined }),
    });
  }
  if (search.sort && search.sort !== "date_desc") {
    const opt = SORT_OPTIONS.find((s) => s.value === search.sort);
    if (opt) activeChips.push({ id: "sort", label: opt.label, onRemove: () => removeFromSearch({ sort: "date_desc" }) });
  }
  const parsedAttrs = parseAttrs(search.attrs) ?? {};
  for (const [k, vals] of Object.entries(parsedAttrs)) {
    if (vals && vals.length) {
      activeChips.push({
        id: `attr_${k}`,
        label: `${k}: ${vals.join(", ")}`,
        onRemove: () => {
          const next = { ...parsedAttrs };
          delete next[k];
          removeFromSearch({ attrs: attrsToSearch(next) });
        },
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/">Anasayfa</Link>
        {cat.path.map((p: { id: string; name: string; slug: string }) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link to="/category/$slug" params={{ slug: p.slug }} className="hover:text-fg">
              {p.name}
            </Link>
          </span>
        ))}
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">{pageHeading}</h1>
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{result.total} ilan</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium lg:hidden"
            onClick={openMobile}
          >
            <SlidersHorizontal className="size-3.5 text-muted" />
            <span>Filtre{activeChips.length ? ` (${activeChips.length})` : ""}</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium lg:hidden"
            onClick={() => setSortOpen(true)}
          >
            <ArrowUpDown className="size-3.5 text-muted" />
            <span>Sırala</span>
          </button>
          <div className="flex rounded-md border border-border">
            <button
              type="button"
              className={`grid size-11 place-items-center ${view === "list" ? "bg-elevated" : ""}`}
              onClick={() => setView("list")}
              aria-label="Liste"
            >
              <ListIcon className="size-4" />
            </button>
            <button
              type="button"
              className={`grid size-11 place-items-center ${view === "grid" ? "bg-elevated" : ""}`}
              onClick={() => setView("grid")}
              aria-label="Izgara"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <SubcategoryGrid items={cat.children} />
      {activeChips.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg shadow-2xs"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`${chip.label} filtresini kaldır`}
                className="rounded-full p-0.5 text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-primary hover:underline px-1"
          >
            Tümünü temizle
          </button>
        </div>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Filters value={filters} onChange={setFilters} onApply={(applied) => apply(undefined, applied)} attributes={cat.attributes} />
        </div>
        <div>
          {result.listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
              {hasFilters ? (
                <>
                  <p className="text-muted">Bu filtrelerle eşleşen ilan yok.</p>
                  <button type="button" onClick={resetFilters} className="mt-3 inline-block text-sm text-primary">
                    Filtreleri temizle
                  </button>
                </>
              ) : (
                <>
                  <p className="text-muted">Bu kategoride henüz ilan yok.</p>
                  <Link to="/ilan-ver" className="mt-3 inline-block text-sm text-primary">
                    İlk ilanı siz verin
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className={view === "grid" ? "grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3" : "grid gap-3"}>
              {result.listings.map((l: any, i: number) => (
                <ListingCard key={l.id} listing={l} variant={view} priority={i < 2} />
              ))}
            </div>
          )}
          <Pagination page={result.page} pages={result.pages} search={search} slug={slug} />
        </div>
      </div>
      {/* Mobile filtre — modern alt çekmece */}
      {mobile ? (
        <div
          className={`fixed inset-0 z-50 lg:hidden transition-colors duration-300 ${
            mobileVisible ? "bg-ink/50 backdrop-blur-xs" : "bg-transparent pointer-events-none"
          }`}
          onClick={closeMobile}
        >
          <div
            className={`absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-2xl transition-transform duration-300 ${
              mobileVisible ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Filtreler"
            tabIndex={-1}
          >
            {/* Header: Başlık, Temizle ve Kapat */}
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-fg">Filtreler</h2>
                <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                  {result.total} ilan
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:text-danger hover:bg-danger-solid/10 transition-colors"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="grid size-8 place-items-center rounded-lg hover:bg-elevated text-muted hover:text-fg"
                  aria-label="Kapat"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Filter Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-2">
              <Filters
                value={filters}
                onChange={setFilters}
                onApply={(applied) => apply(undefined, applied)}
                attributes={cat.attributes}
                hideApplyButton
              />
            </div>

            {/* Sticky Bottom Actions */}
            <div className="border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift">
              <Button className="h-11 w-full text-sm font-semibold rounded-xl" onClick={() => apply()}>
                Filtreleri Uygula ({result.total} İlan)
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {sortOpen ? (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSortOpen(false)}
        >
          <div
            ref={sortPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Sıralama"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-fg">Sırala</h2>
              <button
                type="button"
                onClick={() => setSortOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-1">
              {SORT_OPTIONS.map((opt) => {
                const active = (search.sort || "date_desc") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      removeFromSearch({ sort: opt.value });
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-fg hover:bg-elevated"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active ? <Check className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
