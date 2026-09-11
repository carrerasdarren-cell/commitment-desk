import type { Report } from './domain.ts';
import { validateReviewInput } from './review-input.ts';
import {
  correctCode,
  liveAccess,
  quotaDatabase,
  reserveReview,
  releaseReview,
  REVIEW_TIMEOUT_MS,
  type QuotaDatabase,
} from './judge-access.ts';

type Dependencies = {
  analyze: (
    input: string,
    asOf: string,
    signal: AbortSignal,
  ) => Promise<Report>;
  environment?: () => Record<string, string | undefined>;
  database?: () => Promise<QuotaDatabase>;
  now?: () => number;
};
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

export function createReviewHandler(dependencies: Dependencies) {
  const environment = dependencies.environment ?? (() => process.env);
  const database = dependencies.database ?? quotaDatabase;
  const now = dependencies.now ?? Date.now;
  let ownerActive = false;
  return {
    GET() {
      const access = liveAccess(environment(), now());
      return json({
        liveAvailable: access.mode !== 'disabled',
        accessRequired: access.mode === 'judge',
      });
    },
    async POST(request: Request) {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin)
        return json(
          { error: 'Use the review interface to run analysis.' },
          403,
        );
      const access = liveAccess(environment(), now());
      if (access.mode === 'disabled')
        return json(
          {
            error:
              'Live reviews are unavailable. The example and export remain available.',
          },
          503,
        );
      if (
        access.mode === 'judge' &&
        !(await correctCode(
          request.headers.get('X-Review-Code') ?? '',
          access.code,
        ))
      )
        return json(
          {
            error: 'Enter the judge access code from the testing instructions.',
          },
          401,
        );
      const body = await request.text();
      if (body.length > 20000)
        return json(
          { error: 'Keep each review under 18,000 characters.' },
          413,
        );
      let data: { input?: unknown; asOf?: unknown };
      try {
        data = JSON.parse(body);
      } catch {
        return json({ error: 'Invalid review request.' }, 400);
      }
      if (
        !data ||
        typeof data.input !== 'string' ||
        typeof data.asOf !== 'string'
      )
        return json({ error: 'Provide updates and a review date.' }, 400);
      try {
        validateReviewInput(data.input, data.asOf);
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : 'Invalid updates.',
          },
          400,
        );
      }
      if (request.signal.aborted)
        return json({ error: 'Review was cancelled before it started.' }, 400);
      let db: QuotaDatabase | undefined;
      let token: string | undefined;
      let admittedAt = now();
      if (access.mode === 'judge') {
        try {
          db = await database();
          if (now() >= access.expiresAt)
            return json(
              {
                error:
                  'Judge access has expired. The example remains available.',
              },
              403,
            );
          token = crypto.randomUUID();
          admittedAt = now();
          if (!(await reserveReview(db, access.limit, admittedAt, token)))
            return json(
              {
                error:
                  'A review is running or the shared review allowance has been used. Try again after the current review finishes.',
              },
              429,
            );
        } catch {
          return json(
            {
              error:
                'The review allowance is temporarily unavailable. Please try again later.',
            },
            503,
          );
        }
      } else {
        // No await between checking and setting this local owner-mode guard.
        if (ownerActive)
          return json(
            {
              error: 'A review is already running. Try again when it finishes.',
            },
            429,
          );
        ownerActive = true;
      }
      try {
        const remainingMs = admittedAt + REVIEW_TIMEOUT_MS - now();
        if (
          remainingMs <= 0 ||
          request.signal.aborted ||
          (access.mode === 'judge' && now() >= access.expiresAt)
        )
          return json(
            {
              error:
                'Review access expired or was cancelled before the model started. Please try again if access is still active.',
            },
            403,
          );
        const signal = AbortSignal.any([
          request.signal,
          AbortSignal.timeout(remainingMs),
        ]);
        return json(await dependencies.analyze(data.input, data.asOf, signal));
      } catch (error) {
        console.error(
          'Review failed:',
          error instanceof Error ? error.name : 'Unknown error',
        );
        const message = error instanceof Error ? error.message : '';
        return json(
          {
            error: /^(The agent|Review timed)/.test(message)
              ? message
              : 'The model connection could not complete the review. Try a smaller batch or contact the project owner.',
          },
          422,
        );
      } finally {
        // Admitted failures still consume an attempt: a model call can cost money.
        if (db && token) {
          try {
            await releaseReview(db, token);
          } catch {
            console.error('Review allowance release failed.');
          }
        } else ownerActive = false;
      }
    },
  };
}
