import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, listCategories, searchCatalog } from "@/lib/server/catalog";
import { attrsToSearch, inferSearchCategoryId, parseAttrs, parseSearch, toFilters, type CatalogSearch } from "@/lib/search-params";

import { ListingCard } from "@/components/listing/ListingCard";
import { Filters, type FilterState } from "@/components/listing/Filters";
import { ListingGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatNumber } from "@/lib/utils";
import { CategoryButtons } from "@/components/listing/CategoryPicker";

const SORT_OPTIONS = [
  { value: "date_desc", label: "En Yeni İlanlar" },
  { value: "date_asc", label: "En Eski İlanlar" },
  { value: "price_asc", label: "Fiyat: Düşükten Yükseğe" },
  { value: "price_desc", label: "Fiyat: Yüksekten Düşüğe" },
  { value: "views_desc", label: "En Çok İncelenenler" },
];

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => parseSearch(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [requestedCategory, categoryData, result] = await Promise.all([
      deps.category ? getCategory({ data: { slug: deps.category } }) : null,
      listCategories(),
      searchCatalog({ data: toFilters({ ...deps, neighborhood: undefined }) }),
    ]);
    const inferredCategoryId = !deps.category && deps.q?.trim()
      ? inferSearchCategoryId(result.listings.map((listing) => listing.category_id), categoryData.categories)
      : undefined;
    const inferredCategory = inferredCategoryId
      ? categoryData.categories.find((category) => category.id === inferredCategoryId)
      : undefined;
    const categoryContext = requestedCategory?.category
      ? requestedCategory
      : inferredCategory
        ? await getCategory({ data: { slug: inferredCategory.slug } })
        : null;
    return {
      result,
      attributes: categoryContext?.attributes ?? [],
      currentCategory: categoryContext?.category ?? null,
      categoryPath: categoryContext?.path ?? [],
      categoryChildren: categoryContext?.children ?? [],
      categoryRoots: categoryData.roots,
    };
  },
  head: ({ loaderData, match }) => {
    const s = match.search as CatalogSearch;
    let title = "İlan Ara | GeldeSat";
    if (s.q) {
      title = `“${s.q}” İlanları | GeldeSat`;
    } else if (loaderData?.currentCategory?.name) {
      title = `${loaderData.currentCategory.name} İlanları | GeldeSat`;
    } else if (s.city) {
      title = `${s.city} İlanları | GeldeSat`;
    }
    return {
      meta: [
        { title },
        { name: "description", content: "GeldeSat'ta emlak, vasıta ve ikinci el ilanları arasında arayın ve filtreleyin." },
        { name: "robots", content: "noindex,follow" },
      ],
      links: [{ rel: "canonical", href: "https://www.geldesat.com/search" }],
    };
  },
  pendingComponent: ListingGridSkeleton,
  component: SearchPage,
});

