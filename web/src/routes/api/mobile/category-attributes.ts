import { createFileRoute } from "@tanstack/react-router";
import { inheritedAttributes } from "@/lib/server/helpers";

export const Route = createFileRoute("/api/mobile/category-attributes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const categoryId = new URL(request.url).searchParams.get("categoryId")?.trim();
        if (!categoryId) return Response.json({ success: false, error: "Kategori seçin." }, { status: 400 });
        try {
          const attributes = await inheritedAttributes(categoryId);
          return Response.json({ success: true, attributes }, {
            headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Kategori özellikleri yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
