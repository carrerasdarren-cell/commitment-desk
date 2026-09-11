import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcile,
  parseSources,
  exportMarkdown,
  type Event,
  type Source,
} from '../lib/domain.ts';
import { sampleEvents, sampleInput, exampleReport } from '../lib/sample.ts';
const source: Source = {
  id: 'S-01',
  date: '2026-09-03',
  title: 'Notes',
  text: 'Maya and Noah discussed the budget, due 2026-09-07. Status disputed.',
};
const event: Event = {
  key: 'budget',
  title: 'Budget',
  owner: 'Maya',
  dueDate: '2026-09-07',
  state: 'open',
  sourceId: 'S-01',
  quote: source.text,
  detail: 'Budget remains open.',
};
const later: Source = {
  id: 'S-02',
  date: '2026-09-08',
  title: 'Update',
  text: 'The budget has been delivered. Maya is no longer assigned and the deadline is withdrawn.',
};
void test('synthetic scenario reconciles all five statuses with no stale completion draft', () => {
  const result = reconcile(
    sampleEvents,
    parseSources(sampleInput),
    '2026-09-08',
  );
  assert.equal(result.rejected.length, 0);
  assert.equal(result.commitments.length, 5);
  assert.deepEqual(
    result.commitments.map((c) => c.attention),
    ['overdue', 'blocked', 'clarify', 'upcoming', 'done'],
  );
  assert.equal(result.commitments.at(-1)?.draft, null);
});
void test('fabricated passages, owners and dates are rejected', () => {
  for (const changed of [
    { quote: 'Fabricated quote' },
    { owner: 'Elena' },
    { dueDate: '2026-09-06' },
  ])
    assert.equal(
      reconcile([{ ...event, ...changed }], [source], '2026-09-08').rejected
        .length,
      1,
    );
});
void test('same-source conflicting interpretations are order independent', () => {
  const done = { ...event, state: 'done' as const };
  for (const events of [
    [event, done],
    [done, event],
  ])
    assert.equal(
      reconcile(events, [source], '2026-09-08').commitments[0].attention,
      'clarify',
    );
});
void test('same-day conflicting owners are not assigned a named draft', () => {
  const r = reconcile(
    [event, { ...event, owner: 'Noah' }],
    [source],
    '2026-09-08',
  ).commitments[0];
  assert.equal(r.attention, 'clarify');
  assert.equal(r.owner, null);
  assert.ok(r.draft?.startsWith('Hi team,'));
});
void test('later completion suppresses overdue reminder', () => {
  const done = {
    ...event,
    state: 'done' as const,
    sourceId: later.id,
    quote: later.text,
    dueDate: null,
  };
  const r = reconcile([event, done], [source, later], '2026-09-08')
    .commitments[0];
  assert.equal(r.attention, 'done');
  assert.equal(r.draft, null);
});
void test('progress-only update inherits context, explicit withdrawals clear it', () => {
  const progress = {
    ...event,
    sourceId: later.id,
    quote: later.text,
    owner: null,
    dueDate: null,
  };
  const r = reconcile([event, progress], [source, later], '2026-09-08')
    .commitments[0];
  assert.equal(r.owner, 'Maya');
  assert.equal(r.dueDate, '2026-09-07');
  const withdrawn = reconcile(
    [event, { ...progress, clearsOwner: true, clearsDueDate: true }],
    [source, later],
    '2026-09-08',
  ).commitments[0];
  assert.equal(withdrawn.owner, null);
  assert.equal(withdrawn.dueDate, null);
  assert.equal(withdrawn.attention, 'clarify');
});
void test('future evidence and impossible dates are not used', () => {
  assert.equal(
    reconcile([event], [source], '2026-09-02').commitments.length,
    0,
  );
  assert.throws(() => parseSources('[S-01] 2026-02-30 | Bad date\nHello'));
  assert.throws(() => reconcile([event], [source], '2026-02-30'));
});
void test('export includes only approved drafts and labels example honestly', () => {
  const text = exportMarkdown(exampleReport(), {});
  assert.ok(text.includes('no model invoked'));
  assert.ok(!text.includes('Approved draft:'));
  assert.ok(
    exportMarkdown(exampleReport(), {
      'launch-budget': 'Approved text',
    }).includes('Approved text'),
  );
});
