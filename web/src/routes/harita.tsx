import { createFileRoute, Link } from "@tanstack/react-router";
import { mapCityCounts } from "@/lib/server/catalog";
import { CityMap } from "@/components/map/CityMap";
import { BrandSpinner } from "@/components/brand/BrandSpinner";

export const Route = createFileRoute("/harita")({
  loader: async () => {
    const cities = await mapCityCounts();
    return { cities };
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
  const { cities } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Harita</h1>
      <p className="mt-2 text-sm text-muted">
        Her ildeki yayında ilan sayısı. Bir ile dokunarak ilanlarını görün.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <CityMap cities={cities} />
      </div>
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