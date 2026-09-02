import { emptyPanel } from '@/lib/firstrun';
import { TEAM_TITLE } from '@/lib/glossary';
import type { RunReport } from '@/lib/runreports';
import Link from 'next/link';
import { collapseRepeats, describeRun } from '@/lib/runreports';
import { toneColor, type Tone } from '@/lib/status';
import { ReleasePlanButton } from './ReleasePlanButton';

/**
 * What the agent lanes have actually been doing (FB-042).
 *
 * The lanes have written a RunReport after every wake since FB-040 and nothing rendered one, so a
 * founder had no way to know their engine had given up on a ticket three attempts ago — or that it
 * was running at all. This is the surface non-negotiable 10 is about.
 *
 * The sentences come from `describeRun`, not from here: the same run is summarised in the brief at
 * the top of the page, and two renderings of one fact drift.
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

export function LaneActivity({
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

  // The `id` is FB-104's anchor: the brief's sentences about the team link down here, because this is
  // where each run's own account of itself is printed — the one place those sentences can honestly
  // be expanded.
  return (
    <section id="what-your-team-is-doing" data-testid="lane-activity" style={{ marginTop: '1.25rem' }} aria-label="What your team has been doing">
      {/* FB-103 introduced "your team" here; FB-104 moved the introduction up to the board header,
          because the brief above this panel uses the name first. The introduction printed in both
          places, and a page that explains the same thing twice reads as padding (FB-063). */}
      <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>{TEAM_TITLE} — what has been happening</p>

      <p
        data-testid="engine-state"
        data-engine-state={engine.state}
        style={{
          fontSize: 'var(--fs-body-sm)',
          margin: '0 0 0.6rem',
          color: engineTone === 'blocked' ? toneColor('blocked') : undefined,
          fontWeight: engineTone === 'blocked' ? 600 : undefined,
        }}
      >
        {engine.state === 'stalled' ? (
          <>
            <span aria-hidden="true">▲ </span>
            <span className="sr-only">Stopped: </span>
          </>
        ) : null}
        {engine.text}
      </p>

      {shown.length === 0 ? (
        /* FB-066: name what would fill it, then say what starts it. */
        <div className="card" data-testid="lane-activity-empty">
          <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>{emptyPanel('runs', hasComposer).what}</p>
          <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
            {emptyPanel('runs', hasComposer).how}
          </p>
        </div>
      ) : (
        <ol data-testid="lane-activity-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {shown.map((r, i) => {
            const tone = runTone(r);
            return (
              <li
                key={`${r.repo}/${r.startedAt}/${i}`}
                className="card"
                data-testid={`run-${r.laneId}-${i}`}
                data-outcome={r.outcome ?? 'in-flight'}
                style={{ marginBottom: '0.5rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
                  <span
                    style={{
                      // Shrink rather than push the tag off the screen.
                      minWidth: 0,
                      fontSize: 'var(--fs-body-sm)',
                      color: tone === 'blocked' ? toneColor('blocked') : undefined,
                      fontWeight: tone === 'blocked' ? 600 : undefined,
                    }}
                  >
                    <span className="sr-only">{OUTCOME_LABEL[r.outcome ?? 'in-flight']}: </span>
                    {describeRun(r)}
                  </span>
                  {/* Said once with a count, never printed fifteen times (FB-178). */}
                  {r.repeats > 1 ? (
                    <span className="tag" data-testid={`run-${r.laneId}-${i}-repeats`} style={{ flexShrink: 0 }}>
                      ×{r.repeats}
                    </span>
                  ) : null}
                  <span className="tag" style={{ flexShrink: 0 }} data-testid={`run-${r.laneId}-${i}-lane`}>{r.laneId}</span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0.3rem 0 0' }}>
                  {/* Rendered as the recorded ISO string rather than a relative time: a "3 hours ago"
                      computed on the server is wrong the moment the page is cached, and this is the
                      surface a founder checks precisely when they distrust what they are seeing. */}
                  {r.endedAt ?? r.startedAt}
                  {r.prUrl ? (
                    <>
                      {' · '}
                      <a href={r.prUrl} data-testid={`run-${r.laneId}-${i}-pr`}>the work itself</a>
                    </>
                  ) : null}
                </p>
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
              </li>
            );
          })}
        </ol>
      )}

      {total > shown.length ? (
        <p className="muted" data-testid="lane-activity-more" style={{ fontSize: 'var(--fs-meta)' }}>
          Showing the {shown.length} most recent of {total} runs.{' '}
          {ventureId ? <Link href={`/venture/${ventureId}/activity`}>What happened</Link> : null}
        </p>
      ) : null}
    </section>
  );
}

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
