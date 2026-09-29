import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export const Route = createFileRoute("/uploads/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const subPath = params._splat;
        if (!subPath || subPath.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const filePath = join(process.cwd(), "public", "uploads", subPath);
        try {
          const data = await fs.readFile(filePath);
          const ext = extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || "application/octet-stream";

          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          try {
            const sql = await getSql();
            const rows = await sql.query<{ mime_type: string; data: Buffer }>(
              "select mime_type,data from mobile_listing_images where storage_key=$1",
              [subPath],
            );
            const image = rows[0];
            if (!image) return new Response("Not found", { status: 404 });
            return new Response(new Uint8Array(image.data), {
              headers: {
                "Content-Type": image.mime_type,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
              },
            });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        }
      },
    },
  },
});
