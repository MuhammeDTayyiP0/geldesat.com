// Lets `node --test` run TypeScript that imports through the app's "@/" alias.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.env.JITI_ALIAS = JSON.stringify({ "@": join(root, "src") });
await import("jiti/register");
