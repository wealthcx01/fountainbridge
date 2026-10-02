import Link from 'next/link';
import { toneColor } from '@/lib/status';
import {
  NEXT_ACTION_STATUS_LABEL,
  STAGE_LABEL,
  OPEN_STAGES,
  TEMPERATURE_TONE,
  formatDealValue,
  nextActions,
  pipelineNumbers,
  type CrmDeal,
  type PipelineRead,
  type Stage,
} from '@/lib/crm';

/**
 * The founder's Sell surface (FB-235).
 *
 * The shape is taken from the pipeline John runs every day; the words and the layout are ours. It
 * answers three questions, in this order, because that is the order a founder asks them:
 *
 *   1. **Who needs me now?** A short ranked list, with why, and the one thing to do about it.
 *   2. **Where does everything stand?** Each open deal by stage, ending in Won.
 *   3. **What does it add up to?** Only what can honestly be added up; otherwise, what is missing.
 *
 * ## Nothing on it sends
 *
 * Every action is a link to the composer with a draft request already written, ending "do not send
 * anything". The composer files that as work; the team drafts; anything that would leave the company
 * comes back to the founder as an approval (non-negotiable 4). This content draws no form and no
 * button that posts anywhere — so there is nothing here that could send, however it is pressed. (The
 * studio's top bar, on every page, has one form: "Sign out". It ends the session and sends nothing.)
 */

/** How many deals a stage shows before it says how many more. Keeps the board one screen tall. */
const PER_STAGE = 3;

const BOARD_STAGES: readonly Stage[] = [...OPEN_STAGES, 'won'];

export function SellView({
  ventureId,
  ventureName,
  read,
  nowMs,
}: {
  ventureId: string;
  ventureName: string;
  read: PipelineRead;
  nowMs: number;
}) {
  return (
    <div data-testid="sell-page">
      <p className="eyebrow">
        <span className="eyebrow-id">Sell</span> — {ventureName}
      </p>
      <h1 style={{ marginTop: 0 }}>Who you are selling to</h1>
      <Body ventureId={ventureId} read={read} nowMs={nowMs} />
      <p className="muted sell-note" data-testid="sell-no-send">
        Nothing on this page sends a message. A draft goes to your composer first, and anything that
        would leave the company waits for you to approve it.
      </p>
    </div>
  );
}

