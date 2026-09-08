import Link from 'next/link';
import { deskDoing, type Office, type OfficeDesk } from '@/lib/office';
import { howLong } from '@/lib/when';

/**
 * The record beside the office (FB-203, item 8).
 *
 * ## Why it moved out of the plate
 *
 * It used to live inside `OfficePlate`, which is the **fallback** — the drawing shown when the real
 * office cannot be. So on every venture where the embed worked, the ledger vanished with the plate,
 * and the one half of this pairing a screen-reader user can read disappeared exactly when the venture
 * was healthiest. It is its own component now and renders either way.
 *
 * The design's constraint survives the move intact:
 *
 * > The office is the feeling; this ledger is the record. **Same events, so they cannot disagree.**
 *
 * They cannot, because there is still one array. `office.desks` is what the plate maps into
 * characters and what this maps into rows, and neither can filter or reorder without the other.
 *
 * ## "Surface", not "Agent"
 *
 * The design's column head is **Agent**. It says "Surface", and that is a rule rather than a
 * preference: FB-103 took the word "agent" out of everything a founder reads, `copy-lint` fails the
 * build on it, and CLAUDE.md #12 binds every word rendered in the studio. It is also the more
 * truthful word — `lib/office.ts` is explicit that one row here is one **surface**, because a lane
 * per surface is what the box actually reports. Calling it an agent would promise a granularity the
 * feed does not have.
 *
 * The ticket link's testid is deliberately NOT `office-row-…-link`: the ledger's rows are found by
 * the prefix `office-row-`, and a child sharing that prefix silently doubles every count taken over
 * them. That is how "the plate and the ledger draw different surfaces" first failed here.
 *
 * ## Rows, not cards
 *
 * Two columns and a hairline between them. The card version spent a border, a background and 16px of
 * padding per surface to say one short sentence, which is how three facts came to fill the height of
 * a screen.
 */
export function OfficeLedger({ office, ventureId }: { office: Office; ventureId?: string }) {
  return (
    <div className="ledger" data-testid="office-ledger">
      <div className="ledger-head" aria-hidden="true">
        <span>Surface</span>
        <span>Doing, right now</span>
      </div>
      <table className="ledger-table">
        <caption className="sr-only">What each surface on this venture&rsquo;s machine is doing</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Surface</th>
            <th scope="col">Doing, right now</th>
          </tr>
        </thead>
        <tbody>
          {office.desks.map((desk) => (
            <Row key={desk.departmentId} desk={desk} ventureId={ventureId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One surface.
 *
 * Amber when a hand is up, and only then. A row that says "nothing on right now" is not a warning
 * and must not be coloured like one — the design has one attention colour and spending it on a quiet
 * row is how a founder learns to stop seeing it.
 *
 * The whole row is a link when the surface names a ticket, because "Build — picked up the price
 * history work" invites exactly one question, and the answer is that ticket.
 */
function Row({ desk, ventureId }: { desk: OfficeDesk; ventureId?: string }) {
  const since = desk.since ? howLong(desk.since) : null;
  const href = desk.ticketId && ventureId
    ? `/venture/${ventureId}/tickets?t=${encodeURIComponent(desk.ticketId)}`
    : null;

  const doing = (
    <>
      {deskDoing(desk)}
      {/* Relative, not the recorded timestamp. "2026-07-22T18:00:00Z" is a fact about a clock; the
          question this column answers is how long it has been going on. */}
      {since ? <span className="ledger-since"> · {since}</span> : null}
    </>
  );

  return (
    <tr
      className={desk.state === 'waiting-on-you' ? 'ledger-row ledger-row-waiting' : 'ledger-row'}
      data-testid={`office-row-${desk.departmentId}`}
      data-state={desk.state}
    >
      <th scope="row" className="ledger-name">{desk.name}</th>
      <td className="ledger-doing">
        {href ? (
          <Link className="ledger-link" href={href} data-testid={`office-ticket-${desk.departmentId}`}>
            {doing}
          </Link>
        ) : (
          doing
        )}
      </td>
    </tr>
  );
}
