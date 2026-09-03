'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
// Type-only imports: lib/tickets pulls in node:fs / the GitHub client, which must never reach the
// client bundle. `import type` is erased at build, so only the shapes cross the boundary.
import type { LaneTickets, TicketStatusGroup, TicketWithMeta } from '@/lib/tickets';
import type { DepartmentSummary } from '@/lib/ventures';
import type { ActiveGraphApproval } from '@/lib/approvals';
import type { PrApproval } from '@/lib/attention';
import { describe as describeBudget, type BudgetDisclosure } from '@/lib/budgets';
import { STATUS_LABEL, TEAM_INTRO, TEAM_TITLE } from '@/lib/glossary';
import { ago } from '@/lib/when';
import { emptyPanel } from '@/lib/firstrun';
import { laneErrorTone, toneColor } from '@/lib/status';
import { ticketProgress } from '@/lib/ticket-progress';
import { isUnnumbered } from '@/lib/ticket-ids';
import { ApprovalCard, type ApprovalHistory } from './ApprovalCard';
import { FounderBrief } from './FounderBrief';
import { BlockerBanner, DegradedStrip, DeskSummary } from './DeskHeader';
import { OfficePlate } from './OfficePlate';
import type { Office } from '@/lib/office';
import { lastSend, outboxUrl } from '@/lib/sends';
import { WaitingQueue, externalWaitingItem, prWaitingItem } from './WaitingQueue';
import { PromptBar } from './PromptBar';
import { surfaceOutcome, type DegradedGroup } from '@/lib/desk';
import { LaneActivity } from './LaneActivity';
import { WhileWorking } from './WhileWorking';
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
  // FB-120: first, because it is the earliest thing that can be true of a piece of work — the founder
  // has approved it and nobody has picked it up. The column is omitted entirely when empty (below);
  // a permanently empty first column would be a worse first impression than no column at all.
  { key: 'filed', label: STATUS_LABEL.filed },
  { key: 'todo', label: STATUS_LABEL.todo },
  { key: 'in-progress', label: STATUS_LABEL['in-progress'] },
  { key: 'pr-open', label: STATUS_LABEL['pr-open'] },
  { key: 'done', label: STATUS_LABEL.done },
];

interface Selected {
  repo: string;
  ref: string;
  item: TicketWithMeta;
  /** The column it was opened from — the drawer must agree with the board about where it sits. */
  group: TicketStatusGroup;
}

// FB-021: present each read-failure state so a founder can tell "not set up yet" from "broken".
// Setup states read `attention` (a next step, not a crash); an unexpected fault reads `blocked`.
// FB-057 moved the tone decision itself into lib/status.ts — the studio has one status vocabulary,
// and a component that keeps its own private one is how the patchwork starts.
type LaneErrorKind = LaneTickets['errorKind'];

