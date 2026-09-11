import { analyzeUpdates } from '../lib/agent.ts';
import { sampleInput } from '../lib/sample.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { Report } from '../lib/domain.ts';
let report: Report;
if (process.env.CHECK_WORKER_URL) {
  const response = await fetch(process.env.CHECK_WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CHECK_WORKER_TOKEN
        ? {
            'OAI-Sites-Authorization': `Bearer ${process.env.CHECK_WORKER_TOKEN}`,
          }
        : {}),
    },
    body: JSON.stringify({ input: sampleInput, asOf: '2026-09-08' }),
    signal: AbortSignal.timeout(250000),
  });
  const body = await response.json();
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'Unknown error';
    throw new Error(`Worker review failed (${response.status}): ${message}`);
  }
  report = body as Report;
} else {
  report = await analyzeUpdates(sampleInput, '2026-09-08');
}
const statuses = report.commitments.map((c) => c.attention).sort();
const expected = ['overdue', 'blocked', 'clarify', 'upcoming', 'done'].sort();
const pass =
  report.mode === 'live' &&
  JSON.stringify(statuses) === JSON.stringify(expected) &&
  report.rejected.length === 0 &&
  report.commitments.reduce((n, c) => n + c.evidence.length, 0) === 9 &&
  report.commitments.some(
    (c) =>
      c.attention === 'done' &&
      c.evidence.some((e) => e.sourceId === 'S-02' && e.state === 'done'),
  ) &&
  report.trace.filter(
    (t) =>
      t.tool === 'read_updates' &&
      t.phase === 'finished' &&
      t.status === 'success',
  ).length === report.sources.length &&
  report.trace.filter(
    (t) =>
      t.tool === 'strands_structured_output' &&
      t.phase === 'finished' &&
      t.status === 'success',
  ).length === report.sources.length;
mkdirSync('docs/evidence', { recursive: true });
writeFileSync(
  process.env.CHECK_REPORT_FILE ??
    (process.env.CHECK_WORKER_URL
      ? 'docs/evidence/worker-agent-run.json'
      : 'docs/evidence/local-agent-run.json'),
  JSON.stringify({ testPassed: pass, ...report }, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      testPassed: pass,
      provider: report.provider,
      statuses,
      rejected: report.rejected,
      trace: report.trace,
    },
    null,
    2,
  ),
);
if (!pass) process.exitCode = 1;
