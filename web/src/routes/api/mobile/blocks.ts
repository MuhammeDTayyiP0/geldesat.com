import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: only the removed `mobile/` client called this. The app (mobile-app/)
 * goes through /api/mobile/rpc, where chat rules such as read-receipt privacy
 * and notification limits live in one place.
 */
const gone = () => Response.json({ success: false, error: "Bu uygulama sürümü artık desteklenmiyor. Lütfen güncelleyin." }, { status: 410 });

export const Route = createFileRoute("/api/mobile/blocks")({
  server: { handlers: { GET: gone, POST: gone, PATCH: gone, DELETE: gone } },
});
