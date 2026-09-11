import { analyzeUpdates } from '@/lib/agent';
let active = false;
export function GET() {
  return Response.json(
    {
      liveAvailable:
        process.env.NODE_ENV !== 'production' || !!process.env.MODEL_PROVIDER,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: 'Use the review interface to run analysis.' },
      { status: 403 },
    );
  if (active)
    return Response.json(
      { error: 'A review is already running. Try again when it finishes.' },
      { status: 429 },
    );
  const body = await request.text();
  if (body.length > 20000)
    return Response.json(
      { error: 'Keep each review under 18,000 characters.' },
      { status: 413 },
    );
  let data: { input?: unknown; asOf?: unknown };
  try {
    data = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid review request.' }, { status: 400 });
  }
  if (!data || typeof data.input !== 'string' || typeof data.asOf !== 'string')
    return Response.json(
      { error: 'Provide updates and a review date.' },
      { status: 400 },
    );
  active = true;
  try {
    return Response.json(
      await analyzeUpdates(data.input, data.asOf, request.signal),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      'Review failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    const message = error instanceof Error ? error.message : '';
    const allowed =
      /^(Choose|Each |Keep |Source|Update|The agent|Review timed|Live analysis|Configure|Unsupported)/;
    return Response.json(
      {
        error: allowed.test(message)
          ? message
          : 'The model connection could not complete the review. Check the local model service or configured AWS credentials.',
      },
      { status: 422 },
    );
  } finally {
    active = false;
  }
}
