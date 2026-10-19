import { getSql } from "@/lib/db";
import { notify } from "./helpers";

let lastSweep = 0;

export async function sweepExpiryReminders(force = false) {
  if (!force && Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string; title: string; slug: string }>(
    `select l.user_id, l.title, l.slug
     from listings l
     where l.status = 'ACTIVE'
       and l.expires_at is not null
       and l.expires_at > now()
       and l.expires_at < now() + interval '3 days'
       and not exists (
         select 1 from notifications n
         where n.user_id = l.user_id and n.type = 'expiry' and n.link = '/ilan/' || l.slug
           and n.created_at > now() - interval '25 days'
       )
     limit 30`,
  );
  for (const r of rows) {
    await notify(
      r.user_id,
      "expiry",
      "İlanınızın süresi dolmak üzere",
      `${r.title} — İlanlarım’dan 30 gün uzatabilirsiniz.`,
      `/ilan/${r.slug}`,
    );
  }
}
