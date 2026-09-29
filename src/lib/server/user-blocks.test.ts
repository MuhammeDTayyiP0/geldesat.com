import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { hasUserBlock } from "./user-blocks.ts";

test("mobile block check matches the migrated user_blocks schema", async () => {
  const db = new PGlite();
  try {
    const migrations = (await readdir(join(process.cwd(), "migrations")))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await db.exec(await readFile(join(process.cwd(), "migrations", migration), "utf8"));
    }

    const sql = {
      query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
        const result = await db.query<T>(text, params);
        return result.rows;
      },
    };

    assert.equal(await hasUserBlock(sql, "buyer", "seller"), false);
    await db.query("insert into user_blocks (blocker_id, blocked_id) values ($1, $2)", ["seller", "buyer"]);
    assert.equal(await hasUserBlock(sql, "buyer", "seller"), true);
  } finally {
    await db.close();
  }
});
