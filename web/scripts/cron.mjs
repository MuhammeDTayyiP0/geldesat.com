#!/usr/bin/env node
/**
 * Run the app's housekeeping once (expiry reminders, retention purges,
 * unread-message e-mails). Schedule it in Coolify → Scheduled Tasks, e.g.
 * every 10 minutes:  node scripts/cron.mjs
 * Needs CRON_SECRET in the app's environment (same value the server reads).
 */
const secret = process.env.CRON_SECRET?.trim();
if (!secret) {
  console.error("[cron] CRON_SECRET is not set");
  process.exit(1);
}
const port = process.env.PORT || process.env.NITRO_PORT || "3000";
const res = await fetch(`http://127.0.0.1:${port}/api/cron/sweep`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(5 * 60_000),
}).catch((err) => {
  console.error("[cron] request failed", err.message);
  process.exit(1);
});
const body = await res.text();
console.log(`[cron] ${res.status} ${body}`);
process.exit(res.ok ? 0 : 1);
