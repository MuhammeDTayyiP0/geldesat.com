import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Loader2, MapPin, Search, X } from "lucide-react";
import { listCategoryRoots, mapCityCounts, mapListingsInBounds } from "@/lib/server/catalog";
import type { ListingCard } from "@/lib/server/helpers";
import { CityMap, type MapBounds } from "@/components/map/CityMap";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useFlag } from "@/lib/use-flag";
import { photoSrc } from "@/lib/images";
import { formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/harita")({
  loader: async () => {
    const [cities, { roots: categories }] = await Promise.all([mapCityCounts(), listCategoryRoots()]);
    return { cities, categories };
  },
  head: () => ({
    meta: [
      { title: "Harita İlanları | GeldeSat" },
      { name: "description", content: "GeldeSat Türkiye haritası üzerinde satılık ve kiralık ilanları inceleyin." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Harita İlanları | GeldeSat" },
      { property: "og:url", content: "https://www.geldesat.com/harita" },
    ],
    links: [{ rel: "canonical", href: "https://www.geldesat.com/harita" }],
  }),
  pendingComponent: () => <BrandSpinner fullPage text="Harita ve ilanlar yükleniyor…" />,
  component: MapPage,
});

function parsePrice(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function MapPage() {
  const { cities, categories } = Route.useLoaderData();
  const haritadaAra = useFlag("haritada_ara");

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [pins, setPins] = useState<ListingCard[] | undefined>(undefined);
  const [selectedPin, setSelectedPin] = useState<ListingCard | null>(null);
  const [loadingPins, setLoadingPins] = useState(false);

  const hasActiveFilter = Boolean(q.trim() || category || minPrice.trim() || maxPrice.trim());
  const isPinMode = haritadaAra && bounds !== null && (bounds.zoom >= 8 || hasActiveFilter);

  const handleBoundsChange = useCallback((next: MapBounds) => {
    setBounds(next);
  }, []);

  useEffect(() => {
    if (!isPinMode || !bounds) {
      setPins(undefined);
      setSelectedPin(null);
      setLoadingPins(false);
      return;
    }

    let cancelled = false;
    setLoadingPins(true);
    const timer = window.setTimeout(() => {
      const minP = parsePrice(minPrice);
      const maxP = parsePrice(maxPrice);
      mapListingsInBounds({
        data: {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
          category: category || undefined,
          minPrice: minP,
          maxPrice: maxP && maxP > 0 ? maxP : undefined,
          q: q.trim() || undefined,
        },
      })
        .then((nextPins) => {
          if (cancelled) return;
          setPins(nextPins);
          setSelectedPin((prev) => (prev ? (nextPins.find((p) => p.id === prev.id) ?? null) : null));
        })
        .catch(() => {
          if (!cancelled) setPins([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingPins(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isPinMode, bounds, q, category, minPrice, maxPrice]);

  function clearFilters() {
    setQ("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Harita</h1>
      <p className="mt-2 text-sm text-muted">
        {haritadaAra
          ? "İl sayılarına dokunun ya da yakınlaşıp filtreleyerek ilanları doğrudan harita üzerinde inceleyin."
          : "Her ildeki yayında ilan sayısı. Bir ile dokunarak ilanlarını görün."}
      </p>

      {haritadaAra ? (
        <div className="mt-5 rounded-xl border border-border bg-surface p-3 shadow-card">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Anahtar kelime ara…"
                aria-label="Haritada anahtar kelime ara"
                className="h-10 pl-9"
              />
            </div>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Kategori"
              className="h-10"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min TL"
              aria-label="En az fiyat"
              className="h-10"
            />
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max TL"
              aria-label="En çok fiyat"
              className="h-10"
            />
            {hasActiveFilter ? (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="h-10">
                <X className="size-4" /> Temizle
              </Button>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              {loadingPins ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  İlanlar yükleniyor…
                </>
              ) : isPinMode ? (
                `${pins?.length ?? 0} ilan haritada gösteriliyor`
              ) : (
                "İlan pinlerini görmek için haritayı yakınlaştırın (zoom ≥ 8) veya filtre seçin."
              )}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
        <CityMap
          cities={cities}
          pins={isPinMode ? pins : undefined}
          selectedPinId={selectedPin?.id}
          onBoundsChange={haritadaAra ? handleBoundsChange : undefined}
          onPinSelect={haritadaAra ? setSelectedPin : undefined}
        />
      </div>

      {haritadaAra && selectedPin ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-card sm:gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-elevated sm:size-24">
            {selectedPin.images[0] ? (
              <img
                src={photoSrc(selectedPin.images[0], 240)}
                alt={selectedPin.title}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center text-subtle">
                <ImageIcon className="size-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-primary tabular-nums">
              {formatPrice(selectedPin.price, selectedPin.currency)}
            </p>
            <p className="truncate text-sm font-medium text-fg">{selectedPin.title}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {[selectedPin.district, selectedPin.city].filter(Boolean).join(", ") || selectedPin.category_name}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/ilan/$slug"
              params={{ slug: selectedPin.slug }}
              className={buttonVariants({ size: "sm" })}
            >
              İlanı gör
            </Link>
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              aria-label="Önizlemeyi kapat"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      <h2 className="mt-10 font-display text-xl font-semibold">İllere göre</h2>
      {cities.length ? null : <p className="mt-4 text-sm text-muted">Henüz yayında ilan yok.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {cities.map(({ city, n }) => (
          <Link key={city} to="/search" search={{ city }} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm transition-[box-shadow,border-color] duration-150 hover:shadow-lift">
            <span className="font-medium">{city}</span>
            <span className="ml-2 text-muted">{n}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}