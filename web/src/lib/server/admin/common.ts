import { createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { newId } from "@/lib/utils";
import { requireAdmin } from "../helpers";

/** Signed-in ADMIN only; every admin server function runs behind this. */
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    await requireAdmin(context.userId);
    return next({ context: { adminId: context.userId } });
  });

type QuerySql = Pick<Sql, "query">;

export type AuditTarget = "listing" | "user" | "category" | "attribute" | "report" | "review" | "store" | "order" | "page" | "settings" | "broadcast" | "system";

/** Record an admin write. Never throws: a failed log line must not undo the action. */
export async function audit(
  sql: QuerySql,
  adminId: string,
  action: string,
  targetType: AuditTarget,
  targetId: string | null,
  summary: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await sql.query(
      `insert into admin_audit_log (id, admin_id, action, target_type, target_id, summary, meta)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [newId("aud"), adminId, action, targetType, targetId, summary.slice(0, 500), meta ? JSON.stringify(meta) : null],
    );
  } catch (err) {
    console.error("[admin] audit write failed", err);
  }
}

export const PageInput = {
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(5).max(200).default(25),
};

export function paging(page: number, pageSize: number) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number; pages: number };

export function paged<T>(rows: T[], total: number, page: number, pageSize: number): Paged<T> {
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** `%term%` for ILIKE with the user's wildcards escaped. */
export function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Collects WHERE fragments and their positional parameters. */
export class Where {
  readonly parts: string[] = [];
  readonly params: unknown[] = [];

  /** Adds a parameter and returns its placeholder (`$n`). */
  param(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  add(fragment: string) {
    this.parts.push(fragment);
  }

  get sql(): string {
    return this.parts.length ? `where ${this.parts.join(" and ")}` : "";
  }
}

/** Time zone daily charts and "today" counters are bucketed in. */
export const IST = "Europe/Istanbul";

/** Timestamps come back as Date from the driver; ship ISO strings to the client. */
export function ts(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? "");
}

export function tsOrNull(value: unknown): string | null {
  return value == null ? null : ts(value);
}

export function strOrNull(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}
