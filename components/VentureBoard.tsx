'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
// Type-only imports: lib/tickets pulls in node:fs / the GitHub client, which must never reach the
// client bundle. `import type` is erased at build, so only the shapes cross the boundary.
import type { LaneTickets, TicketStatusGroup, TicketWithMeta } from '@/lib/tickets';
import type { DepartmentSummary } from '@/lib/ventures';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { STATUS_LABEL } from '@/lib/glossary';
import { laneErrorTone, toneColor } from '@/lib/status';
import { TicketDrawer } from './TicketDrawer';
import { ApprovalCard } from './ApprovalCard';

// FB-048: the founder's three owned surfaces. Plain-language gate labels (FB-024) — the founder sees
// "how work here is approved", never the contract enum.
const GATE_LABEL: Record<string, string> = {
  pr: 'approved by review',
  activegraph: 'approved before it goes out',
  'tbd-fb012': 'approval coming',
};

// Column keys stay technical (col-<key> test ids, contract statuses); the visible label is the
// founder-facing term from the glossary (FB-024) — e.g. "pr-open" → "Needs your OK".
const GROUPS: { key: TicketStatusGroup; label: string }[] = [
  { key: 'todo', label: STATUS_LABEL.todo },
  { key: 'in-progress', label: STATUS_LABEL['in-progress'] },
  { key: 'pr-open', label: STATUS_LABEL['pr-open'] },
  { key: 'done', label: STATUS_LABEL.done },
];

interface Selected {
  repo: string;
  ref: string;
  item: TicketWithMeta;
}

// FB-021: present each read-failure state so a founder can tell "not set up yet" from "broken".
// Setup states read `attention` (a next step, not a crash); an unexpected fault reads `blocked`.
// FB-057 moved the tone decision itself into lib/status.ts — the studio has one status vocabulary,
// and a component that keeps its own private one is how the patchwork starts.
type LaneErrorKind = LaneTickets['errorKind'];

function laneErrorNextStep(kind: LaneErrorKind): string | null {
  switch (kind) {
    case 'no-credentials':
      return 'an admin connects the studio to GitHub (install the Foundry GitHub App, or set a read token) so it can see this venture’s work.';
    case 'unreadable':
      return 'give the studio’s GitHub credential read access to this repository (install or scope the Foundry GitHub App, or the read token) — or check the repository name is right.';
    case 'rate-limit': // resolves on refresh; the message already says so.
    case 'error':
    case null:
      return null;
    default: {
      const _exhaustive: never = kind; // a new LaneErrorKind must be handled above.
      return _exhaustive;
    }
  }
}

