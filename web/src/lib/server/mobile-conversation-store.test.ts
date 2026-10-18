import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createOrGetConversation, insertConversationMessage, loadConversationThread } from "./mobile-conversation-store.ts";

test("listing message, conversation, participants, block state, messages, and read state use migrated schema", async () => {
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

    await assert.rejects(
      sql.query("select id from user_blocks where blocker_id=$1 and blocked_id=$2", ["buyer", "seller"]),
      (error: unknown) => error instanceof Error && /column .*id.* does not exist/i.test(error.message),
      "the previous block query reproduces the reported missing-column error against the migration schema",
    );

    await db.query("insert into categories (id,name,slug) values ('cat','Kategori','kategori')");
    await db.query("insert into profiles (user_id,display_name) values ('buyer','Alıcı'),('seller','Satıcı')");
    await db.query(
      "insert into listings (id,slug,user_id,category_id,title,description,price) values ('listing','ilan','seller','cat','Test ilanı','Açıklama',100)",
    );

    const conversationId = await createOrGetConversation(sql, "listing", "buyer", "seller", "conversation-1");
    await insertConversationMessage(sql, "message-1", conversationId, "buyer", "İlan hâlâ güncel mi?");
    const firstLoad = await loadConversationThread(sql, conversationId, "buyer");
    assert.ok(firstLoad);
    assert.equal(firstLoad.otherUserId, "seller");
    assert.equal(firstLoad.conversation.other_name, "Satıcı");
    assert.equal(firstLoad.blockedByMe || firstLoad.blockedByOther, false);
    assert.equal(firstLoad.messages.length, 1);

    const reusedId = await createOrGetConversation(sql, "listing", "buyer", "seller", "conversation-2");
    assert.equal(reusedId, conversationId);
    const conversationCount = await sql.query<{ count: number }>("select count(*)::int as count from conversations");
    assert.equal(conversationCount[0]?.count, 1);

    await insertConversationMessage(sql, "message-2", conversationId, "seller", "Evet, güncel.");
    const secondLoad = await loadConversationThread(sql, conversationId, "buyer");
    assert.ok(secondLoad);
    assert.equal(secondLoad.unread.length, 1);
    assert.ok(secondLoad.messages[1]?.read_at);
    assert.equal(await loadConversationThread(sql, conversationId, "unrelated-user"), null);

    await db.query("insert into user_blocks (blocker_id,blocked_id) values ('seller','buyer')");
    const blockedLoad = await loadConversationThread(sql, conversationId, "buyer");
    assert.equal(blockedLoad?.blockedByOther, true);
  } finally {
    await db.close();
  }
});
