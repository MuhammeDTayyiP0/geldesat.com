import { MapPin } from "lucide-react";
import { previewTiles } from "@/lib/map-tiles";

/** Small static map centred on a meeting point, with a pin, for chat bubbles. */
export function MapThumb({ lat, lng, width = 240, height = 140 }: { lat: number; lng: number; width?: number; height?: number }) {
  const tiles = previewTiles(lat, lng, 16, width, height);
  return (
    <span className="relative block overflow-hidden rounded-xl bg-elevated" style={{ width, height }} aria-hidden="true">
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
      <MapPin
        className="absolute size-8 fill-danger text-white drop-shadow"
        style={{ left: width / 2 - 16, top: height / 2 - 30 }}
        strokeWidth={1.5}
      />
    </span>
  );
}
