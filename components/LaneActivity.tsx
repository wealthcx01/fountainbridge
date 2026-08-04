import { emptyPanel } from '@/lib/firstrun';
import { TEAM_INTRO, TEAM_TITLE } from '@/lib/glossary';
import type { RunReport } from '@/lib/runreports';
import { describeRun } from '@/lib/runreports';
import { toneColor, type Tone } from '@/lib/status';

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
export function LaneActivity({
  reports,
  total,
  engine,
  hasComposer = true,
}: {
  reports: RunReport[];
  total: number;
  engine: { state: string; text: string };
  /** FB-066: a venture with no box has no composer to be told, so the empty state offers no action. */
  hasComposer?: boolean;
}) {
  const engineTone: Tone = engine.state === 'stalled' ? 'blocked' : engine.state === 'unknown' ? 'idle' : 'working';

  return (
    <section data-testid="lane-activity" style={{ marginTop: '1.25rem' }} aria-label="What your team has been doing">
      {/* FB-103: one name for the working machinery, introduced where the founder first meets it.
          This panel is that place — it is the only surface that says what the team IS, and every
          other surface then says "your team" without explaining itself again. */}
      <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>{TEAM_TITLE} — what has been happening</p>
      <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0 0 0.5rem' }}>{TEAM_INTRO}</p>

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

      {reports.length === 0 ? (
        /* FB-066: name what would fill it, then say what starts it. */
        <div className="card" data-testid="lane-activity-empty">
          <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>{emptyPanel('runs', hasComposer).what}</p>
          <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
            {emptyPanel('runs', hasComposer).how}
          </p>
        </div>
      ) : (
        <ol data-testid="lane-activity-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {reports.map((r, i) => {
            const tone = runTone(r);
            return (
              <li
                key={`${r.repo}/${r.startedAt}/${i}`}
                className="card"
                data-testid={`run-${r.laneId}-${i}`}
                data-outcome={r.outcome ?? 'in-flight'}
                style={{ marginBottom: '0.5rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: 'var(--fs-body-sm)',
                      color: tone === 'blocked' ? toneColor('blocked') : undefined,
                      fontWeight: tone === 'blocked' ? 600 : undefined,
                    }}
                  >
                    <span className="sr-only">{OUTCOME_LABEL[r.outcome ?? 'in-flight']}: </span>
                    {describeRun(r)}
                  </span>
                  <span className="tag" data-testid={`run-${r.laneId}-${i}-lane`}>{r.laneId}</span>
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
              </li>
            );
          })}
        </ol>
      )}

      {total > reports.length ? (
        <p className="muted" data-testid="lane-activity-more" style={{ fontSize: 'var(--fs-meta)' }}>
          Showing the {reports.length} most recent of {total} runs.
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
