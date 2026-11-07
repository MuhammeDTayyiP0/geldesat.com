import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

test("every category in the menu exists", async () => {
  const dir = join(process.cwd(), "migrations");
  const seeds = (await Promise.all((await readdir(dir)).filter((f) => f.endsWith(".sql")).map((f) => readFile(join(dir, f), "utf8")))).join("\n");
  const nav = await readFile(join(process.cwd(), "src/components/navbar/nav-data.ts"), "utf8");
  const slugs = [...nav.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]).filter((s) => s !== "string");
  assert.ok(slugs.length > 50);
  const missing = [...new Set(slugs)].filter((slug) => !seeds.includes(`'${slug}'`));
  assert.deepEqual(missing, []);
});
