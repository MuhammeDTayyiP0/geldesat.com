import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { HASH_PATTERN, publishAuth, publishDenied, sha256Base64Url } from "@/lib/server/ota";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Upload step of `mobile-app/scripts/ota-publish.mjs`.
 * - JSON `{ hashes }` → `{ missing }`: which files the server does not have yet.
 * - multipart, one file per field named by its hash → stores them (hash checked).
 */
export const Route = createFileRoute("/api/ota/publish/assets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = publishAuth(request);
        if (auth !== "ok") return publishDenied(auth);
        const sql = await getSql();

        if ((request.headers.get("content-type") ?? "").includes("application/json")) {
          const body = (await request.json().catch(() => null)) as { hashes?: unknown } | null;
          const hashes = Array.isArray(body?.hashes) ? body.hashes.filter((h): h is string => typeof h === "string" && HASH_PATTERN.test(h)) : [];
          if (!hashes.length) return Response.json({ success: true, missing: [] });
          const rows = await sql.query<{ hash: string }>("select hash from ota_assets where hash = any($1::text[])", [hashes]);
          const have = new Set(rows.map((r) => r.hash));
          return Response.json({ success: true, missing: hashes.filter((h) => !have.has(h)) });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ success: false, error: "Dosyalar okunamadı." }, { status: 400 });
        }
        let stored = 0;
        for (const [hash, value] of form.entries()) {
          if (typeof value === "string") continue;
          if (!HASH_PATTERN.test(hash)) return Response.json({ success: false, error: `Geçersiz dosya adı: ${hash}` }, { status: 400 });
          if (value.size < 1 || value.size > MAX_FILE_BYTES) return Response.json({ success: false, error: `Dosya boyutu uygun değil: ${hash}` }, { status: 413 });
          const data = new Uint8Array(await value.arrayBuffer());
          if (sha256Base64Url(data) !== hash) return Response.json({ success: false, error: `Dosya içeriği hash ile uyuşmuyor: ${hash}` }, { status: 400 });
          await sql.query("insert into ota_assets (hash, content_type, data) values ($1, $2, $3) on conflict (hash) do nothing", [
            hash,
            (value.type || "application/octet-stream").slice(0, 100),
            Buffer.from(data),
          ]);
          stored += 1;
        }
        return Response.json({ success: true, stored });
      },
    },
  },
});
