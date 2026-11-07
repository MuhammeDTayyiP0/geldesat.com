import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: this path stored photos without the watermark and without removing
 * EXIF location data. Uploads go through /api/upload; stored photos stay readable
 * at /api/mobile/images/{id}.
 */
const gone = () => Response.json({ success: false, error: "Bu uygulama sürümü artık desteklenmiyor. Lütfen güncelleyin." }, { status: 410 });

export const Route = createFileRoute("/api/mobile/images")({
  server: { handlers: { POST: gone } },
});
