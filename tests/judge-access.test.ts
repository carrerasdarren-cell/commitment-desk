import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createReviewHandler } from '../lib/review-handler.ts';
import {
  ALLOWANCE_ID,
  LEASE_MS,
  liveAccess,
  reserveReview,
  releaseReview,
  type QuotaDatabase,
  type QuotaStatement,
} from '../lib/judge-access.ts';
import { exampleReport, sampleInput } from '../lib/sample.ts';

const code = 'local-test-only-access-code-012345';
const start = Date.parse('2026-09-11T12:00:00Z');
const env = {
  NODE_ENV: 'production',
  MODEL_PROVIDER: 'bedrock',
  LIVE_ACCESS_MODE: 'judge',
  JUDGE_ACCESS_CODE: code,
  JUDGE_ACCESS_EXPIRES_AT: '2026-10-09T00:00:00Z',
  JUDGE_REVIEW_LIMIT: '2',
};
function store() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    readFileSync(
      new URL('../drizzle/0000_judge_allowance.sql', import.meta.url),
      'utf8',
    ),
  );
  const db: QuotaDatabase = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values: (string | number)[] = [];
      const bound: QuotaStatement = {
        bind(...next) {
          values = next;
          return bound;
        },
        async all<T>() {
          return { success: true, results: statement.all(...values) as T[] };
        },
        async run() {
          statement.run(...values);
          return { success: true };
        },
      };
      return bound;
    },
  };
  const state = () =>
    sqlite
      .prepare('SELECT * FROM judge_allowance WHERE id = ?')
      .get(ALLOWANCE_ID);
  return { db, state, sqlite };
}
function request(
  body: unknown = { input: sampleInput, asOf: '2026-09-08' },
  suppliedCode = code,
  signal?: AbortSignal,
) {
  return new Request('https://example.test/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Review-Code': suppliedCode,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
}
function setup(
  overrides: Partial<Parameters<typeof createReviewHandler>[0]> = {},
) {
  const storage = store();
  let calls = 0;
  const handler = createReviewHandler({
    environment: () => env,
    database: async () => storage.db,
    now: () => start,
    analyze: async () => {
      calls++;
      return exampleReport();
    },
    ...overrides,
  });
  return { ...storage, handler, calls: () => calls };
}

await test('malformed requests and invalid source batches do not reserve allowance', async () => {
  const f = setup();
  const invalid = [
    '{',
    null,
    { input: 4, asOf: '2026-09-08' },
    { input: sampleInput, asOf: '2026-02-30' },
    { input: 'bad source', asOf: '2026-09-08' },
    { input: '[S-01] 2026-09-08 | Empty', asOf: '2026-09-08' },
    {
      input: '[S-01] 2026-09-08 | A\nText.\n[S-01] 2026-09-08 | B\nText.',
      asOf: '2026-09-08',
    },
    { input: 'x'.repeat(18001), asOf: '2026-09-08' },
    {
      input: Array.from(
        { length: 9 },
        (_, i) => `[S-${i}] 2026-09-08 | Test\nText.`,
      ).join('\n'),
      asOf: '2026-09-08',
    },
    'x'.repeat(20001),
  ];
  for (const value of invalid)
    assert.ok(
      [400, 413].includes((await f.handler.POST(request(value))).status),
    );
  assert.equal(f.state(), undefined);
  assert.equal(f.calls(), 0);
  f.sqlite.close();
});

await test('missing and wrong codes, expired access, and cross-origin requests never start the model', async () => {
  const f = setup();
  for (const value of ['', 'incorrect'])
    assert.equal((await f.handler.POST(request(undefined, value))).status, 401);
  const foreign = request();
  foreign.headers.set('Origin', 'https://elsewhere.test');
  assert.equal((await f.handler.POST(foreign)).status, 403);
  assert.equal(f.state(), undefined);
  assert.equal(f.calls(), 0);
  for (const now of [
    Date.parse(env.JUDGE_ACCESS_EXPIRES_AT),
    Date.parse(env.JUDGE_ACCESS_EXPIRES_AT) + 1,
  ])
    assert.equal(liveAccess(env, now).mode, 'disabled');
  assert.equal(
    liveAccess(env, Date.parse(env.JUDGE_ACCESS_EXPIRES_AT) - 1).mode,
    'judge',
  );
  f.sqlite.close();
});

await test('production mode and incomplete judge configuration fail closed', () => {
  for (const changes of [
    { LIVE_ACCESS_MODE: undefined },
    { LIVE_ACCESS_MODE: 'unknown' },
    { JUDGE_ACCESS_CODE: '' },
    { JUDGE_ACCESS_CODE: 'short' },
    { JUDGE_ACCESS_EXPIRES_AT: '2026-02-30T00:00:00Z' },
    { JUDGE_ACCESS_EXPIRES_AT: '2026-10-09' },
    { JUDGE_REVIEW_LIMIT: '0' },
    { JUDGE_REVIEW_LIMIT: '-1' },
    { JUDGE_REVIEW_LIMIT: '1.5' },
    { JUDGE_REVIEW_LIMIT: '1001' },
    { MODEL_PROVIDER: undefined },
  ])
    assert.equal(liveAccess({ ...env, ...changes }, start).mode, 'disabled');
  assert.equal(liveAccess({ NODE_ENV: 'development' }, start).mode, 'owner');
});

await test('atomic reservations serialize concurrent requests across handler instances', async () => {
  const storage = store();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  const make = () =>
    createReviewHandler({
      environment: () => env,
      database: async () => storage.db,
      now: () => start,
      analyze: async () => {
        calls++;
        await pending;
        return exampleReport();
      },
    });
  const first = make().POST(request());
  while (!calls) await new Promise((resolve) => setImmediate(resolve));
  const second = await make().POST(request());
  assert.equal(second.status, 429);
  assert.equal(calls, 1);
  assert.equal(storage.state()?.used, 1);
  finish();
  assert.equal((await first).status, 200);
  assert.equal(storage.state()?.lease_until, 0);
  storage.sqlite.close();
});

await test('durable limit survives handler recreation and code rotation', async () => {
  const f = setup();
  assert.equal((await f.handler.POST(request())).status, 200);
  const rotated = code + '-rotated';
  const fresh = createReviewHandler({
    environment: () => ({ ...env, JUDGE_ACCESS_CODE: rotated }),
    database: async () => f.db,
    now: () => start,
    analyze: async () => exampleReport(),
  });
  assert.equal((await fresh.POST(request(undefined, rotated))).status, 200);
  assert.equal((await fresh.POST(request(undefined, rotated))).status, 429);
  assert.equal(f.state()?.used, 2);
  f.sqlite.close();
});

await test('failed and cancelled admitted starts consume allowance and release the lease', async () => {
  for (const fail of [
    new Error('Model failed'),
    new Error('Review timed out or was cancelled.'),
  ]) {
    const f = setup({
      analyze: async () => {
        throw fail;
      },
    });
    assert.equal((await f.handler.POST(request())).status, 422);
    assert.equal(f.state()?.used, 1);
    assert.equal(f.state()?.lease_until, 0);
    f.sqlite.close();
  }
  const f = setup();
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (await f.handler.POST(request(undefined, code, controller.signal))).status,
    400,
  );
  assert.equal(f.state(), undefined);
  assert.equal(f.calls(), 0);
  f.sqlite.close();
});

