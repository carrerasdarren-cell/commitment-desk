import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceEventsSchema } from '../lib/extraction-schema.ts';
import { parseSources } from '../lib/domain.ts';
import { sampleInput, sampleEvents } from '../lib/sample.ts';

const completionSource = parseSources(sampleInput).find(
  (s) => s.id === 'S-02',
)!;
const completion = {
  ...sampleEvents.find((e) => e.sourceId === 'S-02')!,
  clearsOwner: false,
  clearsDueDate: false,
};

void test('literal null markers become missing values without inventing evidence', () => {
  const result = sourceEventsSchema(completionSource).parse({
    events: [{ ...completion, owner: 'null', dueDate: 'null' }],
  });
  assert.equal(result.events[0].owner, null);
  assert.equal(result.events[0].dueDate, null);
});

void test('source metadata cannot become deadline evidence in structured output', () => {
  const schema = sourceEventsSchema(completionSource);
  assert.equal(
    schema.safeParse({
      events: [{ ...completion, dueDate: completionSource.date }],
    }).success,
    false,
  );
  const corrected = schema.parse({ events: [completion] });
  assert.equal(corrected.events[0].dueDate, null);
  assert.equal(corrected.events[0].state, 'done');
});

void test('structured output rejects a foreign source, altered quote, or inferred owner', () => {
  const schema = sourceEventsSchema(completionSource);
  for (const change of [
    { sourceId: 'S-01' },
    { quote: 'The access checklist was delivered yesterday.' },
    { owner: 'Elena' },
  ])
    assert.equal(
      schema.safeParse({ events: [{ ...completion, ...change }] }).success,
      false,
    );
});

void test('an explicitly supplied value cannot simultaneously be withdrawn', () => {
  const source = parseSources(sampleInput)[0];
  const event = { ...sampleEvents[0], clearsOwner: true, clearsDueDate: false };
  assert.equal(
    sourceEventsSchema(source).safeParse({ events: [event] }).success,
    false,
  );
});
