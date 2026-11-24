import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await sql.query("SELECT 1");
          return Response.json(
            { ok: true, db: "ok", uptime: Math.round(process.uptime()) },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
