import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { searchListings } from "@/lib/server/catalog";
import { publicErrorMessage } from "@/lib/server/errors";

const AttrsSchema = z
  .record(
    z.string().max(60),
    z.union([z.string().max(100), z.number().finite(), z.array(z.string().max(100)).max(20)]),
  )
  .refine((obj) => Object.keys(obj).length <= 30);

export const Route = createFileRoute("/api/mobile/listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const whole = (name: string, fallback: number) => {
            const value = Number(url.searchParams.get(name) ?? fallback);
            return Number.isInteger(value) && value >= 0 ? value : fallback;
          };
          const limit = Math.min(Math.max(whole("limit", 20), 1), 50);
          const offset = Math.min(whole("offset", 0), 100_000);
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
            if (rawAttrs.length > 4096) {
              return Response.json({ success: false, error: "Filtre bilgileri geçersiz." }, { status: 400 });
            }
            try {
              const parsed = AttrsSchema.safeParse(JSON.parse(rawAttrs));
              if (!parsed.success) {
                return Response.json({ success: false, error: "Filtre bilgileri geçersiz." }, { status: 400 });
              }
              attrs = parsed.data;
            } catch {
              return Response.json({ success: false, error: "Filtre bilgileri geçersiz." }, { status: 400 });
            }
          }
          const requestedSort = url.searchParams.get("sort");
          const sort = ["date_desc", "date_asc", "price_asc", "price_desc", "views_desc", "distance"].includes(requestedSort ?? "")
            ? requestedSort as "date_desc" | "date_asc" | "price_asc" | "price_desc" | "views_desc" | "distance"
            : "date_desc";
          const nearLat = numberParam(url.searchParams.get("nearLat"));
          const nearLng = numberParam(url.searchParams.get("nearLng"));
          const maxDistanceKm = numberParam(url.searchParams.get("maxDistanceKm"));
          const rawPostedWithin = url.searchParams.get("postedWithin");
          const postedWithin =
            rawPostedWithin === "1" || rawPostedWithin === "3" || rawPostedWithin === "7" || rawPostedWithin === "30"
              ? rawPostedWithin
              : undefined;
          const withPhotos = url.searchParams.get("withPhotos") === "true" || url.searchParams.get("withPhotos") === "1" ? true : undefined;
          const rawSellerType = url.searchParams.get("sellerType");
          const sellerType = rawSellerType === "owner" || rawSellerType === "store" ? rawSellerType : undefined;
          const priceDropped = url.searchParams.get("priceDropped") === "true" || url.searchParams.get("priceDropped") === "1" ? true : undefined;
          const page = Math.floor(offset / limit) + 1;

          // Web and mobile now share the same visibility, expiry, and sort rules.
          const result = await searchListings({
            limit,
            page,
            sort,
            nearLat: nearLat != null && nearLat >= -90 && nearLat <= 90 ? nearLat : undefined,
            nearLng: nearLng != null && nearLng >= -180 && nearLng <= 180 ? nearLng : undefined,
            maxDistanceKm: maxDistanceKm != null && maxDistanceKm >= 1 && maxDistanceKm <= 500 ? maxDistanceKm : undefined,
            category,
            q,
            urgent,
            featured,
            postedWithin,
            withPhotos,
            sellerType,
            priceDropped,
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
              offset: (result.page - 1) * limit,
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
          const msg = publicErrorMessage(err, "İlanlar getirilemedi");
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
