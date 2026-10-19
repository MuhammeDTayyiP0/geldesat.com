import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * Housekeeping for a scheduler (Coolify Scheduled Task → `node scripts/cron.mjs`):
 * expiry reminders, account/chat retention purges and unread-message digests.
 * The same sweeps also run opportunistically off traffic; this makes them
 * happen on time even when the site is quiet.
 */
export const Route = createFileRoute("/api/cron/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Not found", { status: 404 });
        const [{ sweepExpiryReminders }, { sweepRetention }, { sweepMessageDigests }] = await Promise.all([
          import("@/lib/server/ops"),
          import("@/lib/server/retention"),
          import("@/lib/server/message-digest"),
        ]);
        const results: Record<string, string> = {};
        for (const [name, run] of [
          ["expiry", () => sweepExpiryReminders(true)],
          ["retention", () => sweepRetention(true)],
          ["digest", () => sweepMessageDigests(true)],
        ] as const) {
          try {
            await run();
            results[name] = "ok";
          } catch (err) {
            console.error(`[cron] ${name} failed`, err);
            results[name] = "error";
          }
        }
        const ok = Object.values(results).every((r) => r === "ok");
        return Response.json({ ok, results }, { status: ok ? 200 : 500 });
      },
    },
  },
});
