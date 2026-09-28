import { createFileRoute } from "@tanstack/react-router";
import { searchListings } from "@/lib/server/catalog";

export const Route = createFileRoute("/api/mobile/listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);
          const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
          const category = url.searchParams.get("category") || undefined;
          const q = url.searchParams.get("q")?.trim() || undefined;
          const urgent = url.searchParams.get("urgent") === "true";
          const featured = url.searchParams.get("featured") === "true";
          const city = url.searchParams.get("city")?.trim() || undefined;
          const district = url.searchParams.get("district")?.trim() || undefined;
          const neighborhood = url.searchParams.get("neighborhood")?.trim() || undefined;
          const minPrice = numberParam(url.searchParams.get("minPrice"));
          const maxPrice = numberParam(url.searchParams.get("maxPrice"));
          const minYear = numberParam(url.searchParams.get("minYear"));
          const maxYear = numberParam(url.searchParams.get("maxYear"));
          const minKm = numberParam(url.searchParams.get("minKm"));
          const maxKm = numberParam(url.searchParams.get("maxKm"));
          const minM2 = numberParam(url.searchParams.get("minM2"));
          const maxM2 = numberParam(url.searchParams.get("maxM2"));
          const rawAttrs = url.searchParams.get("attrs");
          let attrs: Record<string, string | string[] | number> | undefined;
          if (rawAttrs) {
            try {
              const parsed: unknown = JSON.parse(rawAttrs);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                attrs = parsed as Record<string, string | string[] | number>;
              }
            } catch {
              return Response.json({ success: false, error: "Filtre bilgileri geçersiz." }, { status: 400 });
            }
          }
          const requestedSort = url.searchParams.get("sort");
          const sort = ["date_desc", "date_asc", "price_asc", "price_desc", "views_desc"].includes(requestedSort ?? "")
            ? requestedSort as "date_desc" | "date_asc" | "price_asc" | "price_desc" | "views_desc"
            : "date_desc";
          const page = Math.floor(offset / limit) + 1;

          // Web and mobile now share the same visibility, expiry, and sort rules.
          const result = await searchListings({
            limit,
            page,
            sort,
            category,
            q,
            urgent,
            featured,
            city,
            district,
            neighborhood,
            minPrice,
            maxPrice,
            minYear,
            maxYear,
            minKm,
            maxKm,
            minM2,
            maxM2,
            attrs,
          });

          return Response.json(
            {
              success: true,
              total: result.total,
              limit,
              offset,
              listings: result.listings,
              page: result.page,
              pages: result.pages,
            },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=15",
              },
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "İlanlar getirilemedi";
          return Response.json(
            { success: false, error: msg },
            {
              status: 500,
              headers: { "Access-Control-Allow-Origin": "*" },
            },
          );
        }
      },
    },
  },
});

function numberParam(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
