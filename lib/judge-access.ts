type Environment = Record<string, string | undefined>;
export type LiveAccess =
  | { mode: 'disabled' }
  | { mode: 'owner' }
  | { mode: 'judge'; code: string; expiresAt: number; limit: number };

// A fixed key keeps usage intact across deployments and access-code rotation.
export const ALLOWANCE_ID = 'agents-for-humans-2026';
export const REVIEW_TIMEOUT_MS = 240_000;
export const LEASE_MS = REVIEW_TIMEOUT_MS + 60_000;

export interface QuotaStatement {
  bind(...values: (string | number)[]): QuotaStatement;
  all<T>(): Promise<{ success: boolean; results: T[] }>;
  run(): Promise<{ success: boolean }>;
}
export interface QuotaDatabase {
  prepare(sql: string): QuotaStatement;
}

export function liveAccess(env: Environment, now = Date.now()): LiveAccess {
  if (env.NODE_ENV === 'production' && !env.MODEL_PROVIDER)
    return { mode: 'disabled' };
  const mode =
    env.LIVE_ACCESS_MODE ??
    (env.NODE_ENV === 'production' ? 'disabled' : 'owner');
  // Owner mode requires the hosting platform's private access perimeter.
  if (mode === 'owner') return { mode: 'owner' };
  if (mode !== 'judge') return { mode: 'disabled' };
  const code = env.JUDGE_ACCESS_CODE ?? '';
  const expiry = env.JUDGE_ACCESS_EXPIRES_AT ?? '';
  const expiresAt = Date.parse(expiry);
  const rawLimit = env.JUDGE_REVIEW_LIMIT ?? '';
  const limit = Number(rawLimit);
  if (
    code.length < 24 ||
    code.length > 256 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiry) ||
    !Number.isFinite(expiresAt) ||
    new Date(expiresAt).toISOString() !== expiry.replace('Z', '.000Z') ||
    expiresAt <= now ||
    !/^[1-9]\d*$/.test(rawLimit) ||
    !Number.isSafeInteger(limit) ||
    limit > 1000
  )
    return { mode: 'disabled' };
  return { mode: 'judge', code, expiresAt, limit };
}

export async function correctCode(supplied: string, expected: string) {
  if (supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const hashes = await Promise.all(
    [supplied, expected].map(
      async (value) =>
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', encoder.encode(value)),
        ),
    ),
  );
  let difference = 0;
  for (let i = 0; i < hashes[0].length; i++)
    difference |= hashes[0][i] ^ hashes[1][i];
  return difference === 0;
}

export async function quotaDatabase(): Promise<QuotaDatabase> {
  const { env } = await import('cloudflare:workers');
  const db = (env as unknown as { DB?: QuotaDatabase }).DB;
  if (!db?.prepare) throw new Error('Review allowance unavailable.');
  return db;
}

export async function reserveReview(
  db: QuotaDatabase,
  limit: number,
  now: number,
  token: string,
): Promise<boolean> {
  // Admission and increment are one atomic SQLite write, including first use.
  const result = await db
    .prepare(`
    INSERT INTO judge_allowance (id, used, lease_until, lease_token)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      used = judge_allowance.used + 1,
      lease_until = excluded.lease_until,
      lease_token = excluded.lease_token
    WHERE judge_allowance.used < ? AND judge_allowance.lease_until <= ?
    RETURNING used
  `)
    .bind(ALLOWANCE_ID, now + LEASE_MS, token, limit, now)
    .all<{ used: number }>();
  if (!result.success || !Array.isArray(result.results))
    throw new Error('Review allowance unavailable.');
  return (
    result.results.length === 1 &&
    Number.isInteger(result.results[0].used) &&
    result.results[0].used > 0 &&
    result.results[0].used <= limit
  );
}

export async function releaseReview(db: QuotaDatabase, token: string) {
  const result = await db
    .prepare(`
    UPDATE judge_allowance SET lease_until = 0, lease_token = ''
    WHERE id = ? AND lease_token = ?
  `)
    .bind(ALLOWANCE_ID, token)
    .run();
  if (!result.success) throw new Error('Review allowance unavailable.');
}