export function VentureBoard({
  venture,
  lanes,
  departments = [],
  approvals = [],
  staleRepos = [],
  totalWarnings,
  fetchedAt,
  org,
}: {
  venture: { id: string; name: string; status: string; founderName: string | null; chatUrl: string | null };
  lanes: LaneTickets[];
  departments?: DepartmentSummary[];
  approvals?: ActiveGraphApproval[];
  staleRepos?: string[];
  totalWarnings: number;
  fetchedAt: number;
  org: string;
}) {
  const pendingApprovals = approvals.filter((a) => a.status === 'proposed');
  // Nothing that reached the executor may leave the founder's view without a visible outcome. The
  // previous version rendered ONLY `proposed`, so a `failed` send — the state added precisely to make
  // an errored real action loud — silently vanished from the queue, as did an unverifiable one
  // (CLAUDE.md #10 inverted).
  const needsAttention = approvals.filter((a) => a.status === 'failed' || a.status === 'unverified-action');
  const [selected, setSelected] = useState<Selected | null>(null);
  const stale = new Set(staleRepos);

  // Index every ticket by id so dependency chips in the drawer can jump to another ticket.
  const index = useMemo(() => {
    const m = new Map<string, Selected>();
    for (const lane of lanes) {
      for (const g of GROUPS) {
        for (const item of lane.groups[g.key]) m.set(item.ticket.id, { repo: lane.repo, ref: lane.ref, item });
      }
    }
    return m;
  }, [lanes]);

  const selectById = (id: string) => {
    const hit = index.get(id);
    if (hit) setSelected(hit);
  };

  return (
    <section>
      <p className="eyebrow">
        <span className="eyebrow-id">{venture.id}</span> — Venture
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{venture.name}</h1>
        <span className={`tag ${venture.status === 'active' ? 'tag-accent' : ''}`}>{venture.status}</span>
        {totalWarnings > 0 ? (
          <span className="tag" data-testid="warnings-badge" title="Tickets parsed with warnings">
            ⚠ {totalWarnings} warning{totalWarnings === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
        {venture.founderName ? <>Founder: {venture.founderName} · </> : null}
        <span className="mono">updated {new Date(fetchedAt).toLocaleTimeString()}</span> ·{' '}
        <Link href={`/venture/${venture.id}?refresh=1`} className="mono" data-testid="refresh">
          refresh
        </Link>
      </p>

      {/* Conversational composer entry (FB-025). A real link once the venture's box is provisioned
          (chat.<box host>); otherwise an honest "coming with your box" note — never a dead link. */}
      {venture.chatUrl ? (
        <a
          className="btn btn-primary"
          href={venture.chatUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="venture-chat-link"
          style={{ marginTop: '0.25rem' }}
        >
          💬 Chat — describe what you want
        </a>
      ) : (
        <p className="card muted" data-testid="venture-chat-pending" style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.25rem' }}>
          💬 Your conversational composer — describe what you want in plain English and it becomes a
          workstream — will appear here once this venture’s box is set up.
        </p>
      )}

      {/* FB-046: external actions awaiting the founder's OK (the ActiveGraph gate). The founder
          approves here — never on github.com; Approve signs the grant the executor verifies. */}
      {pendingApprovals.length > 0 ? (
        <div data-testid="approvals-queue" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Needs your OK — before anything goes out</p>
          {pendingApprovals.map((a) => (
            <ApprovalCard key={a.id} ventureId={venture.id} approval={a} />
          ))}
        </div>
      ) : null}

      {needsAttention.length > 0 ? (
        <div data-testid="approvals-attention" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Went out, or tried to — needs your eye</p>
          {needsAttention.map((a) => (
            <ApprovalCard key={a.id} ventureId={venture.id} approval={a} />
          ))}
        </div>
      ) : null}

      {/* The three founder-owned surfaces (FB-048): Build / Sell / Scale. Each is its own queue with
          its own approval gate — so product-building, selling, and scaling are managed separately. */}
      {departments.length > 0 ? (
        <div data-testid="dept-surfaces" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Your surfaces</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '0.75rem' }}>
            {departments.map((d) => (
              <div key={d.id} className="card" data-testid={`dept-${d.id}`} style={{ opacity: d.provisioned ? 1 : 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong style={{ fontSize: 'var(--fs-subhead)' }}>{d.name}</strong>
                  <span className={`tag ${d.provisioned ? 'tag-accent' : ''}`} data-testid={`dept-${d.id}-state`}>
                    {d.provisioned ? 'active' : 'coming'}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.35rem 0 0' }}>
                  {d.provisioned
                    ? <>Work here is <span className="mono">{GATE_LABEL[d.gate] ?? d.gate}</span>.</>
                    : <>Set up when this venture’s <span className="mono">{d.repo}</span> repo is provisioned.</>}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <hr className="hr" />

      {lanes.map((lane) => (
        <div key={lane.repo} style={{ marginBottom: '2.5rem' }} data-testid={`lane-${lane.repo}`}>
          <h3 className="mono" style={{ fontSize: 'var(--fs-subhead)' }}>
            {lane.repo} <span className="muted">· {lane.total} ticket{lane.total === 1 ? '' : 's'}</span>
            {stale.has(lane.repo) ? (
              <span className="tag" data-testid={`lane-stale-${lane.repo}`} title="No repo activity in the staleness window" style={{ marginLeft: '0.4rem', color: toneColor('attention') }}>
                ⚠ stale
              </span>
            ) : null}
            {lane.skipped > 0 ? (
              <span className="muted" data-testid={`lane-skipped-${lane.repo}`} title="Non-ticket .md files in docs/tickets">
                {' '}· {lane.skipped} non-ticket file{lane.skipped === 1 ? '' : 's'} skipped
              </span>
            ) : null}
          </h3>

          {lane.error ? (
            <div
              className="card"
              data-testid="lane-error"
              data-error-kind={lane.errorKind ?? 'error'}
              style={{
                borderColor: toneColor(laneErrorTone(lane.errorKind)),
                color: toneColor(laneErrorTone(lane.errorKind)),
              }}
            >
              <div>{lane.error}</div>
              {laneErrorNextStep(lane.errorKind) ? (
                <div className="muted" data-testid="lane-error-next" style={{ marginTop: '0.45rem', fontSize: 'var(--fs-meta-lg)' }}>
                  <strong>Next step:</strong> {laneErrorNextStep(lane.errorKind)}
                </div>
              ) : null}
            </div>
          ) : lane.total === 0 ? (
            <p className="card muted" data-testid="lane-empty">
              No tickets on the default branch (<span className="mono">{lane.ref}</span>) yet. If this
              venture&rsquo;s backlog lives on another branch, it needs to be on the default branch to show here.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
              {GROUPS.map((g) => (
                <div key={g.key} data-testid={`col-${g.key}`}>
                  <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                    {g.label} <span className="mono">{lane.groups[g.key].length}</span>
                  </p>
                  <div className="stack" style={{ gap: '0.5rem' }}>
                    {lane.groups[g.key].map((item) => (
                      <button
                        key={item.ticket.id}
                        className="card card-link"
                        style={{ textAlign: 'left', cursor: 'pointer', padding: '0.7rem 0.85rem' }}
                        data-testid={`ticket-${item.ticket.id}`}
                        onClick={() => setSelected({ repo: lane.repo, ref: lane.ref, item })}
                      >
                        <span className="mono eyebrow-id" style={{ fontSize: 'var(--fs-eyebrow)' }}>{item.ticket.id}</span>
                        <div style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.15rem' }}>{item.ticket.title}</div>
                        {item.warnings.length > 0 ? (
                          <span className="tag" style={{ marginTop: '0.35rem', color: toneColor('attention') }}>
                            ⚠ {item.warnings.length}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {selected ? (
        <TicketDrawer
          item={selected.item}
          repo={selected.repo}
          gitRef={selected.ref}
          org={org}
          knownIds={index}
          onSelectId={selectById}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
