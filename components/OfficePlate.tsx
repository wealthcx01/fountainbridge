import { TEAM_TITLE } from '@/lib/glossary';
import { deskDoing, officeSummary, type Office } from '@/lib/office';
import { howLong } from '@/lib/when';
import { toneColor } from '@/lib/status';
import { PixelAgent } from './PixelAgent';

/**
 * The office (FB-128's placeholder, made live in FB-139).
 *
 * The design's constraint is the whole component:
 *
 * > The office is the feeling; this ledger is the record. **Same events, so they cannot disagree.**
 *
 * They cannot, because there is one array. `office.desks` is mapped twice — once into characters,
 * once into rows — and nothing here can derive, filter or reorder one without the other. A test
 * asserts it, but the stronger guarantee is that there is no second list to get wrong.
 *
 * ## What a founder gets from each half
 *
 * The plate is glanceable: a hand up across the room means something waits on them. The ledger is
 * readable: which surface, doing what, since when. The plate is `aria-hidden` and the ledger is not
 * — a picture is the feeling, and the record is the half a screen-reader user gets.
 *
 * ## When the machine stops
 *
 * Empty chairs and the machine's own sentence, never the last scene. A still room would read as a
 * team sitting idle, when the truth is that nobody is reporting — and that is the most convincing
 * lie this surface could tell.
 */
export function OfficePlate({ office }: { office: Office }) {
  return (
    <section data-testid="office-plate" style={{ marginBottom: '1.5rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
        <span className="eyebrow-id">The office</span> — {TEAM_TITLE}
      </p>

      {/* ---- the feeling ---------------------------------------------------------------------- */}
      <div
        data-testid={office.live ? 'office-live' : 'office-placeholder'}
        style={{
          display: 'flex',
          gap: '1.25rem',
          flexWrap: 'wrap',
          padding: '1rem',
          border: office.live ? '1px solid var(--color-border)' : '1px dashed var(--color-border-strong)',
          background: 'var(--color-paper-sunken)',
          maxWidth: 'var(--content-narrow)',
        }}
      >
        {office.desks.map((desk) => (
          <div key={desk.departmentId} data-testid={`office-desk-${desk.departmentId}`}
               style={{ textAlign: 'center', minWidth: '4.5rem' }}>
            <PixelAgent state={desk.state} />
            <div className="mono" style={{ fontSize: 'var(--fs-meta)', color: 'var(--color-ink-muted)' }}>
              {desk.name}
            </div>
            {/* The raised hand, said in words as well as drawn — the plate is aria-hidden. */}
            {desk.state === 'waiting-on-you' ? (
              <div data-testid={`office-hand-${desk.departmentId}`}
                   style={{ fontSize: 'var(--fs-meta)', color: toneColor('attention') }}>
                needs you
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Claude Design, 2026-09-02, confirming the design's own room — BUILD/SELL/SCALE columns,
          desk labels, a needs-you flag, an "N on you" badge: *"that is the pixel-agents embed,
          read-only from the venture box. Three figures is fine as an interim ONLY if labelled as
          placeholder; don't hand-build the room in the studio."*

          So this says what it is. One figure per surface is not the room, and a founder looking at
          three figures has no way to know they are looking at a stand-in for something richer. */}
      <p className="muted" data-testid="office-placeholder-note"
         style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
        This is a stand-in. The real view shows each person at their desk, live from your
        venture&rsquo;s own machine — that is being connected.
      </p>

      <p className="muted" data-testid="office-summary" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0.9rem' }}>
        {officeSummary(office)} Each figure is one of your surfaces on this venture&rsquo;s own
        machine; a raised hand is a wait on you.
      </p>

      {/* ---- the record ----------------------------------------------------------------------- */}
      <div className="table-scroll">
        <table className="records" data-testid="office-ledger">
          <thead>
            <tr>
              <th scope="col">Surface</th>
              <th scope="col">Doing, right now</th>
              <th scope="col">Since</th>
            </tr>
          </thead>
          <tbody>
            {/* The SAME array the plate above mapped. There is no second list to disagree with. */}
            {office.desks.map((desk) => (
              <tr key={desk.departmentId} data-testid={`office-row-${desk.departmentId}`} data-state={desk.state}>
                <td>{desk.name}</td>
                <td>
                  {deskDoing(desk)}
                  {desk.ticketId ? <span className="mono muted"> · {desk.ticketId}</span> : null}
                </td>
                <td>
                  {desk.since ? (
                    `${howLong(desk.since) ?? 'a moment'} ago`
                  ) : (
                    <>
                      <span aria-hidden="true" className="muted">—</span>
                      <span className="sr-only">not applicable</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
