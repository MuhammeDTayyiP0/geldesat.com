import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};
const SAFE_NAME = /^[-a-zA-Z0-9_.]+\.(webp|jpg|jpeg|png)$/i;

/** Upload names are unique and never rewritten, so the name itself is a strong validator. */
function imageResponse(request: Request, name: string, mimeType: string, data: Uint8Array<ArrayBuffer>): Response {
  const etag = `"${name}"`;
  const headers = {
    "Content-Type": mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(data, { headers: { ...headers, "Content-Length": String(data.byteLength) } });
}

export const Route = createFileRoute("/uploads/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const name = params._splat;
        if (!name || !SAFE_NAME.test(name)) return new Response("Not found", { status: 404 });

        // Photos live in Postgres; only pre-migration local files sit in public/uploads.
        try {
          const sql = await getSql();
          const rows = await sql.query<{ mime_type: string; data: Buffer }>(
            "select mime_type,data from mobile_listing_images where storage_key=$1",
            [name],
          );
          if (rows[0]) return imageResponse(request, name, rows[0].mime_type, new Uint8Array(rows[0].data));
        } catch (err) {
          console.error("[uploads] lookup failed", err);
        }
        try {
          const data = await fs.readFile(join(process.cwd(), "public", "uploads", name));
          return imageResponse(request, name, MIME_TYPES[extname(name).toLowerCase()], new Uint8Array(data));
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