function laneErrorNextStep(kind: LaneErrorKind): string | null {
  switch (kind) {
    // FB-103: the founder's sentence first \u2014 it tells them who has to act, which is the only thing
    // they can do anything with. The instruction that follows is for whoever fixes it, and it stays
    // exact: FB-021 built these states so a person could act on them, and "something is misconfigured"
    // is a diagnosis nobody can act on.
    case 'no-credentials':
      // copy-lint-ok: the bracketed half is the repair instruction for Bruntsfield, labelled as such
      return 'Bruntsfield connects the studio to this venture\u2019s records so it can see the work. (For Bruntsfield: install the Foundry GitHub App, or set a read token.)';
    case 'unreadable':
      // copy-lint-ok: the bracketed half is the repair instruction for Bruntsfield, labelled as such
      return 'Bruntsfield gives the studio read access to this venture\u2019s records \u2014 or checks the name it was given is right. (For Bruntsfield: install or scope the Foundry GitHub App, or the read token, for this repository.)';
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
  summary = null,
  blocker = null,
  degraded = [],
  runs = [],
  runsTotal = 0,
  engine = null,
  office,
  orphanEnvelopes = [],
  staleRepos = [],
  totalWarnings,
  fetchedAt,
  org,
  openWork = {},
  openWorkQueue = [],
  filedRefs = {},
  unmatchedWork = {},
  viewerIsFounder = false,
  wiringWarning = null,
}: {
  venture: {
    id: string; name: string; status: string; founderName: string | null; hasComposer: boolean;
    /** The box's own chat, on its own screen (FB-086). Null until the venture has a box. */
    chatUrl: string | null;
    /** The venture's own Workspace address — the outbox the Sell surface links to (FB-142). */
    founderEmail?: string | null;
  };
  lanes: LaneTickets[];
  departments?: DepartmentSummary[];
  approvals?: ActiveGraphApproval[];
  /** The ActiveGraph story per approval, keyed `repo/id` (FB-071). Narrated server-side. */
  histories?: Record<string, ApprovalHistory>;
  budgets?: (BudgetDisclosure | null)[];
  /** Finished work waiting to be read, newest-waiting first — the desk's section 7 (FB-128). */
  openWorkQueue?: PrApproval[];
  /** The venture in a paragraph (FB-042) — composed server-side so the ordering has one owner. */
  brief?: Brief | null;
  /** The desk's one sentence (FB-128). Composed server-side from the same count the banner uses. */
  summary?: string | null;
  /** The amber banner's line, or null when nothing waits. Never assembled here — see `lib/desk.ts`. */
  blocker?: string | null;
  /** What could not be read, grouped by cause (FB-128). Empty when every read succeeded. */
  degraded?: DegradedGroup[];
  /** What the agent lanes did, newest first (FB-042). */
  runs?: RunReport[];
  runsTotal?: number;
  /** `ageMinutes` since FB-098: a card can only say "picked up 12 minutes ago; last checked in 2
   *  minutes ago" if the real check-in travels with the state. */
  engine?: { state: string; text: string; ageMinutes: number | null } | null;
  /**
   * The office, built server-side (FB-139).
   *
   * One array, mapped twice — into the plate and into the ledger — so the design's constraint ("same
   * events, so they cannot disagree") holds because there is nothing to disagree with.
   */
  office: Office;
  /** Non-null when the venture's budgets file exists but could not be read (FB-054). */
  budgetsError?: string | null;
  /** Envelopes keyed to departments this venture does not declare — configured but enforcing nothing. */
  orphanEnvelopes?: string[];
  staleRepos?: string[];
  totalWarnings: number;
  fetchedAt: number;
  org: string;
  /**
   * The work waiting on each ticket, keyed `"<repo> <id>"` — the same key the status inference uses
   * (FB-105). So the drawer's Accept button and the column the card sits in are the same fact.
   */
  openWork?: Record<string, { repo: string; number: number }>;
  /** Where a filed ticket lives, keyed `<repo> <ticketId>` — its own branch, not the default
   *  one. The drawer builds a GitHub link from the ref it is given, and the default branch is
   *  the one branch a filed ticket is provably not on (FB-120). */
  filedRefs?: Record<string, { branch: string; prNumber: number; prUrl: string }>;
  /**
   * Open work this venture has that matches no ticket, by repo (FB-099).
   *
   * It has to appear SOMEWHERE. The badge counts every open piece of work; the columns counted
   * tickets. Anything the matcher cannot place used to fall between the two, which is how "Needs
   * you — 15" sat six centimetres from a column reading 0.
   */
  unmatchedWork?: Record<string, Array<{ number: number; title: string }>>;
  /** True when the person reading this IS the venture's named founder (FB-100's item 7). */
  viewerIsFounder?: boolean;
  /** FB-087: admin-only — this venture has a box the studio cannot reach. Null for founders. */
  wiringWarning?: string | null;
}) {
  const pendingApprovals = approvals.filter((a) => a.status === 'proposed');
  // FB-142: the venture's own Workspace sent view, for the Sell surface's reference link.
  const outbox = outboxUrl(venture.founderEmail ?? null);
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
  // FB-109: which surface the founder is looking at, if any. Deliberately not routed and not
  // persisted — a filter that survives reload is navigation, and navigation is a bigger decision
  // than this ticket makes.
  const [surface, setSurface] = useState<string | null>(null);
  const stale = new Set(staleRepos);

  // The board showed the same three-way split twice and never joined them: cards named Build / Sell
  // / Scale, and lanes headed `arca`, `arca-marketing`, `arca-ops`. The mapping was in the manifest
  // the whole time and the studio kept it to itself.
  const surfaceOf = (repo: string) => departments.find((d) => d.repo === repo) ?? null;
  const selectedRepo = surface ? (departments.find((d) => d.id === surface)?.repo ?? null) : null;
  /** The queue behind a surface, when the venture has one for that repository. */
  const laneOf = (repo: string | null | undefined) => (repo ? lanes.find((l) => l.repo === repo) ?? null : null);
  /**
   * A queue no surface claims (FB-186).
   *
   * `departments` is optional in the manifest, so a venture can have a repository with a lane and no
   * surface named over it. Folding the queues into the surface cards would have made those
   * disappear, which is the failure mode this whole run of tickets keeps finding: a screen that is
   * correct about everything it shows and silent about what it dropped.
   */
  const orphanLanes = lanes.filter((l) => !departments.some((d) => d.repo === l.repo));

  /**
   * One queue, because a founder has one queue (FB-183).
   *
   * Pull requests waiting on the founder and external sends waiting on the founder are the same
   * question — "what is blocked on me?" — and were two lists on one screen, the second of them 282px
   * of card per item. The design has one, and the send is told apart from the work by its own meta
   * line saying `external send`, not by living somewhere else.
   *
   * Sends first: nothing leaves the company without one of these, and the pull requests behind them
   * are internal.
   */
  const waitingItems = [
    ...pendingApprovals.map((a) => externalWaitingItem(a, venture.id, surfaceOf(a.repo)?.name)),
    ...openWorkQueue.map((a) => prWaitingItem(a, venture.id, surfaceOf(a.repo)?.name)),
  ];

  // Index every ticket by id so dependency chips in the drawer can jump to another ticket.

  // FB-098's live board, affordable since FB-083: poll only while a run is genuinely in flight. The
  // same evidence the cards read from — a run with no outcome yet — so the page cannot poll over
  // work that is not happening.
  const somethingInFlight = runs.some((r) => r.outcome === null);

  return (
    // `desk` is what the phone media query reorders (FB-138). See `app/globals.css`.
    <section className="desk" data-testid="desk">
      <WhileWorking working={somethingInFlight} />
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
            title={`${totalWarnings} ticket${totalWarnings === 1 ? '' : 's'} could not be read completely — some detail is missing from the board, and nothing is lost from your venture’s records.`}
          >
            <span aria-hidden="true">⚠ </span>
            {totalWarnings} ticket{totalWarnings === 1 ? '' : 's'} not fully read
          </span>
        ) : null}
      </div>
      <p className="muted" data-testid="board-founder" style={{ fontSize: 'var(--fs-body-sm)' }}>
        {/* FB-100's item 7: "Founder: John Gallagher" while signed in AS the founder reads as the
            studio introducing someone to themselves. The manifest is right; this is presentation. */}
        {venture.founderName ? <>Founder: {viewerIsFounder ? 'you' : venture.founderName} · </> : null}
        {/* FB-068: "3:05:32 PM" was a clock reading, not an answer to "is this current?". */}
        <span>updated {ago(new Date(fetchedAt).toISOString()) ?? 'just now'}</span> ·{' '}
        <Link href={`/venture/${venture.id}?refresh=1`} className="mono" data-testid="refresh">
          refresh
        </Link>
      </p>

      {/* FB-103: the one introduction of the one name. Every panel below this line says "your team"
          and none of them explains itself — which only works if the name is introduced above the
          first thing that uses it. */}
      <p className="muted" data-testid="team-intro" style={{ fontSize: 'var(--fs-meta-lg)', marginTop: '-0.35rem' }}>
        <strong>{TEAM_TITLE}</strong> — {TEAM_INTRO}
      </p>

      {/* ---- 1. The sentence (FB-128) ------------------------------------------------------------
          Where things stand, in one line, before anything else. Composed server-side from the same
          count the banner and the rail's badge read, so the three cannot disagree. */}
      {summary ? <DeskSummary sentence={summary} /> : null}

      {/* ---- 2. The blocker banner --------------------------------------------------------------
          The founder named as the blocker, in those words. "3 items awaiting review" is a status;
          this is the same fact addressed to the one person who can end it. */}
      <div className="pocket-1">
        <BlockerBanner line={blocker} href={`/venture/${venture.id}#waiting-on-you`} />
      </div>

      {/* FB-042: the brief's own lines — the specifics behind the sentence, each a way in. Kept
          because they link: a summary that states a number a founder then has to go and find is a
          summary that costs them a search. */}
      {brief ? <FounderBrief brief={brief} headline={false} /> : null}

      {/* FB-087. The composer was broken in production for weeks and the only way anyone could find
          out was a founder pressing the button and getting an error. This is the same fact, told to
          the person who can fix it, before that happens. */}
      {wiringWarning ? (
        <p className="card" data-testid="wiring-warning"
           style={{ borderColor: toneColor('blocked'), color: toneColor('blocked'), fontSize: 'var(--fs-body-sm)' }}>
          {wiringWarning}
        </p>
      ) : null}

      {/* ---- 3. What could not be read ----------------------------------------------------------
          BELOW the banner and the brief, deliberately. It reports a condition that clears on its
          own, and a thing that fixes itself must never sit above a thing that does not. */}
      <DegradedStrip groups={degraded} ventureId={venture.id} />

      {/* ---- 4. The prompt bar -------------------------------------------------------------------
          The most important thing a founder does, started from the screen they leave open rather
          than from behind a link. It files nothing: it carries the words to the composer, whose own
          gate is still the only thing that turns them into work. */}
      <div className="pocket-4">
        <PromptBar ventureId={venture.id} ventureName={venture.name} />
      </div>
      {/* Conversational composer entry (FB-025 → in-studio FB-065 → out to the box FB-086 → home
          again FB-102). The full story, because this button has now moved three times and the next
          person deserves the dates: FB-065 put it in-studio (no founder should leave for a
          different-looking product with no way back). FB-086 sent it back out because the in-studio
          route had never worked in production — the key was never set (FB-087) — and a working
          screen beats a well-argued broken one. FB-095 fixed the engine and proved the in-studio
          surface end to end against the live box, at which point the external door's own cost was
          exposed: a second application with a second login guarding the most important button in
          the product (John hit exactly that). FB-086 said "the board is one line away from
          pointing back"; FB-102 is that line. The box's chat stays available below as the
          secondary surface, for whoever wants the full LibreChat screen. */}
      {/* FB-128: no longer a primary button. The prompt bar directly above IS this door, with the
          founder's first sentence already in it — two controls one line apart, both reading "tell
          the studio what you want", is the doubled navigation FB-124 shipped in a different coat.
          The link stays because the composer is a place as well as a box, and because
          `venture-composer-link` is how the board is known to reach it. */}
      <p style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
        <Link href={`/venture/${venture.id}/composer`} data-testid="venture-composer-link">
          Open the whole conversation
        </Link>
      </p>
      {/* FB-106: the corpus a founder has been building and could not see. Beside the composer,
          because the composer is where most of it went in. */}
      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
        <Link href={`/venture/${venture.id}/knowledge`} data-testid="venture-knowledge-link">
          See what your venture knows
        </Link>
      </p>
      {/* FB-047: the scheduler has run since FB-040 with no way in. A page nobody can reach is the
          same as no page, so it goes here — beside the other "what is this venture doing without
          me" link, rather than as a fifth thing in the navigation FB-067 cut down to four. */}
      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
        <Link href={`/venture/${venture.id}/routines`} data-testid="venture-routines-link">
          What happens without you asking
        </Link>
      </p>
      {venture.chatUrl ? (
        <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
          <a
            href={venture.chatUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="venture-chat-external"
          >
            Or open your venture’s full chat in its own tab
          </a>
        </p>
      ) : null}
      {/* ---- 5. The office ----------------------------------------------------------------------
          A placeholder until the venture box reports agent state (FB-139), and it says so. A frozen
          last-known scene would read as a team sitting still. */}
      <div className="pocket-2">
        <OfficePlate office={office} />
      </div>

      {/* ---- 6. What the engine did -------------------------------------------------------------- */}
      {engine ? <LaneActivity reports={runs} total={runsTotal} engine={engine} hasComposer={venture.hasComposer} ventureId={venture.id} /> : null}
      {/* ---- 7. Waiting on you -------------------------------------------------------------------
          Where "Decide now →" lands, so it has to hold the work the banner just counted. The
          external-approval cards alone were not that: on a venture whose waiting items are all open
          pull requests — the common case — the anchor sat above three empty sections and a founder
          was scrolled past the office to nothing. */}
      <section id="waiting-on-you" data-testid="waiting-on-you" className="pocket-3" style={{ marginTop: '1.5rem' }}>
        <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Waiting on you</p>
        <WaitingQueue items={waitingItems} />
      </section>
      {/* FB-183: the external-send cards that used to stand here are rows in "Waiting on you" above,
          and the decision is made on the page each row opens.
          Claude Design's rule is "one decision surface, everywhere else is a pointer to it", and
          this section was 282px of card per send on a page that should be about 1,900px in total.
          It could not become rows until there was somewhere for the rows to point, because
          `ApprovalCard` carried the only approve control in the studio — turning it into a row first
          would have deleted the only way a founder can approve anything leaving their company
          (non-negotiable 4). The page came first; this section went second.
          The desk cannot sign now: every `ApprovalCard` below renders read-only, because `decide`
          defaults to false and only the approval page passes it. */}

      {/* "Decided — what happened next" — kept, against Claude Design's instruction to move it, and
          the reason is worth having on the record.

          The instruction (2026-09-02) was: *"The desk is forward-looking only… the record of what
          left the company is What happened's whole job."* As a layout judgement that is right, and
          this section is 356px of finished business on a forward-looking page.

          But it is not only a record. It is the only place a founder can see whether a COMPLETED
          approval's signature was genuine — `ApprovalCard`'s provenance element distinguishes an
          attested grant from a forged one and from a proposal that changed after it was approved
          (FB-046). What happened lists decisions in prose ("john.gallagher@… approved: …") and
          carries none of that. Removing this section would make a forged grant on a past send
          invisible, which is non-negotiable 4 — a recorded, VERIFIABLE human approval — failing
          quietly.

          Found by the gate: three tests went red, and their own comment says why they exist —
          *"`granted` rendered NOWHERE. A founder clicked Approve on something irreversible and the
          card vanished."*

          So it moves when What happened can carry the attestation, and not before. FB-180 (which is
          rewriting that screen) and FB-183 (which gives an external approval its own page) are where
          that happens. Claude Design has been asked which of the two should hold it. */}

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
      {/* ---- 8. The company, by surface ----------------------------------------------------------
          The three founder-owned surfaces (FB-048): Build / Sell / Scale. Each is its own queue with
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
                {/* FB-186: the surface and its queue, in one card.
                    The desk stated each surface twice — this block of cards, and then a second list
                    underneath repeating the same three names, the same repositories and the same
                    ticket counts in different words. Every figure in both was correct, which is why
                    nothing caught it; the two blocks together were 764px of a page that should come
                    to about 1,900px in total.
                    The lane's own id and its quiet state stay exactly where they were, on the block
                    that holds the surface's heading and its queue — so a founder still selects a
                    surface and sees the others stand back, and nothing that could be reached before
                    has moved. */}
                <div
                  id={`lane-${d.repo}`}
                  data-testid={`lane-${d.repo}`}
                  data-quiet={selectedRepo && selectedRepo !== d.repo ? 'true' : 'false'}
                  style={{
                    opacity: selectedRepo && selectedRepo !== d.repo ? 0.45 : 1,
                    transition: 'opacity var(--dur) var(--ease)',
                  }}
                >
                <h3 style={{ fontSize: 'var(--fs-subhead)', margin: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', opacity: d.provisioned ? 1 : 0.7 }}>
                  {/* A real button, not a card-shaped div: the audit found the surface cards were the
                      most button-shaped objects on the page and the only ones that did nothing. The
                      NAME is the control rather than the whole card, because the card also holds the
                      launch link and a link inside a button is neither. */}
                  {d.repo && lanes.some((l) => l.repo === d.repo) ? (
                    <button
                      type="button"
                      className="surface-name"
                      data-testid={`dept-${d.id}-select`}
                      aria-pressed={surface === d.id}
                      aria-controls={`lane-${d.repo}`}
                      onClick={() => {
                        const next = surface === d.id ? null : d.id;
                        setSurface(next);
                        if (next && d.repo) {
                          document.getElementById(`lane-${d.repo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      style={{ fontSize: 'var(--fs-subhead)', fontWeight: 600 }}
                    >
                      {d.name}
                    </button>
                  ) : (
                    <strong style={{ fontSize: 'var(--fs-subhead)' }}>{d.name}</strong>
                  )}
                  <span className={`tag ${d.provisioned ? 'tag-accent' : ''}`} data-testid={`dept-${d.id}-state`}>
                    {d.provisioned ? 'active' : 'coming'}
                  </span>
                </h3>
                {/* The repository, and whether anything has happened in it lately. Both came off the
                    second list; a founder no longer has to already know that "Build — Product" IS
                    `arca` to connect a surface to its queue, because they are one thing now. */}
                <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0.2rem 0 0' }}>
                  <span className="mono">{d.repo}</span>
                  {stale.has(d.repo ?? '') ? (
                    <span
                      className="tag"
                      data-testid={`lane-stale-${d.repo}`}
                      tabIndex={0}
                      title="Nothing has been built or changed here for over two weeks. That may be fine — it is only worth a look if you expected something to be happening."
                      style={{ marginLeft: '0.4rem', color: toneColor('attention') }}
                    >
                      <span aria-hidden="true">⚠ </span>nothing here lately
                    </span>
                  ) : null}
                </p>
                <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.35rem 0 0' }}>
                  {d.provisioned
                    // Not `mono`: this is an explanation, and the code face made it read as a
                    // value the founder was supposed to recognise rather than as a sentence.
                    ? <>{GATE_LABEL[d.gate] ?? `How work here gets approved is still being decided.`}</>
                    : <>Not open yet. Bruntsfield sets this side of the venture up when you need it.</>}
                </p>
                {/* FB-186: the queue breakdown that stood here is gone.
                    It read "4 waiting for your OK · 14 in progress" — a restatement of the banner at
                    the top of this page and of the list directly above it, per surface. Claude
                    Design ruled exactly this off the queue line on 2026-09-02 (*"restates the queue,
                    which the banner and the Tickets summary already count"*), and the rule was
                    applied to that line and not to this card, two lines above it. FB-109's point —
                    that a card should be worth pressing before it is pressed — is carried by the
                    outcome sentence below, which names the count and what the surface has produced. */}
                {/* FB-128: what this surface has actually produced — the only place a founder learns
                    whether any of it worked. Sourced or silent (docs/decision-surface-outcomes.md):
                    Build's line is true today, Sell has no reporting until FB-142 and says so, and
                    Scale is not connected and says that too. No zero standing in for an unknown. */}
                <p
                  data-testid={`dept-${d.id}-outcome`}
                  style={{ fontSize: 'var(--fs-body-sm)', margin: '0.35rem 0 0' }}
                >
                  {surfaceOutcome({
                    departmentId: d.id,
                    ticketCount: lanes.find((l) => l.repo === d.repo)?.total ?? 0,
                    hasLaunch: Boolean(d.launch),
                    provisioned: d.provisioned,
                    // FB-142: from the sends this venture has already gated. No new read.
                    lastSend: d.id === 'sell' ? lastSend(approvals) : null,
                  })}
                </p>
                {/* The design's "Open your outbox ↗". The studio does not read the mailbox — see
                    lib/sends.ts on why that scope is not taken — so this is the one place a founder
                    can see the message itself. Absent without a workspace address, rather than a
                    link that lands on somebody's personal inbox. */}
                {d.id === 'sell' && outbox ? (
                  <p style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.2rem 0 0' }}>
                    <a href={outbox} target="_blank" rel="noopener noreferrer" data-testid="sell-outbox">
                      Open your outbox ↗
                    </a>
                  </p>
                ) : null}
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
                {/* FB-093: the door to the thing this surface is building. The target comes from the
                    manifest (`launch:` — venture-as-config, never hard-coded here); a new tab for
                    the same reason as the chat button: it is a different application, and replacing
                    the board with it is the "no way back" problem FB-065 named. Only rendered for a
                    provisioned surface — "coming" already explains an unprovisioned one. */}
                {d.provisioned ? (
                  d.launch ? (
                    <a
                      className="btn"
                      href={d.launch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`dept-${d.id}-launch`}
                      style={{ marginTop: '0.6rem' }}
                    >
                      {d.launch.label ?? 'Open'}
                    </a>
                  ) : (
                    <p className="muted" data-testid={`dept-${d.id}-launch-pending`} style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.6rem 0 0' }}>
                      Nowhere to open yet — when this surface has something running (the app, the
                      site, a service), its door appears here.
                    </p>
                  )
                ) : null}

                {/* The queue itself — the second list's only unique content, now where the surface
                    it belongs to is named. Order matters: a read that FAILED is not an empty queue,
                    and an empty queue is not a queue with work in it (non-negotiable 10). */}
                {laneOf(d.repo)?.error ? (
                  <div
                    className="card"
                    data-testid="lane-error"
                    data-error-kind={laneOf(d.repo)?.errorKind ?? 'error'}
                    style={{
                      marginTop: '0.6rem',
                      borderColor: toneColor(laneErrorTone(laneOf(d.repo)?.errorKind ?? null)),
                      color: toneColor(laneErrorTone(laneOf(d.repo)?.errorKind ?? null)),
                    }}
                  >
                    <div>{laneOf(d.repo)?.error}</div>
                    {laneErrorNextStep(laneOf(d.repo)?.errorKind ?? null) ? (
                      <div className="muted" data-testid="lane-error-next" style={{ marginTop: '0.45rem', fontSize: 'var(--fs-meta-lg)' }}>
                        <strong>Next step:</strong> {laneErrorNextStep(laneOf(d.repo)?.errorKind ?? null)}
                      </div>
                    ) : null}
                  </div>
                ) : !laneOf(d.repo) ? null : laneOf(d.repo)!.total === 0 ? (
                  /* FB-066: what would fill this, then how it starts. "No tickets yet" is true and
                     useless — a founder cannot tell from it whether they are waiting, whether
                     something broke, or whether they were meant to do something first. */
                  <div className="card" data-testid="lane-empty" style={{ marginTop: '0.6rem' }}>
                    <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>{emptyPanel('tickets', venture.hasComposer).what}</p>
                    <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
                      {emptyPanel('tickets', venture.hasComposer).how}
                    </p>
                    <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0' }}>
                      This is the only place work for this side of the venture is read from.
                    </p>
                  </div>
                ) : (
                  /* A count and a door, not a breakdown (Claude Design, 2026-09-02): the design's
                     own line is "14 tickets", and what earns the space beside it is an outcome —
                     which the sentence above this one already carries. */
                  /* The door alone. Every branch of `surfaceOutcome` already names the count in the
                     sentence above, so printing it again here was the card saying "73 tickets"
                     twice — the same fault as the two blocks, one level down. */
                  <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0.6rem 0 0' }}>
                    <Link href={`/venture/${venture.id}/tickets`} data-testid={`lane-open-${d.repo}`}>
                      open the queue →
                    </Link>
                  </p>
                )}
                </div>
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
      {/* FB-186: the second list of surfaces that stood here is gone.
          It repeated the three names, the three repositories and the three ticket counts already on
          the cards above, in different words — 139px of restatement plus its rule and its margins,
          on a desk that is meant to be a page a founder reads rather than one they scroll. Every
          figure in it was correct, which is why no test caught it and only looking did.
          Nothing was dropped: the queue link, the stale flag, the read-failure panel and the empty
          panel all moved up into the surface each belongs to, keeping their own ids.
          A lane whose repository no department claims still renders, below. */}
      {orphanLanes.length > 0 ? (
        <div data-testid="lanes-unclaimed" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Other queues</p>
          {orphanLanes.map((lane) => (
            <p key={lane.repo} id={`lane-${lane.repo}`} data-testid={`lane-${lane.repo}`} style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.5rem' }}>
              <span className="mono muted" style={{ fontSize: 'var(--fs-meta)' }}>{lane.repo}</span>{' '}
              <span className="muted">{lane.total} ticket{lane.total === 1 ? '' : 's'}</span>
              {' — '}
              <Link href={`/venture/${venture.id}/tickets`} data-testid={`lane-open-${lane.repo}`}>
                open the queue
              </Link>
            </p>
          ))}
        </div>
      ) : null}

      {/* The ticket drawer that stood here is gone (FB-178).
          Nothing could open it once the desk's board went — `setSelected` was only ever called by a
          ticket card — and an unreachable control is worse than none. It had already been superseded:
          `TicketsView`'s own header reads "The list, the ticket and the decision are one screen.
          Before this the drawer showed a ticket…", and that screen carries the accept, the
          send-back, the dependency chips and the trail. */}
    </section>
  );
}
