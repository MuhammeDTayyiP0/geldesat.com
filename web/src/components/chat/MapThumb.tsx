import { MapPin } from "lucide-react";
import { previewTiles } from "@/lib/map-tiles";

/** Small static map centred on a meeting point, with a pin, for chat bubbles. */
export function MapThumb({ lat, lng, width = 240, height = 140 }: { lat: number; lng: number; width?: number; height?: number }) {
  const tiles = previewTiles(lat, lng, 16, width, height);
  return (
    <span className="relative block max-w-full overflow-hidden rounded-xl bg-elevated" style={{ width, height }} aria-hidden="true">
      <span className="map-thumb-tiles absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width, height }}>
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: t.left, top: t.top, width: 256, height: 256 }}
          />
        ))}
      </span>
      <MapPin
        className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-[30px] fill-danger text-white drop-shadow"
        strokeWidth={1.5}
      />
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] leading-tight text-black">© OpenStreetMap</span>
    </span>
  );
}
