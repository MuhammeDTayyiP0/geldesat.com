import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { mapCityCounts, searchCatalog } from "@/lib/server/catalog";
import { CityMap } from "@/components/map/CityMap";
import { useFlag } from "@/lib/use-flag";
import { formatPrice } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";

export const Route = createFileRoute("/harita")({
  loader: async () => {
    const [{ listings }, cities] = await Promise.all([searchCatalog({ data: { limit: 48, page: 1 } }), mapCityCounts()]);
    return { listings, cities };
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

function MapPage() {
  const { listings, cities } = Route.useLoaderData();
  const realMap = useFlag("harita_v2");
  const [mapActive, setMapActive] = useState(false);
  const pinned = listings.filter((l: any) => l.lat && l.lng);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Harita</h1>
      <p className="mt-2 text-sm text-muted">
        {realMap ? "Her ildeki yayında ilan sayısı. Bir ile dokunarak ilanlarını görün." : "İlanlar şehir merkezine pinlenir. Mahalle seçimi ilan verirken kullanılır."}
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        {realMap ? <CityMap cities={cities} /> : (
        <div className="relative h-[420px] bg-elevated">
          <iframe
            title="Türkiye haritası"
            className={`absolute inset-0 size-full border-0 ${mapActive ? "" : "pointer-events-none md:pointer-events-auto"}`}
            src="https://www.openstreetmap.org/export/embed.html?bbox=25.6%2C35.8%2C45.0%2C42.4&layer=mapnik"
          />
          {!mapActive ? (
            <button
              type="button"
              onClick={() => setMapActive(true)}
              className="absolute inset-0 z-20 flex items-center justify-center bg-ink/15 backdrop-blur-[1px] md:hidden cursor-pointer"
            >
              <span className="rounded-full bg-ink/85 px-4 py-2 text-xs font-semibold text-primary-fg shadow-lg">
                Haritada gezinmek için dokunun
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMapActive(false)}
              className="absolute top-3 right-3 z-30 rounded-lg bg-surface/90 px-3 py-1.5 text-xs font-semibold text-fg shadow-md border border-border md:hidden"
            >
              Haritayı Kilitle
            </button>
          )}
          {pinned.slice(0, 24).map((l: any) => {
            const x = ((l.lng! - 26) / (45 - 26)) * 100;
            const y = ((42.5 - l.lat!) / (42.5 - 36)) * 100;
            return (
              <Link
                key={l.id}
                to="/ilan/$slug"
                params={{ slug: l.slug }}
                className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-[11px] text-primary-fg shadow-card"
                style={{ left: `${Math.min(92, Math.max(8, x))}%`, top: `${Math.min(88, Math.max(8, y))}%` }}
                title={l.title}
                aria-label={`${l.title}, ${formatPrice(l.price)}`}
              >
                {formatPrice(l.price)}
              </Link>
            );
          })}
        </div>
        )}
      </div>
      <h2 className="mt-10 font-display text-xl font-semibold">İllere göre</h2>
      {cities.length ? null : <p className="mt-4 text-sm text-muted">Henüz yayında ilan yok.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {cities
          .map(({ city, n }) => (
            <Link key={city} to="/search" search={{ city }} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm transition-[box-shadow,border-color] duration-150 hover:shadow-lift">
              <span className="font-medium">{city}</span>
              <span className="ml-2 text-muted">{n}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}