import { getSql } from "@/lib/db";
import { previewText } from "@/lib/chat-shared";
import { BASE_URL } from "@/lib/seo";
import { isOnline } from "./chat-bus";
import { mailConfigured, sendMessageDigestMail } from "./mail";
import { chatVisibleTo, DELETED_USER_NAME } from "./retention";

/** A message must stay unread this long before it is mailed (the user may just be away briefly). */
const WAIT_MINUTES = 15;
/** At most one digest per user in this window. */
const MIN_HOURS_BETWEEN = 6;
const MAX_ITEMS = 5;

/** Unread messages in my visible, non-archived chats from others, not yet covered by a digest. */
const PENDING = (user: string) => `
  m.read_at is null and m.deleted_at is null and m.sender_id <> ${user}
  and (cv.buyer_id = ${user} or cv.seller_id = ${user})
  and ${chatVisibleTo(user)}
  and (case when cv.buyer_id = ${user} then cv.buyer_archived_at else cv.seller_archived_at end) is null
  and m.created_at > coalesce(p.last_message_email_at, '-infinity'::timestamptz)`;

let lastRun = 0;

/**
 * Mail a summary of unread chat messages to users who have been away. Needs
 * SMTP; only verified addresses, never during the deletion grace period, never
 * while the user is online, and at most every few hours per user. Runs at most
 * every 10 minutes, piggybacking on regular traffic like the other sweeps.
 */
export async function sweepMessageDigests(force = false): Promise<void> {
  if (!mailConfigured || (!force && Date.now() - lastRun < 10 * 60_000)) return;
  lastRun = Date.now();
  const sql = await getSql();
  const due = await sql.query<{ user_id: string; email: string; name: string }>(
    `select p.user_id, u.email, coalesce(nullif(p.display_name, ''), u.name) as name
     from profiles p join "user" u on u.id = p.user_id
     where p.message_email and u."emailVerified" and p.deletion_requested_at is null
       and (p.last_message_email_at is null or p.last_message_email_at < now() - make_interval(hours => $1))
       and exists (
         select 1 from messages m join conversations cv on cv.id = m.conversation_id
         where ${PENDING("p.user_id")} and m.created_at < now() - make_interval(mins => $2)
       )
     limit 50`,
    [MIN_HOURS_BETWEEN, WAIT_MINUTES],
  );

  for (const user of due) {
    if (isOnline(user.user_id)) continue;
    const chats = await sql.query<{ other_name: string | null; title: string | null; n: number; content: string; kind: string }>(
      `select op.display_name as other_name, l.title, count(*)::int as n,
              (array_agg(m.content order by m.created_at desc))[1] as content,
              (array_agg(m.kind order by m.created_at desc))[1] as kind
       from messages m
       join conversations cv on cv.id = m.conversation_id
       join profiles p on p.user_id = $1
       left join listings l on l.id = cv.listing_id
       left join profiles op on op.user_id = m.sender_id
       where ${PENDING("$1")}
       group by cv.id, op.display_name, l.title
       order by max(m.created_at) desc`,
      [user.user_id],
    );
    if (!chats.length) continue;
    // Stamp first: a failing mail server must not make us resend on every sweep.
    await sql.query("update profiles set last_message_email_at = now() where user_id = $1", [user.user_id]);
    try {
      await sendMessageDigestMail({
        to: user.email,
        name: user.name || "Merhaba",
        total: chats.reduce((sum, c) => sum + c.n, 0),
        items: chats.slice(0, MAX_ITEMS).map((c) => ({
          from: c.other_name ?? DELETED_USER_NAME,
          listing: c.title ?? "İlan kaldırıldı",
          preview: previewText(c.kind, c.content, false).slice(0, 140),
          count: c.n,
        })),
        inboxUrl: `${BASE_URL}/mesajlar`,
        settingsUrl: `${BASE_URL}/ayarlar/bildirimler`,
      });
    } catch (err) {
      console.error("[digest] mail failed", user.user_id, err);
    }
  }
}
