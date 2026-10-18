/** Check whether either participant has blocked the other. */
export async function hasUserBlock(
  sql: { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> },
  a: string,
  b: string,
): Promise<boolean> {
  const rows = await sql.query<{ blocked: number }>(
    `select 1 as blocked from user_blocks
     where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
     limit 1`,
    [a, b],
  );
  return Boolean(rows[0]);
}