await test('an old completion cannot release a newer lease after expiry', async () => {
  const f = store();
  assert.equal(await reserveReview(f.db, 3, start, 'A'), true);
  assert.equal(await reserveReview(f.db, 3, start + LEASE_MS - 1, 'B'), false);
  assert.equal(await reserveReview(f.db, 3, start + LEASE_MS, 'B'), true);
  await releaseReview(f.db, 'A');
  assert.equal(f.state()?.lease_token, 'B');
  assert.equal(f.state()?.used, 2);
  await releaseReview(f.db, 'B');
  assert.equal(f.state()?.lease_until, 0);
  f.sqlite.close();
});

await test('unavailable database, missing schema and unsuccessful writes deny model invocation', async () => {
  const missing = store();
  missing.sqlite.exec('DROP TABLE judge_allowance');
  const failed: QuotaStatement = {
    bind() {
      return failed;
    },
    async all<T>() {
      return { success: false, results: [] as T[] };
    },
    async run() {
      return { success: false };
    },
  };
  const empty: QuotaStatement = {
    ...failed,
    bind() {
      return empty;
    },
    async all<T>() {
      return { success: true, results: [] as T[] };
    },
  };
  for (const database of [
    async () => {
      throw new Error('No binding');
    },
    async () => missing.db,
    async () => ({ prepare: () => failed }),
    async () => ({ prepare: () => empty }),
  ]) {
    let calls = 0;
    const handler = createReviewHandler({
      environment: () => env,
      database,
      now: () => start,
      analyze: async () => {
        calls++;
        return exampleReport();
      },
    });
    assert.ok([429, 503].includes((await handler.POST(request())).status));
    assert.equal(calls, 0);
  }
  missing.sqlite.close();
});

