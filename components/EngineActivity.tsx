import { emptyPanel } from '@/lib/firstrun';
import type { RunReport } from '@/lib/runreports';
import Link from 'next/link';
import { collapseRepeats, describeRun, repeatClause } from '@/lib/runreports';
import { ago } from '@/lib/when';
import { type Tone } from '@/lib/status';
import { ReleasePlanButton } from './ReleasePlanButton';

/**
 * What your team did (FB-042, rebuilt as its own section in FB-203, item 9).
 *
 * ## The heading is not the design's
 *
 * Item 9 calls this section **"What the engine did"**. It says *"What your team did"*, and that is a
 * rule rather than a preference. FB-103 found the studio calling one thing four names — "the lane",
 * "the agent", "the engine", and its product name — and settled on the one a founder can read;
 * `copy-lint` fails the build on the other three, and CLAUDE.md #12 binds every word rendered here.
 *
 * It is also the truer sentence. The paragraph directly beneath already says *"Your team has not
 * checked in for 48 days"* — heading a section "the engine" and then talking about "your team"
 * inside it is the exact split FB-103 existed to close.
 *
 * The lanes have written a RunReport after every wake since FB-040 and nothing rendered one, so a
 * founder had no way to know their engine had given up on a ticket three attempts ago — or that it
 * was running at all. This is the surface non-negotiable 10 is about.
 *
 * ## What item 9 changed
 *
 * It was a stack of bordered cards sitting under an all-caps label, doing two jobs at once: saying
 * what each surface is doing *now*, and saying what the engine has *done*. The first of those is the
 * ledger beside the office (`OfficeLedger`), and the design's complaint is that production collapsed
 * both into one card list where neither was legible.
 *
 * So this is now a section of its own, under a rule, with a heading that says what it is. Each run
 * is a row: when, a square in its outcome's colour, and the sentence. Gone with the cards:
 *
 *   - **The raw ISO timestamp.** `2026-07-22T18:00:00Z` is a fact about a clock. The question is how
 *     long ago, and the footer the design asks for is what makes a relative time honest here — it
 *     says out loud that the desk re-reads itself while work is in flight, which `WhileWorking` does,
 *     once a minute, only while something is being worked and only while the tab is visible.
 *   - **The `×20` repeat tag.** `collapseRepeats` still merges repeats — that is what keeps fifteen
 *     copies of one sentence out of four slots — and the count is said in words in the row instead.
 *
 *     Dropping it outright, which is what item 8 asks for, was wrong, and production is what showed
 *     that: ARCA has **3,459 runs and they are all the same park**, so the whole section collapsed to
 *     one row reading *"Stopped on ARCA-061 … parked until tomorrow"* under a footer saying "Showing
 *     the 1 most recent of 3459 runs". A founder reading that has no way to know their venture has
 *     been stuck in one place for seven weeks — which is the single most important thing this
 *     section could tell them, and exactly what non-negotiable 10 exists for. The tag was the
 *     studio showing its working; the fact underneath it was not.
 *   - **The venture tag.** On one venture's own desk, a tag that says `ARCA` on every row says
 *     nothing at all.
 *
 * The sentences still come from `describeRun`, not from here.
 */

/**
 * How many runs the desk shows (FB-178).
 *
 * The design's own line is "Showing the 4 most recent of 31 runs". This showed twenty, each roughly
 * 131px against the design's 48, so the panel alone was 2,621px — and on ARCA most of those rows
 * were the same sentence repeated. The full history is one press away on What happened, which is
 * the screen for it.
 */
const DESK_RUNS = 4;

