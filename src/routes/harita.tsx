import { createFileRoute, Link } from "@tanstack/react-router";
import { searchCatalog } from "@/lib/server/catalog";
import { CITY_COORDS } from "@/lib/data/geo";
import { formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/harita")({
  loader: () => searchCatalog({ data: { limit: 48, page: 1 } }),
  component: MapPage,
});

function MapPage() {
  const { listings } = Route.useLoaderData();
  const byCity = new Map<string, number>();
  for (const l of listings) {
    if (!l.city) continue;
    byCity.set(l.city, (byCity.get(l.city) ?? 0) + 1);
  }
  const pinned = listings.filter((l: any) => l.lat && l.lng);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Harita</h1>
      <p className="mt-2 text-sm text-muted">İlanlar şehir merkezine pinlenir. Mahalle seçimi ilan verirken kullanılır.</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative h-[420px] bg-elevated">
          <iframe
            title="Türkiye haritası"
            className="absolute inset-0 size-full border-0"
            src="https://www.openstreetmap.org/export/embed.html?bbox=25.6%2C35.8%2C45.0%2C42.4&layer=mapnik"
          />
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
              >
                {formatPrice(l.price)}
              </Link>
            );
          })}
        </div>
      </div>
      <h2 className="mt-10 font-display text-xl font-semibold">İllere göre</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[...byCity.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([city, n]) => (
            <Link key={city} to="/search" search={{ city }} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm transition-[box-shadow,border-color] duration-150 hover:shadow-lift">
              <span className="font-medium">{city}</span>
              <span className="ml-2 text-muted">{n}</span>
              {CITY_COORDS[city] ? null : null}
            </Link>
          ))}
      </div>
    </div>
  );
}