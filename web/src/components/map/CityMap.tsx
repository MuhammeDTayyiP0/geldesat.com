import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useNavigate } from "@tanstack/react-router";
import { CITY_COORDS } from "@/lib/data/geo";
import { TILE_ATTRIBUTION, TILE_URL, TURKEY_CENTER } from "@/lib/map-tiles";
import type { ListingCard } from "@/lib/server/helpers";
import { formatPrice } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};

type LeafletLib = typeof import("leaflet");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function readMapBounds(map: LeafletMap): MapBounds {
  const b = map.getBounds();
  return {
    north: clamp(b.getNorth(), -90, 90),
    south: clamp(b.getSouth(), -90, 90),
    east: clamp(b.getEast(), -180, 180),
    west: clamp(b.getWest(), -180, 180),
    zoom: map.getZoom(),
  };
}

function pinCoords(pin: ListingCard): { lat: number; lng: number } | null {
  if (pin.lat != null && pin.lng != null && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
    return { lat: pin.lat, lng: pin.lng };
  }
  if (pin.city && CITY_COORDS[pin.city]) {
    return CITY_COORDS[pin.city];
  }
  return null;
}

/** Turkey map showing either province count circles or interactive listing pins/clusters. */
export function CityMap({
  cities,
  pins,
  selectedPinId,
  onBoundsChange,
  onPinSelect,
}: {
  cities: Array<{ city: string; n: number }>;
  pins?: ListingCard[];
  selectedPinId?: string | null;
  onBoundsChange?: (bounds: MapBounds) => void;
  onPinSelect?: (listing: ListingCard) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletLib | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onPinSelectRef = useRef(onPinSelect);
  const [mapReady, setMapReady] = useState(false);
  const navigate = useNavigate();

  onBoundsChangeRef.current = onBoundsChange;
  onPinSelectRef.current = onPinSelect;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !holder.current) return;
      const map = L.map(holder.current, { center: TURKEY_CENTER, zoom: 6, scrollWheelZoom: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = layer;

      const emitBounds = () => {
        onBoundsChangeRef.current?.(readMapBounds(map));
      };
      map.on("moveend", emitBounds);
      emitBounds();
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!mapReady || !L || !map || !layer) return;

    layer.clearLayers();

    if (pins === undefined) {
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
          .addTo(layer)
          .on("click", () => void navigate({ to: "/search", search: { city } }));
      }
      return;
    }

    const zoom = map.getZoom();
    const step = zoom >= 15 ? 0.0015 : 360 / Math.pow(2, zoom + 3);
    const buckets = new Map<string, Array<{ pin: ListingCard; lat: number; lng: number }>>();

    for (const pin of pins) {
      const coords = pinCoords(pin);
      if (!coords) continue;
      const key = `${Math.floor(coords.lat / step)}:${Math.floor(coords.lng / step)}`;
      const list = buckets.get(key);
      if (list) list.push({ pin, lat: coords.lat, lng: coords.lng });
      else buckets.set(key, [{ pin, lat: coords.lat, lng: coords.lng }]);
    }

    for (const items of buckets.values()) {
      if (items.length === 1) {
        const { pin, lat, lng } = items[0];
        const active = pin.id === selectedPinId;
        const label = escapeHtml(formatPrice(pin.price, pin.currency));
        const cls = active
          ? "inline-flex items-center whitespace-nowrap rounded-full border border-primary bg-primary-solid px-2.5 py-1 text-xs font-bold text-primary-fg shadow-lift"
          : "inline-flex items-center whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg shadow-card hover:border-primary";
        const icon = L.divIcon({
          className: "",
          html: `<span class="${cls}">${label}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 14],
        });
        L.marker([lat, lng], {
          icon,
          title: pin.title,
          alt: pin.title,
          keyboard: true,
          zIndexOffset: active ? 500 : 0,
        })
          .addTo(layer)
          .on("click", () => onPinSelectRef.current?.(pin));
        continue;
      }

      let sumLat = 0;
      let sumLng = 0;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const item of items) {
        sumLat += item.lat;
        sumLng += item.lng;
        if (item.lat < minLat) minLat = item.lat;
        if (item.lat > maxLat) maxLat = item.lat;
        if (item.lng < minLng) minLng = item.lng;
        if (item.lng > maxLng) maxLng = item.lng;
      }
      const avgLat = sumLat / items.length;
      const avgLng = sumLng / items.length;
      const spread = maxLat - minLat > 0.0005 || maxLng - minLng > 0.0005;
      const containsSelected = items.some((i) => i.pin.id === selectedPinId);
      const cls = containsSelected
        ? "grid h-9 min-w-9 place-items-center rounded-full border-2 border-white bg-primary-solid px-2 text-xs font-bold text-primary-fg shadow-lift ring-2 ring-primary"
        : "grid h-9 min-w-9 place-items-center rounded-full border-2 border-white bg-primary-solid px-2 text-xs font-bold text-primary-fg shadow-card";

      const icon = L.divIcon({
        className: "",
        html: `<span class="${cls}">${items.length}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([avgLat, avgLng], {
        icon,
        title: `${items.length} ilan`,
        alt: `${items.length} ilan`,
        keyboard: true,
      })
        .addTo(layer)
        .on("click", () => {
          if (spread && zoom < 15) {
            map.setView([avgLat, avgLng], Math.min(15, zoom + 2));
          } else {
            const idx = items.findIndex((i) => i.pin.id === selectedPinId);
            const next = items[(idx + 1) % items.length];
            if (next) onPinSelectRef.current?.(next.pin);
          }
        });
    }
  }, [cities, pins, selectedPinId, mapReady, navigate]);

  return <div ref={holder} className="relative z-0 h-[420px] w-full sm:h-[480px]" role="region" aria-label="İllere göre ilan haritası" />;
}
