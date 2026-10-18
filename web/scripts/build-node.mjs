#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vite = join(root, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [vite, "build"], {
  cwd: root,
  env: { ...process.env, NITRO_PRESET: "node-server" },
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
