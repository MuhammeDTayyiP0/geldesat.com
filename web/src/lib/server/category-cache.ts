import { getSql } from "@/lib/db";
import type { CategoryRow } from "./helpers";

/**
 * In-process copy of the category tree (thousands of rows that only admins
 * change) and of the live-listing count per category. Pages read these on every
 * request, so they come from memory instead of re-querying the whole table.
 * Admin category edits call `clearCategoryCache()`; the TTLs only bound how
 * stale another process (or a direct database edit) can leave us.
 */

export type CategoryNode = CategoryRow & { has_children: boolean };

export type CategoryTree = {
  /** Every category, ordered by sort_order then name. */
  rows: CategoryNode[];
  byId: Map<string, CategoryNode>;
  /** Keyed by lower-cased slug. */
  bySlug: Map<string, CategoryNode>;
  /** Children per parent id (`null` = roots), already sorted for display. */
  children: Map<string | null, CategoryNode[]>;
};

const TREE_TTL_MS = 5 * 60_000;
const COUNTS_TTL_MS = 60_000;

let treeCache: { expiresAt: number; promise: Promise<CategoryTree> } | null = null;
let countsCache: { expiresAt: number; promise: Promise<Record<string, number>> } | null = null;

/** Drop both caches so the next read sees an admin's change at once. */
export function clearCategoryCache(): void {
  treeCache = null;
  countsCache = null;
}

function byDisplayOrder(a: CategoryRow, b: CategoryRow): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr");
}

async function loadTree(): Promise<CategoryTree> {
  const sql = await getSql();
  const raw = await sql.query<CategoryRow>("select id, name, slug, parent_id, icon, sort_order from categories");
  const parentIds = new Set(raw.map((r) => r.parent_id).filter((id): id is string => Boolean(id)));
  const rows = raw.map((r) => ({ ...r, has_children: parentIds.has(r.id) })).sort(byDisplayOrder);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bySlug = new Map(rows.map((r) => [r.slug.toLowerCase(), r]));
  const children = new Map<string | null, CategoryNode[]>();
  for (const r of rows) {
    const list = children.get(r.parent_id) ?? [];
    list.push(r);
    children.set(r.parent_id, list);
  }
  return { rows, byId, bySlug, children };
}

export function getCategoryTree(): Promise<CategoryTree> {
  if (treeCache && Date.now() < treeCache.expiresAt) return treeCache.promise;
  const entry = {
    expiresAt: Date.now() + TREE_TTL_MS,
    promise: loadTree().catch((err) => {
      if (treeCache === entry) treeCache = null; // never memoize a failure
      throw err;
    }),
  };
  treeCache = entry;
  return entry.promise;
}

async function loadCounts(): Promise<Record<string, number>> {
  const sql = await getSql();
  const [tree, direct] = await Promise.all([
    getCategoryTree(),
    sql.query<{ category_id: string; n: number }>(
      `select category_id, count(*)::int as n from listings
       where status = 'ACTIVE' and (expires_at is null or expires_at > now())
       group by category_id`,
    ),
  ]);
  const own = new Map(direct.map((c) => [c.category_id, c.n]));
  const totals: Record<string, number> = {};
  // Memoized post-order: a category's total is its own listings plus its subtree's.
  const total = (id: string): number => {
    const known = totals[id];
    if (known !== undefined) return known;
    let n = own.get(id) ?? 0;
    for (const child of tree.children.get(id) ?? []) n += total(child.id);
    totals[id] = n;
    return n;
  };
  for (const r of tree.rows) total(r.id);
  return totals;
}

/** Live listings per category, including every subcategory below it. */
export function getCategoryCounts(): Promise<Record<string, number>> {
  if (countsCache && Date.now() < countsCache.expiresAt) return countsCache.promise;
  const entry = {
    expiresAt: Date.now() + COUNTS_TTL_MS,
    promise: loadCounts().catch((err) => {
      if (countsCache === entry) countsCache = null;
      throw err;
    }),
  };
  countsCache = entry;
  return entry.promise;
}

/** Category by id or (case-insensitive) slug. */
export function findCategory(tree: CategoryTree, slugOrId: string): CategoryNode | undefined {
  return tree.byId.get(slugOrId) ?? tree.bySlug.get(slugOrId.toLowerCase());
}

/** Root → category chain. */
export function categoryPath(tree: CategoryTree, id: string): CategoryNode[] {
  const path: CategoryNode[] = [];
  let cur = tree.byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? tree.byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** The category and every descendant id. */
export function subtreeOf(tree: CategoryTree, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const child of tree.children.get(cur) ?? []) stack.push(child.id);
  }
  return out;
}

/** Only the given categories' counts, so pages don't ship the full map. */
export function pickCounts(counts: Record<string, number>, items: readonly { id: string }[]): Record<string, number> {
  return Object.fromEntries(items.map((c) => [c.id, counts[c.id] ?? 0]));
}