await test('successful review preserves the report and GET never exposes the secret', async () => {
  const f = setup();
  const availability = f.handler.GET();
  assert.deepEqual(await availability.json(), {
    liveAvailable: true,
    accessRequired: true,
  });
  const response = await f.handler.POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), exampleReport());
  assert.equal(f.state()?.used, 1);
  assert.equal(f.state()?.lease_token, '');
  assert.equal(f.calls(), 1);
  assert.equal(
    (await (await f.handler.POST(request(undefined, 'wrong'))).text()).includes(
      code,
    ),
    false,
  );
  f.sqlite.close();
});

await test('expiry during request preparation denies the reservation', async () => {
  let clock = start;
  const f = setup({
    now: () => clock,
    database: async () => {
      clock = Date.parse(env.JUDGE_ACCESS_EXPIRES_AT);
      return f.db;
    },
  });
  assert.equal((await f.handler.POST(request())).status, 403);
  assert.equal(f.state(), undefined);
  assert.equal(f.calls(), 0);
  f.sqlite.close();
});

await test('expiry during a delayed reservation releases the lease without calling the model', async () => {
  const f = store();
  let clock = start;
  let calls = 0;
  const delayed: QuotaDatabase = {
    prepare(sql) {
      const statement = f.db.prepare(sql);
      const wrapper: QuotaStatement = {
        bind(...values) {
          statement.bind(...values);
          return wrapper;
        },
        async all<T>() {
          const result = await statement.all<T>();
          clock = Date.parse(env.JUDGE_ACCESS_EXPIRES_AT);
          return result;
        },
        run: () => statement.run(),
      };
      return wrapper;
    },
  };
  const handler = createReviewHandler({
    environment: () => env,
    database: async () => delayed,
    now: () => clock,
    analyze: async () => {
      calls++;
      return exampleReport();
    },
  });
  assert.equal((await handler.POST(request())).status, 403);
  assert.equal(calls, 0);
  assert.equal(f.state()?.used, 1);
  assert.equal(f.state()?.lease_until, 0);
  f.sqlite.close();
});

await test('a reservation delayed past the review deadline cannot start a new four-minute run', async () => {
  const f = store();
  let clock = start;
  let calls = 0;
  const delayed: QuotaDatabase = {
    prepare(sql) {
      const statement = f.db.prepare(sql);
      const wrapper: QuotaStatement = {
        bind(...values) {
          statement.bind(...values);
          return wrapper;
        },
        async all<T>() {
          const result = await statement.all<T>();
          clock += LEASE_MS;
          return result;
        },
        run: () => statement.run(),
      };
      return wrapper;
    },
  };
  const handler = createReviewHandler({
    environment: () => env,
    database: async () => delayed,
    now: () => clock,
    analyze: async () => {
      calls++;
      return exampleReport();
    },
  });
  assert.equal((await handler.POST(request())).status, 403);
  assert.equal(calls, 0);
  assert.equal(f.state()?.used, 1);
  assert.equal(f.state()?.lease_until, 0);
  f.sqlite.close();
});
