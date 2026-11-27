import { createFileRoute } from "@tanstack/react-router";
import { readJson } from "@/lib/server/request-body";
import { getSql } from "@/lib/db";
import { assertMobileJsonWrite, getMobileUserId } from "@/lib/server/mobile-auth";
import { assertOwnerStatus, assertRenewable, isExpired } from "@/lib/listing-status";
import { deleteUnusedListingImages } from "@/lib/server/upload.server";
import { assertNotClosing } from "@/lib/server/listing-write";
import { rateLimit } from "@/lib/server/helpers";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/my-listings/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const csrfError = assertMobileJsonWrite(request);
          if (csrfError) return csrfError;
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          rateLimit(`my-listing-mut:${userId}`, 60, 60_000);
          const body = (await readJson(request)) as { action?: unknown; status?: unknown };
          const sql = await getSql();

          const deletedImages = await sql.transaction(async (tx) => {
            const prof = await tx.query<{ banned_at: unknown }>(
              "select banned_at from profiles where user_id=$1 limit 1",
              [userId],
            );
            if (prof[0]?.banned_at) throw new Error("Hesabınız askıya alınmış.");

            const rows = await tx.query<{ id: string; user_id: string; status: string; slug: string; images: string[]; approved_at: string | null; expires_at: string | null }>(
              "select id,user_id,status,slug,images,approved_at,expires_at from listings where id=$1 and user_id=$2 for update",
              [params.id, userId],
            );
            if (!rows[0]) return null;

            if (body.action === "delete") {
              await tx.query("delete from listings where id=$1 and user_id=$2", [params.id, userId]);
              return rows[0].images || [];
            }
            if (body.action === "renew") {
              assertRenewable(rows[0].status);
              await assertNotClosing(tx, userId);
              await tx.query("update listings set expires_at=now()+interval '30 days',updated_at=now() where id=$1 and user_id=$2", [params.id, userId]);
              return [] as string[];
            }
            if (body.action === "status" && ["ACTIVE", "INACTIVE", "SOLD"].includes(String(body.status))) {
              const next = String(body.status);
              assertOwnerStatus(next, { status: rows[0].status, approved: Boolean(rows[0].approved_at), expired: isExpired(rows[0].expires_at) });
              if (next === "ACTIVE") await assertNotClosing(tx, userId);
              const updated = await tx.query<{ id: string }>(
                `update listings set status=$2, updated_at=now()
                 where id=$1 and user_id=$3 ${next === "ACTIVE" ? "and approved_at is not null" : ""}
                 returning id`,
                [params.id, next, userId],
              );
              if (!updated[0]) throw new Error("İlan güncellenemedi.");
              return [] as string[];
            }
            throw new Error("UNKNOWN_ACTION");
          });

          if (deletedImages === null) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          if (deletedImages.length) await deleteUnusedListingImages(sql, userId, deletedImages);
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "UNKNOWN_ACTION") {
            return Response.json({ success: false, error: "İşlem tanınmadı." }, { status: 400 });
          }
          const message = publicErrorMessage(error, "İlan güncellenemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 400) });
        }
      },
    },
  },
});
