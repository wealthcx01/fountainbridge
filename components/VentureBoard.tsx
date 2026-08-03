'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
// Type-only imports: lib/tickets pulls in node:fs / the GitHub client, which must never reach the
// client bundle. `import type` is erased at build, so only the shapes cross the boundary.
import type { LaneTickets, TicketStatusGroup, TicketWithMeta } from '@/lib/tickets';
import type { DepartmentSummary } from '@/lib/ventures';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { describe as describeBudget, type BudgetDisclosure } from '@/lib/budgets';
import { STATUS_LABEL } from '@/lib/glossary';
import { ago } from '@/lib/when';
import { emptyPanel } from '@/lib/firstrun';
import { laneErrorTone, toneColor } from '@/lib/status';
import { TicketDrawer } from './TicketDrawer';
import { ApprovalCard, type ApprovalHistory } from './ApprovalCard';
import { FounderBrief } from './FounderBrief';
import { LaneActivity } from './LaneActivity';
import type { Brief } from '@/lib/brief';
import type { RunReport } from '@/lib/runreports';

// FB-048: the founder's three owned surfaces. Plain-language gate labels (FB-024) — the founder sees
// "how work here is approved", never the contract enum.
//
// WHOLE SENTENCES, not fragments slotted into "Work here is ___." (FB-063). The fragment form read
// "Work here is approval coming." for the gate that has not been specified yet — a template can only
// be as grammatical as its worst case, and the worst case is the one a founder meets on a surface
// nobody has finished designing.
const GATE_LABEL: Record<string, string> = {
  pr: 'Work here is approved by review.',
  activegraph: 'Work here is approved before it goes out.',
  'tbd-fb012': 'How work here gets approved is still being decided. Nothing goes out meanwhile.',
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
      return 'an admin connects the studio to GitHub (install the Foundry GitHub App, or set a read token) so it can see this venture\u2019s work.';
    case 'unreadable':
      return 'give the studio\u2019s GitHub credential read access to this repository (install or scope the Foundry GitHub App, or the read token) \u2014 or check the repository name is right.';
    case 'rate-limit':
    case 'error':
    case null:
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Over the limit gets weight and colour; everything else is ordinary text.
 *
 * There is no state ladder to announce any more — the sentence says what it says, and `overLimit` is
 * a statement about the reported figures rather than a verdict on an action. The previous version
 * carried four states across a glyph, a colour, a DOM attribute and an sr-only twin, and they
 * drifted apart from each other and from the words.
 */
function budgetTone(budget: BudgetDisclosure | null): { color?: string; weight?: number } {
  return budget?.overLimit ? { color: toneColor('blocked'), weight: 600 } : {};
}

export function VentureBoard({
  venture,
  lanes,
  departments = [],
  approvals = [],
  histories = {},
  budgets = [],
  budgetsError = null,
  brief = null,
  runs = [],
  runsTotal = 0,
  engine = null,
  orphanEnvelopes = [],
  staleRepos = [],
  totalWarnings,
  fetchedAt,
  org,
  wiringWarning = null,
}: {
  venture: {
    id: string; name: string; status: string; founderName: string | null; hasComposer: boolean;
    /** The box's own chat, on its own screen (FB-086). Null until the venture has a box. */
    chatUrl: string | null;
  };
  lanes: LaneTickets[];
  departments?: DepartmentSummary[];
  approvals?: ActiveGraphApproval[];
  /** The ActiveGraph story per approval, keyed `repo/id` (FB-071). Narrated server-side. */
  histories?: Record<string, ApprovalHistory>;
  budgets?: (BudgetDisclosure | null)[];
  /** The venture in a paragraph (FB-042) — composed server-side so the ordering has one owner. */
  brief?: Brief | null;
  /** What the agent lanes did, newest first (FB-042). */
  runs?: RunReport[];
  runsTotal?: number;
  engine?: { state: string; text: string } | null;
  /** Non-null when the venture's budgets file exists but could not be read (FB-054). */
  budgetsError?: string | null;
  /** Envelopes keyed to departments this venture does not declare — configured but enforcing nothing. */
  orphanEnvelopes?: string[];
  staleRepos?: string[];
  totalWarnings: number;
  fetchedAt: number;
  org: string;
  /** FB-087: admin-only — this venture has a box the studio cannot reach. Null for founders. */
  wiringWarning?: string | null;
}) {
  const pendingApprovals = approvals.filter((a) => a.status === 'proposed');
  // Nothing that reached the executor may leave the founder's view without a visible outcome. The
  // previous version rendered ONLY `proposed`, so a `failed` send — the state added precisely to make
  // an errored real action loud — silently vanished from the queue, as did an unverifiable one
  // (CLAUDE.md #10 inverted).
  const needsAttention = approvals.filter((a) => a.status === 'failed' || a.status === 'unverified-action');
  // FB-058: and everything else. `granted`, `executing`, `executed` and `rejected` rendered NOWHERE,
  // so a founder clicked Approve and watched the card disappear with no evidence anything was queued
  // — the approval only came back into view if it later failed. Approving something irreversible and
  // being shown nothing is the same silent gap in a worse place, so every approval now appears
  // somewhere with its state on it.
  const decided = approvals.filter(
    (a) => a.status === 'granted' || a.status === 'executing' || a.status === 'executed' || a.status === 'rejected',
  );
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
        {/* FB-068: a badge that cannot be interrogated trains people to ignore badges. It says what
            it means, in words, and is reachable by keyboard rather than by hover alone. */}
        {totalWarnings > 0 ? (
          <span
            className="tag"
            data-testid="warnings-badge"
            tabIndex={0}
            title={`${totalWarnings} ticket${totalWarnings === 1 ? '' : 's'} could not be read completely — some detail is missing from the board, and nothing is lost in git.`}
          >
            <span aria-hidden="true">⚠ </span>
            {totalWarnings} ticket{totalWarnings === 1 ? '' : 's'} not fully read
          </span>
        ) : null}
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
        {venture.founderName ? <>Founder: {venture.founderName} · </> : null}
        {/* FB-068: "3:05:32 PM" was a clock reading, not an answer to "is this current?". */}
        <span>updated {ago(new Date(fetchedAt).toISOString()) ?? 'just now'}</span> ·{' '}
        <Link href={`/venture/${venture.id}?refresh=1`} className="mono" data-testid="refresh">
          refresh
        </Link>
      </p>

      {/* FB-042: the brief goes FIRST. Everything below it is a dashboard, and a dashboard shows you
          what exists without telling you what to do about it. */}
      {brief ? <FounderBrief brief={brief} /> : null}

      {/* FB-087. The composer was broken in production for weeks and the only way anyone could find
          out was a founder pressing the button and getting an error. This is the same fact, told to
          the person who can fix it, before that happens. */}
      {wiringWarning ? (
        <p className="card" data-testid="wiring-warning"
           style={{ borderColor: toneColor('blocked'), color: toneColor('blocked'), fontSize: 'var(--fs-body-sm)' }}>
          {wiringWarning}
        </p>
      ) : null}

      {/* Conversational composer entry (FB-025 → in-studio in FB-065 → back out in FB-086).
          FB-065 pulled the composer into a studio page so a founder never had to leave for a
          different-looking product with no way back. The reasoning was sound and the surface is
          still there at /venture/<id>/composer — but John tested it and it did not work, and a
          working screen beats a well-argued broken one. So the board sends founders to the box's
          own chat again, on its own screen, which is what they used before and what they know works.

          The in-studio one failed for a dull reason worth recording: the route needs
          COMPOSER_API_KEY_<VENTURE> on the studio, and that variable was never set on Railway. It
          only ever ran against a local .env, so every production press returned an error. The key is
          set now, which is why this is a preference about surfaces rather than a workaround.

          Opens in a new tab deliberately: it is a different application on a different host, and
          replacing the board with it is exactly the "no way back" problem FB-065 named. A new tab
          leaves the studio where the founder left it. */}
      {venture.chatUrl ? (
        <a
          className="btn btn-primary"
          href={venture.chatUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="venture-chat-link"
          style={{ marginTop: '0.25rem' }}
        >
          Tell the studio what you want
        </a>
      ) : (
        <p className="card muted" data-testid="venture-chat-pending" style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.25rem' }}>
          Your conversational composer — describe what you want in plain English and it becomes a
          workstream — will appear here once this venture’s box is set up.
        </p>
      )}

      {/* FB-046: external actions awaiting the founder's OK (the ActiveGraph gate). The founder
          approves here — never on github.com; Approve signs the grant the executor verifies. */}
      {pendingApprovals.length > 0 ? (
        <div data-testid="approvals-queue" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Needs your OK — before anything goes out</p>
          {pendingApprovals.map((a) => (
            <ApprovalCard key={`${a.repo}/${a.id}`} ventureId={venture.id} approval={a} history={histories[`${a.repo}/${a.id}`]} />
          ))}
        </div>
      ) : null}

      {decided.length > 0 ? (
        <div data-testid="approvals-decided" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Decided — what happened next</p>
          {decided.map((a) => (
            <ApprovalCard key={`${a.repo}/${a.id}`} ventureId={venture.id} approval={a} history={histories[`${a.repo}/${a.id}`]} />
          ))}
        </div>
      ) : null}

      {needsAttention.length > 0 ? (
        <div data-testid="approvals-attention" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Went out, or tried to — needs your eye</p>
          {needsAttention.map((a) => (
            <ApprovalCard key={`${a.repo}/${a.id}`} ventureId={venture.id} approval={a} history={histories[`${a.repo}/${a.id}`]} />
          ))}
        </div>
      ) : null}

      {engine ? <LaneActivity reports={runs} total={runsTotal} engine={engine} hasComposer={venture.hasComposer} /> : null}

      {/* The three founder-owned surfaces (FB-048): Build / Sell / Scale. Each is its own queue with
          its own approval gate — so product-building, selling, and scaling are managed separately. */}
      {departments.length > 0 ? (
        <div data-testid="dept-surfaces" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Your surfaces</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '0.75rem' }}>
            {departments.map((d) => {
              const budget = budgets[departments.indexOf(d)] ?? null;
              return (
              // The "coming" fade is applied to the HEADER only, not the whole card: compositing the
              // budget line at 0.7 drops muted text to ~2.8:1, under WCAG AA, and a budget figure is
              // not something to render at reduced contrast.
              <div key={d.id} className="card" data-testid={`dept-${d.id}`}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', opacity: d.provisioned ? 1 : 0.7 }}>
                  <strong style={{ fontSize: 'var(--fs-subhead)' }}>{d.name}</strong>
                  <span className={`tag ${d.provisioned ? 'tag-accent' : ''}`} data-testid={`dept-${d.id}-state`}>
                    {d.provisioned ? 'active' : 'coming'}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.35rem 0 0' }}>
                  {d.provisioned
                    // Not `mono`: this is an explanation, and the code face made it read as a
                    // value the founder was supposed to recognise rather than as a sentence.
                    ? <>{GATE_LABEL[d.gate] ?? `How work here gets approved is still being decided.`}</>
                    : <>Set up when this venture’s <span className="mono">{d.repo}</span> repo is provisioned.</>}
                </p>
                {/* One string owner: `describe` returns a whole sentence, so the view adds no
                    prefix of its own — "Budget no budget set" came from gluing a word onto a
                    fragment. The sentence names whose figure it is, so no glyph or sr-only twin is
                    needed to carry state that the words already carry. */}
                <p
                  className={budget?.overLimit ? undefined : 'muted'}
                  data-testid={`dept-${d.id}-budget`}
                  data-budget-over={budget?.overLimit ? 'true' : 'false'}
                  style={{
                    fontSize: 'var(--fs-body-sm)',
                    margin: '0.35rem 0 0',
                    color: budgetTone(budget).color,
                    fontWeight: budgetTone(budget).weight,
                  }}
                >
                  {describeBudget(budget, d.name)}{' '}
                  {/* FB-068: the provenance moves here with the position. FB-054's reasoning is
                      unchanged — the studio owns the limit and does NOT own the spend, and dressing
                      an unverifiable figure as a verdict is what three review passes punished. It
                      belongs where the figure is stated, once, not on every card. */}
                  <span className="muted">Limit set in the studio; spend as reported by the venture.</span>
                </p>
              </div>
              );
            })}
          </div>
          {budgetsError ? (
            <p className="card" data-testid="budgets-error" style={{ borderColor: toneColor('blocked'), color: toneColor('blocked'), fontSize: 'var(--fs-body-sm)', marginTop: '0.6rem' }}>
              ⚠ {budgets.some(Boolean)
                ? <>Part of your budgets file was rejected, so those departments have no limit while the rest still report normally: {budgetsError}.</>
                : <>Your budgets file couldn&rsquo;t be read, so no limits are set: {budgetsError}.</>}
            </p>
          ) : null}
          {orphanEnvelopes.length > 0 ? (
            <p className="card muted" data-testid="budgets-orphans" style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.6rem' }}>
              ⚠ Budget{orphanEnvelopes.length === 1 ? '' : 's'} set for{' '}
              <span className="mono">{orphanEnvelopes.join(', ')}</span>, which {orphanEnvelopes.length === 1 ? 'is not a department' : 'are not departments'} of this
              venture — so {orphanEnvelopes.length === 1 ? 'it is' : 'they are'} enforcing nothing. Check the spelling against your surfaces above.
            </p>
          ) : null}
        </div>
      ) : null}
      <hr className="hr" />

      {lanes.map((lane) => (
        <div key={lane.repo} style={{ marginBottom: '2.5rem' }} data-testid={`lane-${lane.repo}`}>
          <h3 className="mono" style={{ fontSize: 'var(--fs-subhead)' }}>
            {lane.repo} <span className="muted">· {lane.total} ticket{lane.total === 1 ? '' : 's'}</span>
            {stale.has(lane.repo) ? (
              <span
                className="tag"
                data-testid={`lane-stale-${lane.repo}`}
                tabIndex={0}
                title="Nothing has been built or changed here for over two weeks. That may be fine — it is only worth a look if you expected something to be happening."
                style={{ marginLeft: '0.4rem', color: toneColor('attention') }}
              >
                <span aria-hidden="true">⚠ </span>nothing here lately
              </span>
            ) : null}
            {lane.skipped > 0 ? (
              <span className="muted" data-testid={`lane-skipped-${lane.repo}`} tabIndex={0} title="Files in the tickets folder that are not tickets — a README, for example. They are ignored rather than shown as work.">
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
            /* FB-066: what would fill this, then how it starts. "No tickets yet" is true and
               useless — a founder cannot tell from it whether they are waiting, whether something
               broke, or whether they were meant to do something first. */
            <div className="card" data-testid="lane-empty">
              <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>{emptyPanel('tickets', venture.hasComposer).what}</p>
              <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
                {emptyPanel('tickets', venture.hasComposer).how}
              </p>
              <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0' }}>
                Reading <span className="mono">{lane.ref}</span> — a backlog on another branch will not show here.
              </p>
            </div>
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
