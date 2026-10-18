import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { storedImageResponse } from "@/lib/server/image-serve.server";

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};
const SAFE_NAME = /^[-a-zA-Z0-9_.]+\.(webp|jpg|jpeg|png)$/i;

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
          if (rows[0]) return await storedImageResponse(request, name, rows[0].mime_type, rows[0].data);
        } catch (err) {
          console.error("[uploads] lookup failed", err);
        }
        try {
          const data = await fs.readFile(join(process.cwd(), "public", "uploads", name));
          return await storedImageResponse(request, name, MIME_TYPES[extname(name).toLowerCase()], data);
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
