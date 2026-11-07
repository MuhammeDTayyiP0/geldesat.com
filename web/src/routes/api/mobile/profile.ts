import { createFileRoute } from "@tanstack/react-router";

/** Retired: only the removed `mobile/` client called this. The app uses /api/mobile/rpc. */
const gone = () => Response.json({ success: false, error: "Bu uygulama sürümü artık desteklenmiyor. Lütfen güncelleyin." }, { status: 410 });

export const Route = createFileRoute("/api/mobile/profile")({
  server: { handlers: { GET: gone, POST: gone, PATCH: gone, DELETE: gone } },
});
