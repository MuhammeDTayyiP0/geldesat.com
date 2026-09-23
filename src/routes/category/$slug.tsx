import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { ChevronRight, LayoutGrid, List as ListIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, parseAttrs, parseSearch, toFilters } from "@/lib/search-params";

import { ListingCard } from "@/components/listing/ListingCard";
import { Filters, type FilterState } from "@/components/listing/Filters";
import { SubcategoryGrid } from "@/components/listing/CategoryPicker";
import { ListingGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/common/NotFound";

export const Route = createFileRoute("/category/$slug")({
  validateSearch: (s: Record<string, unknown>) => parseSearch(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const cat = await getCategory({ data: { slug: params.slug } });
    if (!cat || !cat.category) {
      throw notFound();
    }
    const result = await searchCatalog({ data: { ...toFilters(deps), category: params.slug } });
    return { cat, result };
  },
  notFoundComponent: () => (
    <NotFound
      type="category"
      title="Kategori Bulunamadı"
      message="Ulaşmaya çalıştığınız ilan kategorisi sistemimizde bulunamadı veya adı değiştirilmiş olabilir."
    />
  ),
  head: ({ loaderData }) => {
    if (!loaderData?.cat?.category) return { meta: [] };
    const category = loaderData.cat.category;
    const cat = loaderData.cat;
    const result = loaderData.result;
    const BASE = "https://geldesat.com";
    const pageUrl = `${BASE}/category/${category.slug}`;
    const title = `${category.name} İlanları | GeldeSat`;
    const desc = `GeldeSat'ta ${category.name} kategorisindeki güncel ilanları inceleyin. Fiyat ve özelliklere göre filtreleyin.`;

    // BreadcrumbList
    const breadcrumbItems = [
      { "@type": "ListItem", position: 1, name: "Anasayfa", item: BASE },
      ...(cat.path ?? []).map((p: { name: string; slug: string }, i: number) => ({
        "@type": "ListItem",
        position: i + 2,
        name: p.name,
        item: `${BASE}/category/${p.slug}`,
      })),
    ];

    // Sayfalama için rel prev/next canonical linkleri
    const currentPage = result?.page ?? 1;
    const totalPages = result?.pages ?? 1;
    const paginationLinks: { rel: string; href: string }[] = [
      { rel: "canonical", href: currentPage === 1 ? pageUrl : `${pageUrl}?page=${currentPage}` },
    ];
    if (currentPage > 1) {
      paginationLinks.push({
        rel: "prev",
        href: currentPage === 2 ? pageUrl : `${pageUrl}?page=${currentPage - 1}`,
      });
    }
    if (currentPage < totalPages) {
      paginationLinks.push({
        rel: "next",
        href: `${pageUrl}?page=${currentPage + 1}`,
      });
    }

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index,follow" },
        // Open Graph
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: `${BASE}/og.jpg` },
        // Twitter / X
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: `${BASE}/og.jpg` },
      ],
      links: paginationLinks,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbItems,
          }),
        },
      ],
    };
  },
  pendingComponent: ListingGridSkeleton,
  component: CategoryPage,
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

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { cat, result } = Route.useLoaderData();
  const nav = useNavigate();
  const [view, setView] = useState<"list" | "grid">("list");
  const [mobile, setMobile] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);

  function openMobile() {
    setMobile(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileVisible(true)));
  }

  function closeMobile() {
    setMobileVisible(false);
    setTimeout(() => setMobile(false), 300);
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

  if (!cat.category) {
    return <p className="p-10 text-center text-muted">Kategori bulunamadı.</p>;
  }

  function apply(extra?: { page?: string }) {
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
        page: extra?.page ?? "1",
      },
    });
    closeMobile();
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
      <h1 className="text-2xl font-semibold tracking-tight">{cat.category.name}</h1>
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{result.total} ilan</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm lg:hidden"
            onClick={openMobile}
          >
            Filtre
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
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Filters value={filters} onChange={setFilters} onApply={() => apply()} attributes={cat.attributes} />
        </div>
        <div>
          {result.listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
              <p className="text-muted">Bu kategoride ilan yok.</p>
              <Link to="/ilan-ver" className="mt-3 inline-block text-sm text-primary">
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
            <Filters value={filters} onChange={setFilters} onApply={() => apply()} attributes={cat.attributes} />
          </div>
        </div>
      ) : null}

    </div>
  );
}