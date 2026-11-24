#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tests = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) tests.push(path);
  }
}

collect(join(root, "src"));
tests.sort();
if (!tests.length) {
  console.error("No src/**/*.test.ts files were found.");
  process.exit(1);
}

console.log(`Running ${tests.length} web test files (Windows-safe discovery):`);
for (const testPath of tests) console.log(`  ${relative(root, testPath)}`);
const result = spawnSync(
  process.execPath,
  ["--import", "./scripts/test-register.mjs", "--test", ...tests],
  {
    cwd: root,
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