/** Akıllı sayfalama: 1-2, current±1, son-2 + ... aralarında */
function buildPageRange(page: number, pages: number): (number | "...")[] {
  if (pages <= 8) return Array.from({ length: pages }, (_, i) => i + 1);
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
  const {
    result,
    attributes,
    currentCategory,
    categoryPath,
    categoryChildren,
    categoryRoots,
  } = Route.useLoaderData();
  const nav = useNavigate();

  const [view, setView] = useState<"list" | "grid">("grid");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileFilterVisible, setMobileFilterVisible] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [mobileSortVisible, setMobileSortVisible] = useState(false);

  // Arama input durumu
  const [keyword, setKeyword] = useState(search.q ?? "");
  useEffect(() => {
    setKeyword(search.q ?? "");
  }, [search.q]);

  const initial = useMemo<FilterState>(() => {
    const attrs = parseAttrs(search.attrs) ?? {};
    return {
      category: search.category,
      city: search.city,
      district: search.district,
      minPrice: search.minPrice,
      maxPrice: search.maxPrice,
      sort: search.sort ?? "date_desc",
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

  // Lock body scroll when mobile modals are open
  useEffect(() => {
    const root = document.documentElement;
    if (mobileFilterOpen || mobileSortOpen) root.classList.add("mobile-nav-lock");
    else root.classList.remove("mobile-nav-lock");
    return () => root.classList.remove("mobile-nav-lock");
  }, [mobileFilterOpen, mobileSortOpen]);

  function openFilterDrawer() {
    setFilters(initial);
    setMobileFilterOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileFilterVisible(true)));
  }

  function closeFilterDrawer() {
    setMobileFilterVisible(false);
    setTimeout(() => {
      setMobileFilterOpen(false);
      setFilters(initial);
    }, 280);
  }

  function openSortDrawer() {
    setMobileSortOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileSortVisible(true)));
  }

  function closeSortDrawer() {
    setMobileSortVisible(false);
    setTimeout(() => setMobileSortOpen(false), 280);
  }

  function apply(extra?: Partial<CatalogSearch>) {
    const next: CatalogSearch = {
      ...search,
      category: filters.category,
      city: filters.city,
      district: filters.district,
      neighborhood: undefined,
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
    closeFilterDrawer();
    closeSortDrawer();
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply({ q: keyword.trim() || undefined, page: "1" });
  }

  function resetAllFilters() {
    setFilters({ attrs: {} });
    setKeyword("");
    void nav({ to: "/search", search: { page: "1" } });
    closeFilterDrawer();
  }

  // Aktif filtre çipleri hesaplama
  const activeChips: { id: string; label: string; onRemove: () => void }[] = [];

  if (search.q) {
    activeChips.push({
      id: "q",
      label: `“${search.q}”`,
      onRemove: () => {
        setKeyword("");
        apply({ q: undefined });
      },
    });
  }

  if (search.category) {
    const catName = currentCategory?.name || search.category;
    activeChips.push({
      id: "category",
      label: `Kategori: ${catName}`,
      onRemove: () => apply({ category: undefined }),
    });
  }

  if (search.city) {
    activeChips.push({
      id: "city",
      label: `İl: ${search.city}`,
      onRemove: () => apply({ city: undefined, district: undefined }),
    });
  }

  if (search.district) {
    activeChips.push({
      id: "district",
      label: `İlçe: ${search.district}`,
      onRemove: () => apply({ district: undefined }),
    });
  }

  if (search.minPrice || search.maxPrice) {
    const min = search.minPrice ? `${formatNumber(Number(search.minPrice))} ₺` : "0 ₺";
    const max = search.maxPrice ? `${formatNumber(Number(search.maxPrice))} ₺` : "∞";
    activeChips.push({
      id: "price",
      label: `Fiyat: ${min} - ${max}`,
      onRemove: () => apply({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  if (search.minYear || search.maxYear) {
    activeChips.push({
      id: "year",
      label: `Yıl: ${search.minYear ?? "Min"} - ${search.maxYear ?? "Max"}`,
      onRemove: () => apply({ minYear: undefined, maxYear: undefined }),
    });
  }

  if (search.minKm || search.maxKm) {
    activeChips.push({
      id: "km",
      label: `KM: ${search.minKm ? formatNumber(Number(search.minKm)) : "0"} - ${search.maxKm ? formatNumber(Number(search.maxKm)) : "∞"}`,
      onRemove: () => apply({ minKm: undefined, maxKm: undefined }),
    });
  }

  if (search.minM2 || search.maxM2) {
    activeChips.push({
      id: "m2",
      label: `m²: ${search.minM2 ?? "0"} - ${search.maxM2 ?? "∞"}`,
      onRemove: () => apply({ minM2: undefined, maxM2: undefined }),
    });
  }

  if (search.sort && search.sort !== "date_desc") {
    const opt = SORT_OPTIONS.find((s) => s.value === search.sort);
    if (opt) {
      activeChips.push({
        id: "sort",
        label: `${opt.label}`,
        onRemove: () => apply({ sort: "date_desc" }),
      });
    }
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
          apply({ attrs: attrsToSearch(next) });
        },
      });
    }
  }

  const activeFilterCount = activeChips.length;

  // Dinamik sayfa başlığı
  const dynamicTitle = useMemo(() => {
    if (search.q) return `“${search.q}” İlanları`;
    if (currentCategory?.name) return `${currentCategory.name} İlanları`;
    if (search.city) return `${search.city}${search.district ? `, ${search.district}` : ""} İlanları`;
    return "Tüm İlanlar";
  }, [search.q, currentCategory, search.city, search.district]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      {/* 1. Üst Arama Kutusu (Hem Mobilde Hem Masaüstünde Görünür) */}
      <form onSubmit={handleSearchSubmit} className="relative mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-subtle" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Kelime, marka veya ilan no ile arayın..."
            className="h-11 rounded-xl bg-surface pl-10 pr-9 text-sm shadow-xs border-border sm:h-12"
          />
          {keyword ? (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                apply({ q: undefined, page: "1" });
              }}
              aria-label="Aramayı temizle"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-full text-muted hover:text-fg hover:bg-elevated transition-colors"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button type="submit" className="h-11 px-4 rounded-xl font-medium sm:h-12 sm:px-6">
          Ara
        </Button>
      </form>

      {/* 2. Hızlı Kategori Gezintisi (Yatay Kaydırılabilir Çipler) */}
      <details open={Boolean(currentCategory)} className="mb-4 rounded-xl border border-border bg-surface px-3 sm:px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-fg">
          <span>Kategori{currentCategory ? ` · ${currentCategory.name}` : ""}</span>
          <span className="text-xs font-medium text-muted">Kategoriye göre daralt</span>
        </summary>
        <div className="border-t border-border/70 py-3">
          {categoryPath.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <button
                type="button"
                onClick={() => apply({ category: undefined })}
                className="font-medium hover:text-primary transition-colors"
              >
                Tüm Kategoriler
              </button>
              {categoryPath.map((category: { id: string; name: string; slug: string }, index: number) => (
                <span key={category.id} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 text-subtle" />
                  {index === categoryPath.length - 1 ? (
                    <span className="font-semibold text-fg">{category.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => apply({ category: category.slug })}
                      className="hover:text-primary transition-colors"
                    >
                      {category.name}
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : null}
          {(currentCategory ? categoryChildren : categoryRoots).length > 0 ? (
            <CategoryButtons
              items={currentCategory ? categoryChildren : categoryRoots}
              onPick={(category) => apply({ category: category.slug })}
            />
          ) : (
            <p className="text-sm text-muted">Bu seviyede alt kategori yok. Üst kategoriye dönmek için yukarıdaki yolu kullanın.</p>
          )}
        </div>
      </details>

      {/* 3. Başlık & Araç Çubuğu */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-fg sm:text-xl">{dynamicTitle}</h1>
          <p className="text-xs text-muted sm:text-sm">{formatNumber(result.total)} ilan listeleniyor</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Masaüstü Filtre Temizle */}
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="hidden lg:flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Temizle
            </button>
          ) : null}

          {/* Mobilde Filtrele Butonu */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 rounded-lg text-xs font-semibold lg:hidden"
            onClick={openFilterDrawer}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filtrele</span>
            {activeFilterCount > 0 ? (
              <span className="grid size-4.5 place-items-center rounded-full bg-primary text-[10px] text-primary-fg font-bold">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          {/* Mobilde Sırala Butonu */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 rounded-lg text-xs font-semibold lg:hidden"
            onClick={openSortDrawer}
          >
            <ArrowUpDown className="size-3.5" />
            <span>Sırala</span>
          </Button>

          {/* Görünüm Değiştirici: Liste / 2'li Izgara */}
          <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-2xs">
            <button
              type="button"
              className={cn(
                "grid size-8 place-items-center rounded-md transition-colors",
                view === "grid" ? "bg-elevated text-primary font-semibold shadow-2xs" : "text-muted hover:text-fg",
              )}
              onClick={() => setView("grid")}
              aria-label="Izgara Görünümü"
              title="Izgara"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              className={cn(
                "grid size-8 place-items-center rounded-md transition-colors",
                view === "list" ? "bg-elevated text-primary font-semibold shadow-2xs" : "text-muted hover:text-fg",
              )}
              onClick={() => setView("list")}
              aria-label="Liste Görünümü"
              title="Liste"
            >
              <ListIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Aktif Filtre Çipleri (Rozetler) */}
      {activeChips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted mr-1">Filtreler:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/70 py-1 pl-2.5 pr-1.5 text-xs font-medium text-fg shadow-2xs"
            >
              <span className="truncate max-w-[200px]">{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="grid size-4 place-items-center rounded-full hover:bg-border/60 hover:text-danger text-muted transition-colors"
                aria-label={`${chip.label} filtresini kaldır`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs font-semibold text-danger hover:underline ml-1 px-1 py-0.5"
          >
            Tümünü Temizle
          </button>
        </div>
      ) : null}

      {/* 5. Ana İçerik: Sol Filtre Kenar Çubuğu + Sağ İlan Listesi */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Masaüstü Filtre Kenar Çubuğu */}
        <div className="hidden lg:block">
          <Filters
            value={filters}
            onChange={setFilters}
            onApply={() => apply()}
            attributes={attributes}
          />
        </div>

        {/* İlan Kartları ve Sayfalama */}
        <div>
          {result.listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-elevated text-subtle">
                <Search className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-fg sm:text-lg">Eşleşen ilan bulunamadı</h3>
              <p className="mt-1 text-sm text-muted">
                Arama kriterlerinize uygun ilan bulunamadı. Filtreleri temizleyebilir veya farklı bir arama yapabilirsiniz.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {activeFilterCount > 0 ? (
                  <Button variant="default" onClick={resetAllFilters} className="rounded-xl">
                    <RotateCcw className="mr-1.5 size-4" />
                    Filtreleri Temizle ({activeFilterCount})
                  </Button>
                ) : null}
                <Link to="/ilan-ver">
                  <Button className="rounded-xl">
                    İlan Ver
                  </Button>
                </Link>
              </div>
              <div className="mt-6 border-t border-border/60 pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Popüler Aramalar</p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {["Civic", "3+1", "iPhone", "Kiralık Daire", "Megane", "Sahibinden"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="rounded-full border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-fg hover:border-primary hover:text-primary transition-colors"
                      onClick={() => {
                        setKeyword(q);
                        void nav({ to: "/search", search: { q, page: "1" } });
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3"
                  : "grid gap-3"
              }
            >
              {result.listings.map((l: any) => (
                <ListingCard key={l.id} listing={l} variant={view} />
              ))}
            </div>
          )}

          {/* Sayfalama Kontrolleri */}
          {result.pages > 1 ? (
            <div className="mt-8">
              {/* Mobil Kompakt Sayfalama */}
              <div className="flex items-center justify-between gap-2 sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  onClick={() => apply({ page: String(result.page - 1) })}
                  className="h-10 px-4 text-xs font-semibold rounded-xl"
                >
                  ← Önceki
                </Button>
                <span className="text-xs font-bold text-fg">
                  Sayfa {result.page} / {result.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.pages}
                  onClick={() => apply({ page: String(result.page + 1) })}
                  className="h-10 px-4 text-xs font-semibold rounded-xl"
                >
                  Sonraki →
                </Button>
              </div>

              {/* Masaüstü Tam Sayfalama */}
              <div className="hidden sm:flex flex-wrap items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={result.page <= 1}
                  onClick={() => apply({ page: String(result.page - 1) })}
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
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
                      className={`size-10 rounded-lg text-sm font-semibold transition-colors ${
                        p === result.page
                          ? "bg-primary text-primary-fg shadow-2xs"
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
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sonraki →
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 6. Mobil Kayan / Yapışkan Eylem Çubuğu (Floating Sticky Bar) */}
      <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={openFilterDrawer}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg shadow-sm transition-transform active:scale-95"
        >
          <SlidersHorizontal className="size-3.5" />
          <span>Filtrele {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}</span>
        </button>
        <div className="h-4 w-px bg-border" />
        <button
          type="button"
          onClick={openSortDrawer}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-fg hover:bg-elevated transition-transform active:scale-95"
        >
          <ArrowUpDown className="size-3.5 text-muted" />
          <span>Sırala</span>
        </button>
        <div className="h-4 w-px bg-border" />
        <Link
          to="/harita"
          search={{ city: search.city }}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-fg hover:bg-elevated transition-transform active:scale-95"
        >
          <MapPin className="size-3.5 text-primary" />
          <span>Harita</span>
        </Link>
      </div>

      {/* 7. Mobil Filtre Çekmecesi (Alt Çekmece) */}
      {mobileFilterOpen ? (
        <div
          className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
            mobileFilterVisible ? "bg-ink/50 backdrop-blur-xs opacity-100" : "bg-transparent opacity-0 pointer-events-none"
          }`}
          onClick={closeFilterDrawer}
        >
          <div
            className={`absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-3xl border-t border-border bg-surface shadow-2xl transition-transform duration-300 ${
              mobileFilterVisible ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sürükleme Çubuğu */}
            <div className="pt-2 pb-1 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-border" />
            </div>

            {/* Çekmece Başlığı */}
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-fg">Filtreler</h2>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {activeFilterCount} aktif
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  Tümünü Temizle
                </button>
                <button
                  type="button"
                  onClick={closeFilterDrawer}
                  className="grid size-8 place-items-center rounded-lg hover:bg-elevated text-muted hover:text-fg"
                  aria-label="Kapat"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Kaydırılabilir Filtre İçeriği */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-2">
              <Filters
                value={filters}
                onChange={setFilters}
                onApply={() => apply()}
                attributes={attributes}
                hideApplyButton
                hideSort
              />
            </div>

            {/* Yapışkan Alt Eylem */}
            <div className="border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift">
              <Button className="h-11 w-full text-sm font-semibold rounded-xl" onClick={() => apply()}>
                Filtreleri Uygula
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 8. Mobil Hızlı Sıralama Çekmecesi */}
      {mobileSortOpen ? (
        <div
          className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
            mobileSortVisible ? "bg-ink/50 backdrop-blur-xs opacity-100" : "bg-transparent opacity-0 pointer-events-none"
          }`}
          onClick={closeSortDrawer}
        >
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t border-border bg-surface shadow-2xl transition-transform duration-300 ${
              mobileSortVisible ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2 pb-1 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
              <h2 className="text-base font-bold text-fg">Sıralama Seçenekleri</h2>
              <button
                type="button"
                onClick={closeSortDrawer}
                className="grid size-8 place-items-center rounded-lg hover:bg-elevated text-muted hover:text-fg"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-1">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = (search.sort ?? "date_desc") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => apply({ sort: opt.value })}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-medium transition-colors",
                      isSelected ? "bg-primary/10 text-primary font-semibold" : "text-fg hover:bg-elevated",
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected ? <Check className="size-4.5 text-primary" /> : null}
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
