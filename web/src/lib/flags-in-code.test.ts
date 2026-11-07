import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { KNOWN_FLAGS } from "./flags.ts";

/** TypeScript sources under `dir`, skipping tools' caches and generated folders. */
function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Names read with useFlag("…"), or from a resolveFlags() result in server code. */
function flagsReadIn(files: string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of files) {
    // Comments hold usage examples ("useFlag('teklif_ver')"), not real reads.
    const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of text.matchAll(/useFlag\(\s*["']([a-z0-9_]+)["']\s*\)/g)) found.set(m[1], file);
    if (text.includes("resolveFlags(") && !file.endsWith("server/config.ts")) {
      for (const m of text.matchAll(/\bflags\.([a-z0-9_]+)\b|\bflags\[["']([a-z0-9_]+)["']\]/g)) found.set(m[1] ?? m[2], file);
    }
  }
  return found;
}

const root = process.cwd();
const files = [...sources(join(root, "src")), ...sources(join(root, "..", "mobile-app", "src"))];

test("every flag the code reads is listed in CODE_FLAGS, so the admin panel can offer it", () => {
  const read = flagsReadIn(files);
  const unlisted = [...read].filter(([name]) => !KNOWN_FLAGS.includes(name)).map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(unlisted, [], "add these to CODE_FLAGS in src/lib/flags.ts with a description");
  const unused = KNOWN_FLAGS.filter((name) => !read.has(name));
  assert.deepEqual(unused, [], "no code reads these any more: remove them from CODE_FLAGS");
});