export function EngineActivity({
  reports,
  total,
  engine,
  hasComposer = true,
  ventureId,
}: {
  reports: RunReport[];
  total: number;
  engine: { state: string; text: string };
  /** FB-066: a venture with no box has no composer to be told, so the empty state offers no action. */
  hasComposer?: boolean;
  /**
   * FB-122: needed only to release a held plan. Optional so every existing caller and test keeps
   * working; without it the report still renders, it just cannot be answered — which is exactly the
   * state this feature exists to end, so it is passed everywhere it can be.
   */
  ventureId?: string;
}) {
  const engineTone: Tone = engine.state === 'stalled' ? 'blocked' : engine.state === 'unknown' ? 'idle' : 'working';

  // Collapse BEFORE slicing, so fifteen copies of "parked until tomorrow" become one row and the
  // other three slots go to things the founder has not already read. Slicing first would spend all
  // four on the same sentence.
  const shown = collapseRepeats(reports).slice(0, DESK_RUNS);

  // The `id` is FB-104's anchor: the stuck-ticket row at the top of the desk links down here,
  // because this is where each run's own account of itself is printed — the one place that sentence
  // can honestly be expanded.
  //
  // The testid stays `lane-activity`. It is a handle for tests, not a word a founder reads, and
  // renaming it would churn four spec files to say the same thing.
  return (
    <section
      id="what-your-team-is-doing"
      data-testid="lane-activity"
      className="engine-section"
      aria-label="What your team did"
    >
      <div className="engine-head">
        <h2>What your team did</h2>
        <span className="engine-sub">every wake writes a report; nothing is swallowed</span>
      </div>

      <p
        className={`engine-state engine-state-${engineTone}`}
        data-testid="engine-state"
        data-engine-state={engine.state}
      >
        <span className="engine-dot" aria-hidden="true" />
        {engine.state === 'stalled' ? <span className="sr-only">Stopped: </span> : null}
        {engine.text}
      </p>

      {shown.length === 0 ? (
        /* FB-066: name what would fill it, then say what starts it. */
        <div data-testid="lane-activity-empty" className="engine-empty">
          <p>{emptyPanel('runs', hasComposer).what}</p>
          <p className="muted">{emptyPanel('runs', hasComposer).how}</p>
        </div>
      ) : (
        <ol data-testid="lane-activity-list" className="engine-runs">
          {shown.map((r, i) => {
            const tone = runTone(r);
            const when = ago(r.endedAt ?? r.startedAt);
            return (
              <li
                key={`${r.repo}/${r.startedAt}/${i}`}
                className="engine-run"
                data-testid={`run-${r.laneId}-${i}`}
                data-outcome={r.outcome ?? 'in-flight'}
              >
                <span className="engine-run-when mono">{when ?? '—'}</span>
                <span className={`engine-run-mark tone-${tone}`} aria-hidden="true" />
                <span className="engine-run-body">
                  <span className="sr-only">{OUTCOME_LABEL[r.outcome ?? 'in-flight']}: </span>
                  {describeRun(r)}
                  {/* Said once, in words, never printed 3,461 times — and never overstating what
                      the studio actually looked at. See `repeatClause`. */}
                  {r.repeats > 1 ? (
                    <span className="engine-run-repeats" data-testid={`run-${r.laneId}-${i}-repeats`}>
                      {' · '}{repeatClause(r.repeats, reports.length, total)}
                    </span>
                  ) : null}
                  {r.prUrl ? (
                    <>
                      {' · '}
                      <a href={r.prUrl} data-testid={`run-${r.laneId}-${i}-pr`}>the work itself</a>
                    </>
                  ) : null}
                  {/* FB-122: the one run outcome that is a question rather than a statement. The lane
                      read the ticket, wrote what it would do, and stopped — and before this there was
                      no way to answer it from anywhere. The heartbeat is excluded: it reports that the
                      QUEUE is held, which is not one plan anyone can say yes to. */}
                  {r.outcome === 'awaiting-approval' && !r.isHeartbeat && ventureId && r.ticketsTouched[0] ? (
                    <ReleasePlanButton
                      ventureId={ventureId}
                      repo={r.repo}
                      ticket={r.ticketsTouched[0]}
                      testId={`run-${r.laneId}-${i}-release`}
                    />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {total > shown.length ? (
        <p className="muted engine-foot" data-testid="lane-activity-more">
          Showing the {shown.length} most recent of {count(total)} runs ·{' '}
          {ventureId ? <Link href={`/venture/${ventureId}/activity`}>What happened</Link> : null}
          {/* True as written, and only as written: `WhileWorking` polls once a minute, only while a
              run is actually in flight, and only while the tab is visible. */}
          {' · '}this desk re-reads itself once a minute while something is being worked
        </p>
      ) : null}
    </section>
  );
}

/**
 * A count a person can read at a glance.
 *
 * `3459` is a string of digits somebody has to parse; `3,459` is a number. It matters most exactly
 * where the numbers are largest, which is where this section is least readable without it.
 */
const count = (n: number) => n.toLocaleString('en-GB');

function runTone(r: RunReport): Tone {
  switch (r.outcome) {
    case 'blocked':
    case 'error':
      return 'blocked';
    case 'awaiting-approval':
      return 'attention';
    case null:
      return 'working';
    case 'no-useful-work':
      return 'idle';
    default:
      return 'ok';
  }
}

const OUTCOME_LABEL: Record<string, string> = {
  'in-flight': 'Running',
  'opened-pr': 'Done',
  'awaiting-approval': 'Needs you',
  blocked: 'Stopped',
  error: 'Failed',
  'no-useful-work': 'Nothing to do',
  progress: 'Done',
};
