import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgliteSql, type Sql } from "@/lib/db";

let seedDumpPromise: Promise<File | Blob> | null = null;

async function getSeedDump(): Promise<File | Blob> {
  if (!seedDumpPromise) {
    seedDumpPromise = (async () => {
      const dir = join(process.cwd(), "migrations");
      const files = (await readdir(dir))
        .filter((f) => /^\d+.*\.sql$/.test(f))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const seed = new PGlite();
      try {
        await seed.waitReady;
        for (const file of files) {
          await seed.exec(await readFile(join(dir, file), "utf8"));
        }
        return await seed.dumpDataDir("none");
      } finally {
        await seed.close();
      }
    })();
  }
  return seedDumpPromise;
}

/**
 * Returns a fresh, isolated PGLite instance with all migrations pre-applied
 * from an in-process cached tarball snapshot.
 */
export async function createMigratedTestDb(): Promise<{ db: PGlite; sql: Sql; close: () => Promise<void> }> {
  const loadDataDir = await getSeedDump();
  const db = await PGlite.create({ loadDataDir });
  return {
    db,
    sql: pgliteSql(db),
    close: () => db.close(),
  };
}
