import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { mapListing, subtreeIds } from "@/lib/server/helpers";

export const Route = createFileRoute("/api/mobile/listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);
          const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
          const category = url.searchParams.get("category");
          const q = url.searchParams.get("q")?.trim();
          const urgentOnly = url.searchParams.get("urgent") === "true";
          const featuredOnly = url.searchParams.get("featured") === "true";
          const city = url.searchParams.get("city")?.trim();

          const sql = await getSql();

          const conditions: string[] = ["l.status = 'ACTIVE'"];
          const params: unknown[] = [];
          let pIdx = 1;

          if (category) {
            const catIds = await subtreeIds(category);
            if (catIds.length > 0) {
              conditions.push(`l.category_id = any($${pIdx}::text[])`);
              params.push(catIds);
              pIdx += 1;
            }
          }

          if (q) {
            conditions.push(`(l.title ilike $${pIdx} or l.description ilike $${pIdx})`);
            params.push(`%${q}%`);
            pIdx += 1;
          }

          if (city) {
            conditions.push(`l.city ilike $${pIdx}`);
            params.push(city);
            pIdx += 1;
          }

          if (urgentOnly) {
            conditions.push(`(l.boosts ? 'ACIL')`);
          }

          if (featuredOnly) {
            conditions.push(`(l.featured_until is not null and l.featured_until > now())`);
          }

          const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

          // Toplam ilan sayısı
          const countRes = await sql.query<{ count: string }>(
            `select count(*)::text as count from listings l ${whereClause}`,
            params,
          );
          const total = Number(countRes[0]?.count || 0);

          // Sıralama ve sayfalama
          params.push(limit);
          const limitParam = `$${pIdx++}`;
          params.push(offset);
          const offsetParam = `$${pIdx++}`;

          const rows = await sql.query<Record<string, unknown>>(
            `select l.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    p.display_name as seller_name,
                    s.name as store_name,
                    s.slug as store_slug
             from listings l
             left join categories c on c.id = l.category_id
             left join profiles p on p.user_id = l.user_id
             left join stores s on s.id = l.store_id
             ${whereClause}
             order by
               (l.featured_until is not null and l.featured_until > now()) desc,
               l.created_at desc
             limit ${limitParam} offset ${offsetParam}`,
            params,
          );

          const listings = rows.map(mapListing);

          return new Response(
            JSON.stringify({
              success: true,
              total,
              limit,
              offset,
              listings,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=15",
              },
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "İlanlar getirilemedi";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      },
    },
  },
});
