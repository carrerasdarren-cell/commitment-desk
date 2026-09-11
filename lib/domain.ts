export type Source = { id: string; date: string; title: string; text: string };
export type Event = {
  key: string;
  title: string;
  owner: string | null;
  dueDate: string | null;
  state: 'open' | 'blocked' | 'done' | 'unclear';
  sourceId: string;
  quote: string;
  detail: string;
  clearsOwner?: boolean;
  clearsDueDate?: boolean;
};
export type Evidence = Event & { sourceDate: string; sourceTitle: string };
export type Commitment = {
  key: string;
  title: string;
  owner: string | null;
  dueDate: string | null;
  state: Event['state'];
  attention: 'overdue' | 'blocked' | 'clarify' | 'upcoming' | 'done';
  detail: string;
  evidence: Evidence[];
  draft: string | null;
};
export type Trace = {
  tool: string;
  phase: 'started' | 'finished';
  status?: string;
  durationMs?: number;
};
export type Report = {
  asOf: string;
  mode: 'example' | 'live';
  provider: string;
  sources: Source[];
  commitments: Commitment[];
  trace: Trace[];
  rejected: { sourceId: string; reason: string }[];
  generatedAt: string;
};
export const labels = {
  overdue: 'Overdue',
  blocked: 'Blocked',
  clarify: 'Needs clarity',
  upcoming: 'On track',
  done: 'Completed',
};
export const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export function parseSources(input: string): Source[] {
  if (input.length > 18000)
    throw new Error('Keep each review under 18,000 characters.');
  const seen = new Set<string>();
  return input
    .trim()
    .split(/\n(?=\[S-\d+\])/)
    .map((block) => {
      const [header, ...lines] = block.split('\n');
      const m = header.match(/^\[(S-\d+)\]\s+(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
      if (!m || !isDate(m[2]))
        throw new Error(
          'Each update needs a header like [S-01] 2026-09-08 | Meeting notes.',
        );
      if (seen.has(m[1])) throw new Error('Each source needs a unique ID.');
      seen.add(m[1]);
      const text = lines.join('\n').trim();
      if (!text) throw new Error(m[1] + ' has no text.');
      return { id: m[1], date: m[2], title: m[3].trim(), text };
    });
}
export function reconcile(events: Event[], sources: Source[], asOf: string) {
  if (!isDate(asOf)) throw new Error('Choose a valid review date.');
  const map = new Map(sources.map((s) => [s.id, s]));
  const accepted: Evidence[] = [];
  const rejected: Report['rejected'] = [];
  for (const e of events) {
    const s = map.get(e.sourceId);
    let reason = '';
    if (!s) reason = 'Source ID does not exist.';
    else if (!e.quote.trim() || !s.text.includes(e.quote))
      reason = 'Quoted evidence is not an exact passage in the source.';
    else if (s.date > asOf) reason = 'Update is after the review date.';
    else if (e.dueDate && (!isDate(e.dueDate) || !e.quote.includes(e.dueDate)))
      reason = 'Deadline is invalid or absent from the quoted evidence.';
    else if (e.owner && !e.quote.toLowerCase().includes(e.owner.toLowerCase()))
      reason = 'Owner is absent from the quoted evidence.';
    else if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(e.key))
      reason = 'Invalid commitment key.';
    if (reason || !s) {
      rejected.push({ sourceId: e.sourceId, reason });
      continue;
    }
    if (
      !accepted.some(
        (a) =>
          a.key === e.key &&
          a.sourceId === e.sourceId &&
          a.quote === e.quote &&
          a.state === e.state &&
          a.owner === e.owner &&
          a.dueDate === e.dueDate &&
          !!a.clearsOwner === !!e.clearsOwner &&
          !!a.clearsDueDate === !!e.clearsDueDate,
      )
    )
      accepted.push({ ...e, sourceDate: s.date, sourceTitle: s.title });
  }
  const groups = new Map<string, Evidence[]>();
  for (const e of accepted)
    groups.set(e.key, [...(groups.get(e.key) ?? []), e]);
  const commitments: Commitment[] = [];
  for (const [key, evidence] of groups) {
    evidence.sort(
      (a, b) =>
        a.sourceDate.localeCompare(b.sourceDate) ||
        a.sourceId.localeCompare(b.sourceId),
    );
    const last = evidence[evidence.length - 1];
    const sameDay = evidence.filter((e) => e.sourceDate === last.sourceDate);
    const ownerConflict =
      new Set(
        sameDay
          .filter((e) => e.owner || e.clearsOwner)
          .map((e) => (e.clearsOwner ? '__cleared' : e.owner?.toLowerCase())),
      ).size > 1;
    const dateConflict =
      new Set(
        sameDay
          .filter((e) => e.dueDate || e.clearsDueDate)
          .map((e) => (e.clearsDueDate ? '__cleared' : e.dueDate)),
      ).size > 1;
    const conflict =
      ownerConflict ||
      dateConflict ||
      new Set(sameDay.map((e) => e.state)).size > 1;
    const state = conflict ? 'unclear' : last.state;
    const ownerEvent = [...evidence]
      .reverse()
      .find((e) => e.owner || e.clearsOwner);
    const dateEvent = [...evidence]
      .reverse()
      .find((e) => e.dueDate || e.clearsDueDate);
    const owner =
      ownerConflict || ownerEvent?.clearsOwner
        ? null
        : (ownerEvent?.owner ?? null);
    const dueDate =
      dateConflict || dateEvent?.clearsDueDate
        ? null
        : (dateEvent?.dueDate ?? null);
    const attention =
      state === 'done'
        ? 'done'
        : conflict || state === 'unclear' || !owner || !dueDate
          ? 'clarify'
          : state === 'blocked'
            ? 'blocked'
            : dueDate < asOf
              ? 'overdue'
              : 'upcoming';
    const item: Commitment = {
      key,
      title: evidence[0].title,
      owner,
      dueDate,
      state,
      attention,
      detail: conflict
        ? 'Updates on the same date disagree. Confirm the current status before acting.'
        : last.detail,
      evidence,
      draft: null,
    };
    if (attention !== 'done') item.draft = draftFollowup(item);
    commitments.push(item);
  }
  const rank = { overdue: 0, blocked: 1, clarify: 2, upcoming: 3, done: 4 };
  commitments.sort(
    (a, b) =>
      rank[a.attention] - rank[b.attention] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      a.key.localeCompare(b.key),
  );
  return { commitments, rejected };
}
export function draftFollowup(c: Commitment) {
  const hi = c.owner ? 'Hi ' + c.owner.split(' ')[0] + ',' : 'Hi team,';
  const ask =
    c.attention === 'clarify'
      ? `Could you confirm the current owner, status, and agreed deadline for ${c.title.toLowerCase()}? The updates leave a detail unresolved.`
      : c.state === 'blocked'
        ? `The latest update indicates ${c.title.toLowerCase()} is blocked. What needs to happen next, and who can help unblock it?`
        : c.attention === 'overdue'
          ? `Checking in on ${c.title.toLowerCase()}, which was due ${c.dueDate}. Has this been completed? If it is still open, please share the next step and a revised date.`
          : `Checking in on ${c.title.toLowerCase()}, due ${c.dueDate}. Are we still on track, or is there anything needed to finish it?`;
  return hi + '\n\n' + ask + '\n\nThank you.';
}
export function exportMarkdown(r: Report, approved: Record<string, string>) {
  return [
    `# Commitment Desk — ${r.asOf}`,
    `\nRun: ${r.mode === 'live' ? 'Live Strands agent' : 'Deterministic example; no model invoked'} (${r.provider})`,
    '\nApproval authorizes a draft for handoff only. No messages were sent.',
    ...r.commitments.map(
      (c) =>
        `\n## ${c.title}\n${labels[c.attention]} · ${c.owner ?? 'Owner unconfirmed'} · ${c.dueDate ?? 'Deadline unconfirmed'}\n\n${c.detail}\n\n${c.evidence.map((e) => `- [${e.sourceId}] ${e.sourceDate}: ${e.quote}`).join('\n')}\n${approved[c.key] ? '\nApproved draft:\n\n' + approved[c.key] : ''}`,
    ),
  ].join('\n');
}
