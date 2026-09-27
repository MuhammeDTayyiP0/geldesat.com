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
          const page = Math.floor(offset / limit) + 1;

          // Web and mobile now share the same visibility, expiry, and sort rules.
          const result = await searchListings({
            limit,
            page,
            sort: "date_desc",
            category,
            q,
            urgent,
            featured,
            city,
          });

          return Response.json(
            {
              success: true,
              total: result.total,
              limit,
              offset,
              listings: result.listings,
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
