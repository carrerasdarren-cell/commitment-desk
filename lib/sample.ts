import { parseSources, reconcile, type Event, type Report } from './domain.ts';
export const sampleInput = `[S-01] 2026-09-03 | Northline Studio — Thursday stand-up
Maya will send the launch budget to the client by 2026-09-07.
Noah owns the accessibility fixes, due 2026-09-09.
Elena will deliver the access checklist by 2026-09-04.
Owen will confirm the kickoff time early next week; no specific date agreed.
Maya will approve the supplier invoice by 2026-09-07.

[S-02] 2026-09-04 | Elena — project channel
The access checklist is delivered and the client has acknowledged receipt.

[S-03] 2026-09-07 | Monday handoff
Maya: supplier invoice approval is blocked until the purchase order arrives. The original deadline remains 2026-09-07.
Noah: accessibility fixes are on track for 2026-09-09.
Owen: kickoff time is still unconfirmed. Please don't promise a date yet.`;
export const sampleEvents: Event[] = [
  {
    key: 'launch-budget',
    title: 'Send launch budget',
    owner: 'Maya',
    dueDate: '2026-09-07',
    state: 'open',
    sourceId: 'S-01',
    quote: 'Maya will send the launch budget to the client by 2026-09-07.',
    detail: 'No completion update appears in the supplied sources.',
  },
  {
    key: 'accessibility-fixes',
    title: 'Finish accessibility fixes',
    owner: 'Noah',
    dueDate: '2026-09-09',
    state: 'open',
    sourceId: 'S-01',
    quote: 'Noah owns the accessibility fixes, due 2026-09-09.',
    detail: 'Work is assigned to Noah.',
  },
  {
    key: 'access-checklist',
    title: 'Deliver access checklist',
    owner: 'Elena',
    dueDate: '2026-09-04',
    state: 'open',
    sourceId: 'S-01',
    quote: 'Elena will deliver the access checklist by 2026-09-04.',
    detail: 'Delivery is expected by September 4.',
  },
  {
    key: 'kickoff-time',
    title: 'Confirm kickoff time',
    owner: 'Owen',
    dueDate: null,
    state: 'unclear',
    sourceId: 'S-01',
    quote:
      'Owen will confirm the kickoff time early next week; no specific date agreed.',
    detail: 'No exact deadline has been agreed.',
  },
  {
    key: 'supplier-invoice',
    title: 'Approve supplier invoice',
    owner: 'Maya',
    dueDate: '2026-09-07',
    state: 'open',
    sourceId: 'S-01',
    quote: 'Maya will approve the supplier invoice by 2026-09-07.',
    detail: 'Awaiting approval.',
  },
  {
    key: 'access-checklist',
    title: 'Deliver access checklist',
    owner: null,
    dueDate: null,
    state: 'done',
    sourceId: 'S-02',
    quote:
      'The access checklist is delivered and the client has acknowledged receipt.',
    detail: 'Delivery is explicitly confirmed in the September 4 update.',
  },
  {
    key: 'supplier-invoice',
    title: 'Approve supplier invoice',
    owner: 'Maya',
    dueDate: '2026-09-07',
    state: 'blocked',
    sourceId: 'S-03',
    quote:
      'Maya: supplier invoice approval is blocked until the purchase order arrives. The original deadline remains 2026-09-07.',
    detail: 'Waiting for the purchase order before Maya can approve.',
  },
  {
    key: 'accessibility-fixes',
    title: 'Finish accessibility fixes',
    owner: 'Noah',
    dueDate: '2026-09-09',
    state: 'open',
    sourceId: 'S-03',
    quote: 'Noah: accessibility fixes are on track for 2026-09-09.',
    detail: 'Latest update confirms the agreed date.',
  },
  {
    key: 'kickoff-time',
    title: 'Confirm kickoff time',
    owner: 'Owen',
    dueDate: null,
    state: 'unclear',
    sourceId: 'S-03',
    quote:
      "Owen: kickoff time is still unconfirmed. Please don't promise a date yet.",
    detail: 'Ask Owen to confirm a date; none is supported by the updates.',
  },
];
export function exampleReport(): Report {
  const sources = parseSources(sampleInput);
  return {
    asOf: '2026-09-08',
    mode: 'example',
    provider: 'Synthetic example',
    sources,
    ...reconcile(sampleEvents, sources, '2026-09-08'),
    trace: [],
    generatedAt: '2026-09-08T12:00:00.000Z',
  };
}
