import { createFileRoute } from "@tanstack/react-router";
import { getCategoryCounts, getCategoryTree } from "@/lib/server/category-cache";
import { publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/categories")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [tree, counts] = await Promise.all([getCategoryTree(), getCategoryCounts()]);
          // Same shape and order as before: roots first, then by sort order and name.
          const rows = tree.rows
            .map(({ id, name, slug, parent_id, icon, sort_order }) => ({ id, name, slug, parent_id, icon, sort_order }))
            .sort((x, y) => (x.parent_id === null ? 0 : 1) - (y.parent_id === null ? 0 : 1) || (x.parent_id ?? "").localeCompare(y.parent_id ?? "") || x.sort_order - y.sort_order || x.name.localeCompare(y.name));

          return new Response(
            JSON.stringify({
              success: true,
              categories: rows,
              counts,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=300",
              },
            },
          );
        } catch (err) {
          const msg = publicErrorMessage(err, "Kategoriler getirilemedi");
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
