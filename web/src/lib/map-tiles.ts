/**
 * Map tiles for the chat's meeting points: OpenStreetMap, served through this
 * site's /api/tiles (cached, no API key; CARTO's free basemaps now need one).
 * Kept in step with mobile-app/src/features/map/tiles.ts.
 */
export const TILE_URL = "/api/tiles/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Turkey's centre, for a picker opened without a known position. */
export const TURKEY_CENTER = { lat: 39.0, lng: 35.2, zoom: 6 };

/** Fractional tile coordinates of a point at zoom `z` (Web Mercator). */
export function tilePoint(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

export function tileUrl(x: number, y: number, z: number): string {
  return `/api/tiles/${z}/${x}/${y}.png`;
}

/**
 * Tiles (and where to draw them) that cover a `width`×`height` box centred on
 * the point: a static map preview without a maps API.
 */
export function previewTiles(lat: number, lng: number, z: number, width: number, height: number) {
  const size = 256;
  const p = tilePoint(lat, lng, z);
  const originX = p.x * size - width / 2;
  const originY = p.y * size - height / 2;
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let tx = Math.floor(originX / size); tx <= Math.floor((originX + width) / size); tx++) {
    for (let ty = Math.floor(originY / size); ty <= Math.floor((originY + height) / size); ty++) {
      tiles.push({ key: `${tx}:${ty}`, url: tileUrl(tx, ty, z), left: tx * size - originX, top: ty * size - originY });
    }
  }
  return tiles;
}
