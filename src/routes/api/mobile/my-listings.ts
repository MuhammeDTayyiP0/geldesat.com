import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { CITY_COORDS } from "@/lib/data/geo";
import { assertImages, ensureProfile, inheritedAttributes, mapListing, normalizeTrPhone, notify } from "@/lib/server/helpers";
import { listingFromRow, notifySearchHits } from "@/lib/server/ops";
import { newId, num, slugify } from "@/lib/utils";

const ListingInput = z.object({
  id: z.string().optional(), categoryId: z.string(), title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(5000), price: z.number().min(1).max(1_000_000_000),
  city: z.string().trim().min(1), district: z.string().trim().min(1), neighborhood: z.string().trim().max(60).optional(),
  phone: z.string().max(20).optional(), images: z.array(z.string()).max(10),
  attrs: z.record(z.string(), z.union([z.string(), z.number()])), storeId: z.string().optional(),
});

export const Route = createFileRoute("/api/mobile/my-listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select l.*, c.name as category_name, c.slug as category_slug,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()), '[]'::json) as boosts
             from listings l join categories c on c.id=l.category_id where l.user_id=$1 order by l.created_at desc`,
            [userId],
          );
          return Response.json({ success: true, listings: rows.map(mapListing) }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "İlanlarınız yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "İlan vermek için giriş yapın." }, { status: 401 });
          const parsed = ListingInput.safeParse(await request.json());
          if (!parsed.success) return Response.json({ success: false, error: "İlan bilgilerini kontrol edin." }, { status: 400 });
          const data = parsed.data;
          const sql = await getSql();
          const profile = await ensureProfile(userId);
          const current = await sql.query<{ phone: string | null; role: string }>("select phone,role from profiles where user_id=$1", [userId]);
          if (!current[0]?.phone && !data.phone) return Response.json({ success: false, error: "İlan vermek için profilinize telefon ekleyin." }, { status: 400 });
          const phone = data.phone?.trim() ? normalizeTrPhone(data.phone) : current[0]?.phone ?? null;
          assertImages(data.images);
          const category = await sql.query<{ id: string }>("select id from categories where id=$1", [data.categoryId]);
          if (!category[0]) return Response.json({ success: false, error: "Kategori bulunamadı." }, { status: 400 });
          const photoRequired = await sql.query<{ id: string }>(
            `with recursive chain as (select id,parent_id from categories where id=$1 union all select c.id,c.parent_id from categories c join chain ch on ch.parent_id=c.id)
             select id from chain where id in ('emlak','vasita')`, [data.categoryId],
          );
          if (photoRequired.length && !data.images.length) return Response.json({ success: false, error: "Emlak ve vasıta ilanlarında fotoğraf zorunludur." }, { status: 400 });
          for (const attr of (await inheritedAttributes(data.categoryId)).filter((item) => item.required)) {
            if (data.attrs[attr.name] == null || data.attrs[attr.name] === "") return Response.json({ success: false, error: `Zorunlu alan: ${attr.name}` }, { status: 400 });
          }
          const coords = CITY_COORDS[data.city];
          if (data.id) {
            const existing = await sql.query<{ user_id: string; slug: string; price: number | string; status: string }>("select user_id,slug,price,status from listings where id=$1", [data.id]);
            if (!existing[0] || (existing[0].user_id !== userId && profile.role !== "ADMIN")) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
            const status = existing[0].status === "REJECTED" ? "PENDING" : existing[0].status;
            await sql.query(
              `update listings set category_id=$2,title=$3,description=$4,price=$5,city=$6,district=$7,neighborhood=$8,lat=$9,lng=$10,images=$11::jsonb,attrs=$12::jsonb,phone_override=$13,store_id=$14,status=$15,updated_at=now() where id=$1`,
              [data.id,data.categoryId,data.title,data.description,data.price,data.city,data.district,data.neighborhood || null,coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),data.phone?.trim() ? phone : null,data.storeId || null,status],
            );
            if (num(existing[0].price) !== data.price) await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [data.id,data.price]);
            if (status === "PENDING") await notify(userId,"listing","İlanınız tekrar incelemede","Düzenlenen ilan onay kuyruğuna alındı.",`/ilan/${existing[0].slug}`);
            return Response.json({ success: true, id: data.id, slug: existing[0].slug, status });
          }
          const id = newId("lst");
          const slug = `${slugify(data.title) || "ilan"}-${id.slice(-6)}`;
          const prior = await sql.query<{ n: number }>("select count(*)::int as n from listings where user_id=$1", [userId]);
          const status = current[0]?.role === "ADMIN" || (prior[0]?.n ?? 0) === 0 ? "ACTIVE" : "PENDING";
          await sql.query(
            `insert into listings (id,slug,user_id,store_id,category_id,title,description,price,status,city,district,neighborhood,lat,lng,images,attrs,phone_override,expires_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,now()+interval '30 days')`,
            [id,slug,userId,data.storeId || null,data.categoryId,data.title,data.description,data.price,status,data.city,data.district,data.neighborhood || null,coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),phone],
          );
          await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [id,data.price]);
          if (status === "ACTIVE") {
            const full = await sql.query<Record<string, unknown>>("select * from listings where id=$1", [id]);
            if (full[0]) void notifySearchHits(listingFromRow(full[0], userId)).catch(() => undefined);
          }
          return Response.json({ success: true, id, slug, status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "İlan kaydedilemedi.";
          return Response.json({ success: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
