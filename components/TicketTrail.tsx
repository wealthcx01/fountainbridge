import Link from 'next/link';
import type { Trail } from '@/lib/trail';
import { toneColor } from '@/lib/status';
import { onDate } from '@/lib/when';

/**
 * Follow the change (FB-130).
 *
 * FB-125 joins the events; this is where a founder reads them, and it carries the sentence the whole
 * studio rests on: *"nothing shown here can disagree with what ran."*
 *
 * ## One deliberate deviation from the design
 *
 * The design writes this heading as "Follow the change · the ActiveGraph trail" and the claim as
 * "Every hop is the same event **ActiveGraph** recorded". The copy contract forbids the product name
 * in founder-facing text (`lib/glossary.ts`), and it is right to: ActiveGraph is a system a founder
 * has no reason to have heard of, and the sentence's force comes from what it promises, not from
 * what the system is called. The claim is kept word for word otherwise. Flagged on FB-130 so it can
 * be overruled.
 *
 * Which is a constraint, not a flourish. It is why:
 *
 * - **No link is rendered that cannot be resolved.** `buildTrail` drops an href it cannot form, so
 *   there is nothing here to guard against — but the closing sentence is only true while that holds,
 *   and an e2e asserts it on the rendered page rather than trusting the join.
 * - **An unverified hop says so.** Neither hidden nor passed off as verified. Dropping it would hide
 *   something that happened; showing it as verified would be the forgery the signature exists to
 *   prevent.
 * - **A short trail and an unreadable one are told apart.** `degraded` says a source could not be
 *   read, because otherwise the two look identical and one of them is a lie.
 *
 * ## → stays in the studio, ↗ leaves it
 *
 * The design is consistent about this across every screen, and a founder learns it once. Breaking it
 * costs more than the two characters saved.
 */
export function TicketTrail({ trail }: { trail: Trail }) {
  return (
    <section data-testid="ticket-trail" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
      <p className="eyebrow" style={{ marginTop: 0 }}>Follow the change</p>

      {/* Only when the studio actually READ a history and found none. A degraded trail rendered both
          this and the warning below it, so a ticket with a full approval history was told "nothing
          has happened to this one yet" directly above "part of this history could not be read". */}
      {trail.hops.length === 0 && !trail.degraded ? (
        <p className="muted" data-testid="trail-empty" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
          Nothing has happened to this one yet. Every step your team takes will be written down here.
        </p>
      ) : trail.hops.length === 0 ? null : (
        <ol data-testid="trail-hops" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {trail.hops.map((hop, i) => (
            <li
              key={`${hop.at}-${i}`}
              data-testid="trail-hop"
              data-source={hop.source}
              data-at={hop.at}
              data-verified={hop.verified === null || hop.verified === undefined ? 'n/a' : String(hop.verified)}
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', padding: '0.4rem 0' }}
            >
              <span className="mono muted" style={{ flexShrink: 0, fontSize: 'var(--fs-meta)' }}>
                {onDate(hop.at) ?? ''}
              </span>
              <span style={{ minWidth: 0 }}>
                {hop.text}
                {hop.link ? (
                  <>
                    {' · '}
                    {hop.link.external ? (
                      <a href={hop.link.href} target="_blank" rel="noreferrer">{hop.link.label} ↗</a>
                    ) : (
                      <Link href={hop.link.href}>{hop.link.label} →</Link>
                    )}
                  </>
                ) : null}
                {hop.verified === false ? (
                  <>
                    {' '}
                    <span
                      data-testid="trail-unverified"
                      style={{ color: toneColor('attention'), fontSize: 'var(--fs-meta-lg)' }}
                    >
                      {/* In words a founder can act on: what it means and who fixes it. A badge
                          reading "unverified" tells them something is wrong and nothing else. */}
                      ⚠ this step is recorded but its signature does not check out — tell Bruntsfield
                      before relying on it
                    </span>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      {trail.degraded ? (
        <p className="muted" data-testid="trail-degraded" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.6rem 0 0' }}>
          <span aria-hidden="true">⚠ </span>
          Part of this history could not be read, so it may be short. It is not that nothing else
          happened — it is that the studio could not see it.
        </p>
      ) : null}

      <p className="muted" data-testid="trail-claim" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.6rem 0 0' }}>
        Every step here is the record your studio wrote as it happened: nothing shown can disagree
        with what ran.
      </p>
    </section>
  );
}