function Body({ ventureId, read, nowMs }: { ventureId: string; read: PipelineRead; nowMs: number }) {
  // Three different facts, three different sentences (CLAUDE.md #10). None of them is a zero.
  if (read.state === 'not-connected') {
    return (
      <p data-testid="sell-not-connected" className="sell-lead">
        Your pipeline is not set up yet. This studio has nowhere to keep it until Bruntsfield connects
        its database. Nothing has been lost; nothing has been recorded yet.
      </p>
    );
  }
  if (read.state === 'unreadable') {
    return (
      <p data-testid="sell-unreadable" className="sell-lead" style={{ color: toneColor('blocked') }}>
        Your pipeline could not be read just now: {read.reason}. That is not the same as it being
        empty. The rest of the studio is unaffected; try this page again in a minute.
      </p>
    );
  }

  const numbers = pipelineNumbers(read);
  const actions = nextActions(read, nowMs);

  if (!read.contacts.length && !read.deals.length) {
    return (
      <p data-testid="sell-empty" className="sell-lead">
        Nobody is in your pipeline yet. When your team adds the first person, they appear here, and
        anyone waiting on you goes to the top.
      </p>
    );
  }

  const names = new Map(read.contacts.map((c) => [c.id, c.name]));
  const capped = read.totals.contacts > read.contacts.length || read.totals.deals > read.deals.length;

  return (
    <>
      <p className="sell-lead" data-testid="sell-summary">
        {numbers.people} {numbers.people === 1 ? 'person' : 'people'}, {numbers.open} open{' '}
        {numbers.open === 1 ? 'deal' : 'deals'}, {numbers.won} won
        {numbers.lost ? `, ${numbers.lost} lost` : ''}.{' '}
        {numbers.openValue ? <>Open deals add up to <strong>{numbers.openValue}</strong>. </> : null}
        {numbers.expected ? <>Weighted by their chance of closing, that is {numbers.expected}. </> : null}
        <span className="muted" data-testid="sell-summary-missing">
          {numbers.openValueMissing ?? numbers.expectedMissing ?? ''}
        </span>
      </p>
      {capped ? (
        <p className="muted" data-testid="sell-capped" style={{ fontSize: 'var(--fs-meta-lg)' }}>
          This page shows the {read.contacts.length.toLocaleString('en-GB')} most recently changed people
          and {read.deals.length.toLocaleString('en-GB')} deals of {read.totals.contacts.toLocaleString('en-GB')}{' '}
          and {read.totals.deals.toLocaleString('en-GB')}.
        </p>
      ) : null}

      <section aria-labelledby="sell-next-h" data-testid="sell-next">
        <div className="queue-head">
          <h2 id="sell-next-h">Who needs you now</h2>
        </div>
        {actions.shown.length === 0 ? (
          <p className="muted" data-testid="sell-next-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
            Nobody is waiting on you. No one has written in without an answer, and no follow-up is due.
          </p>
        ) : (
          <ol className="sell-actions">
            {actions.shown.map((a) => {
              return (
                <li
                  key={a.contactId}
                  className="sell-action"
                  data-testid="sell-action"
                  data-status={a.status}
                  data-temperature={a.temperature}
                  style={{ borderLeftColor: toneColor(TEMPERATURE_TONE[a.temperature]) }}
                >
                  <div className="sell-action-body">
                    <span className="sell-action-who">
                      {a.name}
                      {a.company ? <span className="muted"> · {a.company}</span> : null}
                    </span>
                    <span className="sell-action-status">
                      {NEXT_ACTION_STATUS_LABEL[a.status]} · {a.temperature}
                    </span>
                    <span className="sell-action-why">{a.reason}</span>
                  </div>
                  <Link
                    className="sell-action-do"
                    data-testid="sell-action-draft"
                    href={`/venture/${ventureId}/composer?ask=${encodeURIComponent(a.draft.ask)}`}
                  >
                    {a.draft.label} →
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {actions.more > 0 ? (
          <p className="muted" data-testid="sell-next-more" style={{ fontSize: 'var(--fs-meta-lg)' }}>
            And {actions.more} more after these. They move up as you deal with the ones above.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="sell-board-h" data-testid="sell-board" style={{ marginTop: '2rem' }}>
        <div className="queue-head">
          <h2 id="sell-board-h">Where every deal stands</h2>
        </div>
        <div className="sell-board">
          {BOARD_STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              deals={read.deals.filter((d) => d.stage === stage)}
              names={names}
            />
          ))}
        </div>
        {numbers.lost ? (
          <p className="muted" data-testid="sell-lost" style={{ fontSize: 'var(--fs-meta-lg)' }}>
            {numbers.lost} {numbers.lost === 1 ? 'deal' : 'deals'} lost, kept off the board.
          </p>
        ) : null}
      </section>
    </>
  );
}

function StageColumn({
  stage,
  deals,
  names,
}: {
  stage: Stage;
  deals: CrmDeal[];
  names: Map<string, string>;
}) {
  const shown = deals.slice(0, PER_STAGE);
  return (
    <div className="sell-stage" data-testid="sell-stage" data-stage={stage}>
      <p className="surface-label">
        {STAGE_LABEL[stage]} <span className="sell-stage-count">{deals.length}</span>
      </p>
      {deals.length === 0 ? (
        <p className="muted sell-stage-empty">None</p>
      ) : (
        <ul className="sell-deals">
          {shown.map((d) => {
            const who = d.contactId ? names.get(d.contactId) ?? null : null;
            const value = formatDealValue(d.valueMinor, d.currency);
            return (
              <li key={d.id} className="sell-deal" data-testid="sell-deal">
                <span className="sell-deal-title">{d.title}</span>
                <span className="sell-deal-meta">
                  {[who, d.company].filter(Boolean).join(', ') || 'Nobody named yet'}
                </span>
                {value ? <span className="sell-deal-meta">{value}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {deals.length > PER_STAGE ? (
        <p className="muted sell-stage-more">and {deals.length - PER_STAGE} more</p>
      ) : null}
    </div>
  );
}
