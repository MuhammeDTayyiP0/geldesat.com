import { createFileRoute } from "@tanstack/react-router";
import { firstInWindow, rateLimit, viewerKey } from "@/lib/server/helpers";

/**
 * Place search and reverse geocoding for the chat's meeting-point picker
 * (web and app). Calls OpenStreetMap Nominatim from the server so its usage
 * policy is met (identifying User-Agent, light traffic, caching) and the page
 * CSP stays `connect-src 'self'`.
 *
 *   GET /api/geo?q=kadıköy        → { results: [{ label, lat, lng }] }
 *   GET /api/geo?lat=..&lng=..    → { label }
 */
const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "GeldeSat/1.0 (https://www.geldesat.com; destek@geldesat.com)";
const TTL_MS = 24 * 60 * 60_000;

type Cached = { at: number; body: unknown };
const globalRef = globalThis as typeof globalThis & { __geldesatGeoCache__?: Map<string, Cached> };
const cache = (globalRef.__geldesatGeoCache__ ??= new Map());

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

/** Short Turkish-style label: "Caferağa Mah., Moda Cd., Kadıköy, İstanbul". */
function shortLabel(p: NominatimPlace): string {
  const a = p.address ?? {};
  const parts = [
    p.name && p.name !== a.road ? p.name : undefined,
    a.road,
    a.neighbourhood ?? a.suburb ?? a.quarter,
    a.town ?? a.city_district ?? a.district ?? a.county,
    a.province ?? a.city ?? a.state,
  ].filter((x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i);
  return (parts.length ? parts.slice(0, 4).join(", ") : (p.display_name ?? "")).slice(0, 120);
}

async function nominatim(path: string): Promise<unknown> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const body: unknown = await res.json();
  if (cache.size > 5000) cache.clear();
  cache.set(path, { at: Date.now(), body });
  return body;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store" } });

export const Route = createFileRoute("/api/geo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = viewerKey(request.headers);
        try {
          rateLimit(`geo:${key}`, 30, 60_000);
        } catch {
          return json({ error: "Çok fazla istek. Biraz bekleyin." }, 429);
        }
        // Nominatim allows about one request per second for the whole site.
        if (!firstInWindow("geo:global", 900)) await new Promise((r) => setTimeout(r, 900));
        try {
          const q = url.searchParams.get("q")?.trim();
          if (q) {
            if (q.length < 2 || q.length > 100) return json({ results: [] });
            const params = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "8", countrycodes: "tr" });
            const near = url.searchParams.get("near")?.split(",").map(Number);
            if (near?.length === 2 && near.every(Number.isFinite)) {
              const [lat, lng] = near;
              params.set("viewbox", `${lng - 0.6},${lat + 0.4},${lng + 0.6},${lat - 0.4}`);
            }
            const places = (await nominatim(`/search?${params}`)) as NominatimPlace[];
            return json({
              results: places.map((p) => ({ label: shortLabel(p), lat: Number(p.lat), lng: Number(p.lon) })).filter((p) => p.label),
            });
          }
          const lat = Number(url.searchParams.get("lat"));
          const lng = Number(url.searchParams.get("lng"));
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return json({ error: "Konum geçersiz." }, 400);
          }
          // ~100 m rounding keeps the cache useful and does not leak an exact position upstream.
          const params = new URLSearchParams({ lat: lat.toFixed(4), lon: lng.toFixed(4), format: "jsonv2", addressdetails: "1", zoom: "18" });
          const place = (await nominatim(`/reverse?${params}`)) as NominatimPlace;
          return json({ label: place?.lat ? shortLabel(place) : "" });
        } catch {
          return json({ error: "Adres bilgisi alınamadı." }, 502);
        }
      },
    },
  },
});
