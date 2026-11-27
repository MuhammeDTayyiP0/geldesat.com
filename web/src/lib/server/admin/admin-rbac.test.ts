import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { isActiveAdmin } from "@/lib/server/helpers";
import { audit } from "@/lib/server/admin/common";
import { createMigratedTestDb } from "@/lib/server/test-db";

let sql: Sql;
let close: () => Promise<void>;

before(async () => {
  const ctx = await createMigratedTestDb();
  sql = ctx.sql;
  close = ctx.close;
});

after(async () => {
  await close();
});

test("isActiveAdmin requires ADMIN role with no ban and no pending account deletion", () => {
  assert.equal(isActiveAdmin({ role: "ADMIN", banned_at: null, deletion_requested_at: null }), true);
  assert.equal(isActiveAdmin({ role: "USER", banned_at: null, deletion_requested_at: null }), false);
  assert.equal(isActiveAdmin({ role: "ADMIN", banned_at: "2026-01-01", deletion_requested_at: null }), false);
  assert.equal(isActiveAdmin({ role: "ADMIN", banned_at: null, deletion_requested_at: "2026-01-01" }), false);
  assert.equal(isActiveAdmin(null), false);
});

test("audit writes structured records to admin_audit_log without throwing on long summaries", async () => {
  await sql.query("insert into profiles (user_id, display_name, role) values ('adm-1', 'Yönetici', 'ADMIN')");
  await audit(sql, "adm-1", "listing.approve", "listing", "lst-1", "A".repeat(700), { source: "test" });

  const rows = await sql.query<{ admin_id: string; action: string; summary: string }>(
    "select admin_id, action, summary from admin_audit_log where admin_id='adm-1'",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "listing.approve");
  assert.equal(rows[0].summary.length, 500);
});
