import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { ensureProfile, normalizeTrPhone } from "@/lib/server/helpers";
import { newId, slugify } from "@/lib/utils";

const ProfileInput = z.object({
  display_name: z.string().trim().min(2).max(60),
  phone: z.string().max(20).optional(),
  bio: z.string().max(400).optional(),
  city: z.string().max(40).optional(),
  district: z.string().max(40).optional(),
});
const StoreInput = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().max(400).optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
});

async function getUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/mobile/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getUserId(request);
          if (!userId) return Response.json({ success: false, error: "Oturum açmanız gerekiyor." }, { status: 401 });

          const sql = await getSql();
          await ensureProfile(userId);
          const [profileRows, storeRows, savedRows] = await Promise.all([
            sql.query<Record<string, unknown>>(
              `select p.display_name, p.phone, p.bio, p.city, p.district,
                (select count(*)::int from listings where user_id=p.user_id) as listing_count,
                (select count(*)::int from listings where user_id=p.user_id and status='ACTIVE') as active_count,
                (select count(*)::int from favorites where user_id=p.user_id) as favorite_count,
                (select coalesce(avg(rating),0) from reviews where seller_id=p.user_id) as rating_avg,
                (select count(*)::int from reviews where seller_id=p.user_id) as rating_count
               from profiles p where p.user_id=$1`,
              [userId],
            ),
            sql.query<Record<string, unknown>>(
              "select id, name, slug, plan, city, description from stores where user_id=$1 limit 1",
              [userId],
            ),
            sql.query<Record<string, unknown>>(
              "select id, label, query, filters, created_at from saved_searches where user_id=$1 order by created_at desc",
              [userId],
            ),
          ]);
          const profile = profileRows[0];
          if (!profile) return Response.json({ success: false, error: "Profil bulunamadı." }, { status: 404 });

          return Response.json({
            success: true,
            profile: {
              display_name: String(profile.display_name ?? ""),
              phone: profile.phone ? String(profile.phone) : "",
              bio: profile.bio ? String(profile.bio) : "",
              city: profile.city ? String(profile.city) : "",
              district: profile.district ? String(profile.district) : "",
              listing_count: Number(profile.listing_count ?? 0),
              active_count: Number(profile.active_count ?? 0),
              favorite_count: Number(profile.favorite_count ?? 0),
              rating_avg: Number(profile.rating_avg ?? 0),
              rating_count: Number(profile.rating_count ?? 0),
            },
            store: storeRows[0] ? {
              id: String(storeRows[0].id),
              name: String(storeRows[0].name),
              slug: String(storeRows[0].slug),
              plan: String(storeRows[0].plan),
              city: String(storeRows[0].city ?? ""),
              description: String(storeRows[0].description ?? ""),
            } : null,
            savedSearches: savedRows.map((row) => ({
              id: String(row.id),
              label: String(row.label ?? ""),
              query: String(row.query ?? ""),
              filters: typeof row.filters === "string" ? row.filters : JSON.stringify(row.filters ?? {}),
            })),
          }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Profil yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getUserId(request);
          if (!userId) return Response.json({ success: false, error: "Oturum açmanız gerekiyor." }, { status: 401 });

          const body: unknown = await request.json();
          if (body && typeof body === "object" && "action" in body && body.action === "store") {
            const parsedStore = StoreInput.safeParse(body);
            if (!parsedStore.success) return Response.json({ success: false, error: "Mağaza bilgilerini kontrol edin." }, { status: 400 });
            const sql = await getSql();
            await ensureProfile(userId);
            const existing = await sql.query<{ id: string; slug: string }>(
              "select id, slug from stores where user_id=$1",
              [userId],
            );
            if (existing[0]) {
              await sql.query(
                "update stores set name=$2, description=$3, city=$4, phone=$5 where id=$1",
                [existing[0].id, parsedStore.data.name, parsedStore.data.description || null, parsedStore.data.city || null, parsedStore.data.phone || null],
              );
              return Response.json({ success: true, store: { id: existing[0].id, slug: existing[0].slug } });
            }
            const id = newId("str");
            const slug = `${slugify(parsedStore.data.name)}-${id.slice(-4)}`;
            await sql.query(
              `insert into stores (id, user_id, name, slug, description, city, phone, plan)
               values ($1,$2,$3,$4,$5,$6,$7,'BASIC')`,
              [id, userId, parsedStore.data.name, slug, parsedStore.data.description || null, parsedStore.data.city || null, parsedStore.data.phone || null],
            );
            return Response.json({ success: true, store: { id, slug } });
          }

          const parsed = ProfileInput.safeParse(body);
          if (!parsed.success) {
            return Response.json({ success: false, error: "Profil bilgilerini kontrol edin." }, { status: 400 });
          }

          const sql = await getSql();
          await ensureProfile(userId);
          const phone = parsed.data.phone?.trim() ? normalizeTrPhone(parsed.data.phone) : null;
          if (phone) {
            const existing = await sql.query<{ user_id: string }>(
              "select user_id from profiles where phone=$1 and user_id<>$2",
              [phone, userId],
            );
            if (existing[0]) return Response.json({ success: false, error: "Bu telefon başka bir hesaba kayıtlı." }, { status: 409 });
          }
          await sql.query(
            `update profiles set display_name=$2, phone=$3, bio=$4, city=$5, district=$6 where user_id=$1`,
            [userId, parsed.data.display_name, phone, parsed.data.bio?.trim() || null, parsed.data.city?.trim() || null, parsed.data.district?.trim() || null],
          );
          return Response.json({ success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Profil kaydedilemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const userId = await getUserId(request);
          if (!userId) return Response.json({ success: false, error: "Oturum açmanız gerekiyor." }, { status: 401 });
          const id = new URL(request.url).searchParams.get("id");
          if (!id) return Response.json({ success: false, error: "Kayıtlı arama bulunamadı." }, { status: 400 });
          const sql = await getSql();
          await sql.query("delete from saved_searches where id=$1 and user_id=$2", [id, userId]);
          return Response.json({ success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Kayıtlı arama silinemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
