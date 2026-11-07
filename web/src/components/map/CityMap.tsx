import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useNavigate } from "@tanstack/react-router";
import { CITY_COORDS } from "@/lib/data/geo";
import { TILE_ATTRIBUTION, TILE_URL, TURKEY_CENTER } from "@/lib/map-tiles";
import "leaflet/dist/leaflet.css";

/** Turkey with one marker per city showing its live listing count; a marker opens that city's listings. */
export function CityMap({ cities }: { cities: Array<{ city: string; n: number }> }) {
  const holder = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !holder.current) return;
      map = L.map(holder.current, { center: TURKEY_CENTER, zoom: 6, scrollWheelZoom: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
      for (const { city, n } of cities) {
        const coords = CITY_COORDS[city];
        if (!coords) continue;
        const icon = L.divIcon({
          className: "",
          html: `<span class="grid h-8 min-w-8 place-items-center rounded-full bg-primary-solid px-2 text-xs font-bold text-primary-fg shadow-card">${n}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([coords.lat, coords.lng], { icon, title: `${city}: ${n} ilan`, alt: `${city}: ${n} ilan`, keyboard: true })
          .addTo(map)
          .on("click", () => void navigate({ to: "/search", search: { city } }));
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [cities, navigate]);

  return <div ref={holder} className="relative z-0 h-[420px] w-full" role="region" aria-label="İllere göre ilan haritası" />;
}
