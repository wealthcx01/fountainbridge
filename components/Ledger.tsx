import Link from 'next/link';
import { formatMoney } from '@/lib/budgets';
import { howLongMs } from '@/lib/when';
import { rowReason, rowTone, type LedgerRow, type LedgerTone } from '@/lib/ledger';
import { toneColor, type Tone } from '@/lib/status';

/**
 * The admin ledger (FB-136) — every founder's desk in one table.
 *
 * The design's rule is the whole screen: *"a row is amber when its founder is the bottleneck, red
 * when its engine is."* The colouring lives in `lib/ledger.ts` so it can be argued about in a test;
 * this renders it, and renders the words beside it.
 *
 * ## Every colour has a text twin
 *
 * The design contract's rule, and here it is also the more useful half: "amber" does not say which
 * of six decisions is the old one. `rowReason` says it.
 */

/** The ledger's five states, mapped onto the shared tone vocabulary rather than colours of its own. */
const TONE: Record<LedgerTone, Tone | null> = {
  unknown: 'idle',
  blocked: 'blocked',
  attention: 'attention',
  ok: 'ok',
  idle: null,
};

const TONE_LABEL: Record<LedgerTone, string> = {
  unknown: 'not known',
  blocked: 'needs fixing',
  attention: 'waiting on its founder',
  ok: 'moving',
  idle: 'quiet',
};

export function Ledger({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="table-scroll">
      <table className="records" data-testid="ledger-table">
        <thead>
          <tr>
            <th scope="col">Venture</th>
            <th scope="col">Founder</th>
            <th scope="col">Needs them</th>
            <th scope="col">Underway</th>
            <th scope="col">Engine</th>
            <th scope="col">Spend, month</th>
            <th scope="col"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LedgerRowView key={row.ventureId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerRowView({ row }: { row: LedgerRow }) {
  const tone = rowTone(row);
  const colour = TONE[tone];

  return (
    <tr data-testid={`ledger-row-${row.ventureId}`} data-tone={tone}>
      <td>
        <span aria-hidden="true" style={{
          display: 'inline-block', width: '0.5rem', height: '0.5rem', borderRadius: '50%',
          marginRight: '0.45rem',
          background: colour ? toneColor(colour) : 'var(--color-border-strong)',
        }} />
        <strong>{row.name}</strong>
        {/* The colour, in words. State carried only by a colour is state a screen-reader user does
            not get — and "amber" does not say which of six decisions is the old one. */}
        <span className="muted" data-testid={`ledger-why-${row.ventureId}`}
              style={{ display: 'block', fontSize: 'var(--fs-meta)', marginLeft: '0.95rem' }}>
          <span className="sr-only">{TONE_LABEL[tone]}. </span>{rowReason(row)}
        </span>
      </td>
      <td>{row.founderName ?? <Absent />}</td>
      <td data-testid={`ledger-needs-${row.ventureId}`}>{row.needsThem ?? <Absent />}</td>
      <td>{row.underway ?? <Absent />}</td>
      {/* The engine's own sentence, whatever it says. "Nobody has run here yet" is a fact this
          studio owns and a founder needs; only a read that FAILED is a dash. */}
      <td data-testid={`ledger-engine-${row.ventureId}`}
          style={{ color: row.engine?.state === 'stalled' ? toneColor('blocked') : undefined }}>
        {row.engine ? row.engine.text : <Absent />}
      </td>
      <td data-testid={`ledger-spend-${row.ventureId}`}
          style={{ color: row.spend?.over ? toneColor('blocked') : undefined }}>
        {row.spend ? (
          <>
            {formatMoney(row.spend.spentMinor, row.spend.currency)}
            <span className="muted">/{formatMoney(row.spend.limitMinor, row.spend.currency)}</span>
          </>
        ) : (
          // Not "£0": a venture with no envelope set and a venture that has spent nothing are
          // different facts, and `lib/budgets.ts` exists to keep them apart.
          <span className="muted">not set</span>
        )}
      </td>
      <td>
        <Link href={`/venture/${row.ventureId}`} data-testid={`ledger-open-${row.ventureId}`}>
          Open as founder →
        </Link>
      </td>
    </tr>
  );
}

/** The row before its numbers are in. Nothing on it is a claim about the venture. */
export function LedgerRowWaiting({ ventureId, name }: { ventureId: string; name: string }) {
  return (
    <tr data-testid={`ledger-waiting-${ventureId}`}>
      <td><strong>{name}</strong></td>
      <td colSpan={6} className="muted" style={{ fontSize: 'var(--fs-meta)' }}>
        Reading this venture&rsquo;s records&hellip;
      </td>
    </tr>
  );
}

/** A fact the studio does not hold. A dash to the eye, a word to a screen reader. */
function Absent() {
  return (
    <>
      <span aria-hidden="true" className="muted">—</span>
      <span className="sr-only">not recorded</span>
    </>
  );
}

/**
 * How long the queue has been waiting, right now.
 *
 * **Not response time**, which the design asks for and the studio cannot answer: nothing records
 * when something *started* needing a founder. Named for what it measures — see `waitingNow` in
 * `lib/ledger.ts`, and FB-159.
 */
export function WaitingNote({ waiting }: { waiting: { count: number; medianMs: number } | null }) {
  return (
    <div data-testid="ledger-waiting-note">
      <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>Waiting now</p>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        {waiting
          ? `${waiting.count} thing${waiting.count === 1 ? '' : 's'} waiting on founders, the middle one for ${howLongMs(waiting.medianMs)}.`
          : 'Nothing is waiting on a founder right now.'}{' '}
        How long a decision <em>took</em> is not recorded anywhere yet, so this says what is waiting
        rather than how fast anyone answers.
      </p>
    </div>
  );
}
