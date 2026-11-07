import { getSql } from "@/lib/db";
import { notify } from "./helpers";

let lastSweep = 0;

export async function sweepExpiryReminders(force = false): Promise<number> {
  if (!force && Date.now() - lastSweep < 60_000) return 0;
  lastSweep = Date.now();
  const sql = await getSql();
  const rows = await sql.query<{ id: string; user_id: string; title: string; slug: string }>(
    `select l.id, l.user_id, l.title, l.slug
     from listings l
     where l.status = 'ACTIVE'
       and l.expires_at is not null
       and l.expires_at > now()
       and l.expires_at < now() + interval '3 days'
       and (l.expiry_notified_at is null or l.expiry_notified_at < now() - interval '25 days')
     limit 30`,
  );
  for (const r of rows) {
    await sql.query("update listings set expiry_notified_at = now() where id = $1", [r.id]);
    await notify(
      r.user_id,
      "expiry",
      "İlanınızın süresi dolmak üzere",
      `${r.title} — İlanlarım’dan 30 gün uzatabilirsiniz.`,
      `/ilan/${r.slug}`,
    );
  }
  return rows.length;
}
