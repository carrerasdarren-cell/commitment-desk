# Protected judge access

The public demo is active at https://commitment-desk-afh-2026.drc795.chatgpt.site/ with a private judge code and a durable shared allowance of **25 total admitted reviews**, approved by Darren. Access expires **October 9, 2026 at 00:00 UTC / October 8 at 8 p.m. Eastern**. The single live activation check consumed one review, leaving **24 at verification**; later usage can reduce this. The actual code is stored as a server secret and in Devpost's private testing instructions, never in this repository.

A live activation review passed all five expected statuses, nine source quotes and three read/output tool pairs. Anonymous checks verified public page access, 401 without the correct code, and 400 for malformed notes with the correct code. See `evidence/judge-activation.json` and `evidence/judge-agent-run.json`.

## Modes

- `disabled` (production default): synthetic example, draft review and export still work; no live model starts.
- `owner`: use only behind the hosting platform's owner-only access perimeter. This retains the existing private workflow and a per-instance busy guard. It is not suitable for public hosting.
- `judge`: a server secret, expiry and durable allowance must all be valid. A missing database, missing schema or failed reservation denies the live run.

Judge mode requires `LIVE_ACCESS_MODE=judge`, a random `JUDGE_ACCESS_CODE` of 24–256 characters stored as a server secret, `JUDGE_ACCESS_EXPIRES_AT` as an exact UTC timestamp such as `2026-10-09T00:00:00Z`, and `JUDGE_REVIEW_LIMIT` as an integer between 1 and 1000. The maximum is a configuration guard; the approved configured allowance is 25. Expiry stops new model starts; an already started review may finish within its existing four-minute deadline.

The code is supplied privately in Devpost's testing instructions, entered in a password field and sent only in the `X-Review-Code` request header over HTTPS. It is held in React memory, not a URL or browser storage. GET returns availability flags only. Do not put the real code in this repository, public project story, video description or logs.

## Durable allowance

`.openai/hosting.json` declares the logical D1 binding `DB`. `db/schema.ts` defines `judge_allowance`; generated, schema-only SQL and metadata are in `drizzle/`. Sites supplies the production database and applies migrations before deployment. To regenerate schema migrations locally, run `npm run db:generate`; inspect and commit the generated SQL and metadata. Do not edit applied migrations or create tables at request time.

Local Worker previews need the schema applied to the local D1 binding before testing judge mode. After `npm run build`, use:

```sh
npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json
```

Owner-mode local development does not query D1. `npm test` creates isolated in-memory SQLite databases and applies the same migration for admission tests; it does not contact AWS or production D1.

One atomic insert/update reserves a shared attempt and a five-minute lease. It prevents another admission while that lease is active, even from another server instance. The model deadline is four minutes measured from reservation start, leaving a minute of lease margin. A late completion releases only its own lease token. Unexpected termination may keep the service busy until that lease expires.

The fixed allowance key `agents-for-humans-2026` survives deployments and code rotation. Changing the configured limit changes the total ceiling; it does not reset prior usage. Admitted failures and uncertain request outcomes count because model work can incur charges. Invalid input, a wrong code, and admission denial do not start the model. D1 stores only the count and lease metadata, never project updates, output or the code.

This is a cap on admitted reviews, **not a dollar budget**. Each review can make multiple model calls, including SDK retries. Check the AWS account's actual usage and billing separately. Protect the shared code; possession grants access to the remaining shared allowance.

## Deployment and future changes

1. The initial activation was deployed and tested while hosting remained owner-only.
2. Use Darren's approved 25-review ceiling and public audience. Any increase needs a separate decision.
3. Judge mode, secret, expiry and approved limit were deployed as environment revision 3, then verified before opening access. Preserve those settings in later deployments.
4. Public audience access is verified. Keep the code only in server secrets and private testing instructions; do not publish it with entry files.
5. Keep access available through October 8 judging. Preserve the entry after the September 14 deadline; the final Devpost page warns against changes after that deadline through the winner announcement.
