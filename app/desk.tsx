'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  LoaderCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { exampleReport, sampleInput } from '@/lib/sample';
import { labels, exportMarkdown, type Report } from '@/lib/domain';
export default function Desk() {
  const [liveAvailable, setLiveAvailable] = useState<boolean | undefined>();
  useEffect(() => {
    fetch('/api/analyze')
      .then((r) => r.json())
      .then((data) =>
        setLiveAvailable((data as { liveAvailable: boolean }).liveAvailable),
      )
      .catch(() => setLiveAvailable(false));
  }, []);
  const [report, setReport] = useState<Report>(exampleReport);
  const [selected, setSelected] = useState('launch-budget');
  const [input, setInput] = useState(sampleInput);
  const [asOf, setAsOf] = useState('2026-09-08');
  const [tab, setTab] = useState('review');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const item =
    report.commitments.find((c) => c.key === selected) ?? report.commitments[0];
  const urgent = report.commitments.filter((c) =>
    ['overdue', 'blocked', 'clarify'].includes(c.attention),
  ).length;
  async function analyze() {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, asOf }),
      });
      const data = (await response.json()) as Report & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Review failed.');
      setReport(data);
      setSelected(data.commitments[0]?.key ?? '');
      setApproved({});
      setEdits({});
      setTab('review');
      setNotice('Review complete. Verify evidence before approving drafts.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The review could not finish.');
    } finally {
      setPending(false);
    }
  }
  function download() {
    const blob = new Blob([exportMarkdown(report, approved)], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commitment-desk-${report.asOf}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Handoff downloaded. No messages were sent.');
  }
  return (
    <main className="desk-shell">
      <header className="masthead">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <CheckCheck size={22} />
          </span>
          Commitment Desk
        </Link>
        <div className="masthead-right">
          <span className="quiet-dot" />
          Professional workspace
          <span className="small-divider" />
          {report.mode === 'example' ? 'Northline Studio' : 'Project review'}
          <span className="avatar">
            {report.mode === 'example' ? 'NS' : 'PR'}
          </span>
        </div>
      </header>
      <section className="workspace-heading">
        <div>
          <p className="eyebrow">PROJECT CLOSEOUT</p>
          <h1>
            Today’s commitments<span className="heading-dot">.</span>
          </h1>
          <p className="intro">
            Review what is overdue, blocked, or waiting for clarity.
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={download}>
            <ArrowUpRight size={16} />
            Export handoff
          </Button>
          <Button onClick={() => setTab('updates')}>
            <Play size={14} />
            Review updates
          </Button>
        </div>
      </section>
      <div className={`mode-banner ${report.mode === 'live' ? 'live' : ''}`}>
        <span>
          <span className="mode-indicator" />
          {report.mode === 'example'
            ? 'Synthetic example · no language model has run'
            : 'Live Strands review · ' + report.provider}
        </span>
        <span>As of {report.asOf}</span>
      </div>
      <div className="summary-strip">
        <div>
          <strong>{String(urgent).padStart(2, '0')}</strong>
          <span>need attention</span>
        </div>
        <div>
          <strong>
            {String(
              report.commitments.filter((c) => c.attention === 'upcoming')
                .length,
            ).padStart(2, '0')}
          </strong>
          <span>on track</span>
        </div>
        <div>
          <strong>
            {String(
              report.commitments.filter((c) => c.attention === 'done').length,
            ).padStart(2, '0')}
          </strong>
          <span>completed</span>
        </div>
        <div className="summary-note">
          <FileText size={17} />
          {report.sources.length} source updates
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="desk-tabs">
          <TabsTrigger value="review">Commitment review</TabsTrigger>
          <TabsTrigger value="updates">Source updates</TabsTrigger>
          <TabsTrigger value="activity">Run activity</TabsTrigger>
        </TabsList>
        {notice && (
          <output className="notice">
            {notice}
          </output>
        )}
        <TabsContent value="review">
          <div className="review-grid">
            <section className="commitment-list" aria-label="Commitments">
              <div className="section-label">
                COMMITMENT<span>STATUS</span>
              </div>
              {!report.commitments.length && (
                <div className="empty-state">
                  No supported commitments were found in these updates.
                </div>
              )}
              {report.commitments.map((c, i) => (
                <button
                  className={`commitment-row ${item?.key === c.key ? 'selected' : ''}`}
                  key={c.key}
                  onClick={() => setSelected(c.key)}
                >
                  <span className="row-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="row-main">
                    <span className="row-title">
                      {c.title}
                      {approved[c.key] && (
                        <Check size={15} aria-label="Draft approved" />
                      )}
                    </span>
                    <span className="row-meta">
                      {c.owner ?? 'Owner unconfirmed'}
                      <span>·</span>
                      {c.dueDate ? `Due ${c.dueDate}` : 'Deadline unconfirmed'}
                    </span>
                  </span>
                  <span className={`status-pill ${c.attention}`}>
                    {labels[c.attention]}
                  </span>
                  <ChevronRight className="row-chevron" size={16} />
                </button>
              ))}
              <div className="list-footnote">
                <ClipboardList size={16} />
                Statuses reflect the supplied updates.
              </div>
            </section>
            {item && (
              <aside className="evidence-panel">
                <div className="panel-top">
                  <p className="eyebrow">SOURCE EVIDENCE</p>
                  <span className={`status-pill ${item.attention}`}>
                    {labels[item.attention]}
                  </span>
                </div>
                <h2>{item.title}</h2>
                <p className="detail-text">{item.detail}</p>
                <div className="evidence-list">
                  {item.evidence.map((e, i) => (
                    <div className="evidence-entry" key={e.sourceId + '-' + i}>
                      <div className="evidence-meta">
                        <span className="source-id">{e.sourceId}</span>
                        <span>{e.sourceDate}</span>
                      </div>
                      <blockquote>“{e.quote}”</blockquote>
                      <span className="source-title">{e.sourceTitle}</span>
                    </div>
                  ))}
                </div>
                {item.draft ? (
                  <div className="draft-box">
                    <div className="draft-label">
                      <h3>Suggested follow-up</h3>
                      <span>DRAFT ONLY</span>
                    </div>
                    <Textarea
                      aria-label="Edit follow-up draft"
                      value={edits[item.key] ?? item.draft}
                      onChange={(e) => {
                        setEdits({ ...edits, [item.key]: e.target.value });
                        setApproved((prev) => {
                          const next = { ...prev };
                          delete next[item.key];
                          return next;
                        });
                      }}
                    />
                    <div className="draft-footer">
                      <span>No message will be sent.</span>
                      <Button
                        size="sm"
                        variant={approved[item.key] ? 'outline' : 'default'}
                        disabled={!(edits[item.key] ?? item.draft).trim()}
                        onClick={() => {
                          setApproved({
                            ...approved,
                            [item.key]: edits[item.key] ?? item.draft ?? '',
                          });
                          setNotice(
                            'Draft approved for export. No message was sent.',
                          );
                        }}
                      >
                        <Check size={15} />
                        {approved[item.key] ? 'Approved' : 'Approve draft'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="done-note">
                    <CheckCheck size={20} />
                    Completion is supported by a later update. No follow-up is
                    needed.
                  </div>
                )}
              </aside>
            )}
          </div>
        </TabsContent>
        <TabsContent value="updates">
          <section className="input-panel">
            {liveAvailable === false && (
              <p className="notice">
                This hosted preview supports the example, draft review and
                export. Live analysis needs a connected model. The local project
                includes the Strands agent.
              </p>
            )}
            <div className="input-heading">
              <div>
                <h2>Review a batch of updates</h2>
                <p>
                  Keep one dated source per block. Use synthetic or shareable
                  project notes.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setInput(sampleInput);
                  setAsOf('2026-09-08');
                  setError('');
                }}
              >
                <RotateCcw size={14} />
                Load example
              </Button>
            </div>
            <label htmlFor="as-of">Review date</label>
            <Input
              id="as-of"
              type="date"
              className="date-input"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
            <label htmlFor="updates">Project updates</label>
            <Textarea
              id="updates"
              className="source-editor"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={18000}
            />
            <div className="input-footer">
              <p>
                Header: <code>[S-01] 2026-09-08 | Meeting notes</code>
              </p>
              <Button
                onClick={analyze}
                disabled={pending || !input.trim() || liveAvailable !== true}
              >
                {pending ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Play size={14} />
                )}{' '}
                {pending ? 'Agent is reviewing…' : 'Analyze with Strands'}
              </Button>
            </div>
            {pending && (
              <output className="notice">
                The agent is checking your updates. Local models may take a few
                minutes.
              </output>
            )}
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="activity">
          <section className="activity-panel">
            <h2>Run activity</h2>
            <p>
              {report.mode === 'example'
                ? 'This is a deterministic example. No model invocation or tool activity is claimed.'
                : 'Events captured from the Strands agent’s tool hooks.'}
            </p>
            <dl className="run-facts">
              <div>
                <dt>Mode</dt>
                <dd>{report.mode}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{report.provider}</dd>
              </div>
              <div>
                <dt>Supported items</dt>
                <dd>{report.commitments.length}</dd>
              </div>
              <div>
                <dt>Rejected extractions</dt>
                <dd>{report.rejected.length}</dd>
              </div>
            </dl>
            {report.trace.map((e, i) => (
              <div className="trace-row" key={i}>
                <span className="source-id">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <code>{e.tool}</code>
                <span>{e.phase}</span>
                <span>{e.status ?? ''}</span>
                <span>{e.durationMs ? `${e.durationMs} ms` : ''}</span>
              </div>
            ))}
            {report.rejected.map((r, i) => (
              <p key={i} className="error-box">
                {r.sourceId}: {r.reason}
              </p>
            ))}
          </section>
        </TabsContent>
      </Tabs>
      <footer className="desk-footer">
        <span>Commitment Desk</span>
        <span>
          Approvals apply to exported drafts. Nothing is sent automatically.
        </span>
        <span>Strands Agents</span>
      </footer>
    </main>
  );
}
