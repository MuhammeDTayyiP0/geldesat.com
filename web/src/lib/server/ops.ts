import { getSql } from "@/lib/db";
import { notify } from "./helpers";

let lastSweep = 0;
let running = false;

export async function sweepExpiryReminders(force = false): Promise<number> {
  if (running || (!force && Date.now() - lastSweep < 60_000)) return 0;
  running = true;
  try {
    const sql = await getSql();
    // Claim due listings atomically under row locks so concurrent cron + traffic sweeps never duplicate notifications.
    const rows = await sql.transaction(async (tx) => {
      const picked = await tx.query<{ id: string; user_id: string; title: string; slug: string }>(
        `select l.id, l.user_id, l.title, l.slug
         from listings l
         where l.status = 'ACTIVE'
           and l.expires_at is not null
           and l.expires_at > now()
           and l.expires_at < now() + interval '3 days'
           and (l.expiry_notified_at is null or l.expiry_notified_at < now() - interval '25 days')
         limit 30
         for update skip locked`,
      );
      if (picked.length) {
        await tx.query("update listings set expiry_notified_at = now() where id = any($1::text[])", [picked.map((r) => r.id)]);
      }
      return picked;
    });
    lastSweep = Date.now();
    const settled = await Promise.allSettled(
      rows.map((r) =>
        notify(
          r.user_id,
          "expiry",
          "İlanınızın süresi dolmak üzere",
          `${r.title} — İlanlarım’dan 30 gün uzatabilirsiniz.`,
          `/ilan/${r.slug}`,
        ),
      ),
    );
    const failedIds = rows.filter((_, i) => settled[i]?.status === "rejected").map((r) => r.id);
    if (failedIds.length) {
      await sql.query("update listings set expiry_notified_at = null where id = any($1::text[])", [failedIds]).catch(() => undefined);
    }
    return rows.length - failedIds.length;
  } finally {
    running = false;
  }
}
