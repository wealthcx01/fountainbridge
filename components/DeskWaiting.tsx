/**
 * The desk, drawn before its numbers are in (FB-157).
 *
 * Measured against production data, the desk's own reads cost ~2.7s warm and ~4.4s cold, and the
 * whole page waited on them: a founder opening the screen they leave open all day got white until
 * the slowest of them finished.
 *
 * So the desk arrives in two pieces. This is the piece that needs nothing read: the venture's own
 * name, and a line saying what is happening.
 *
 * ## Why there is no control on it
 *
 * The first version put the prompt bar here, on the reasoning that a founder could start typing
 * before the board finished. They could not. Content in a Suspense fallback is not hydrated, so the
 * chips did nothing — and while the boundary resolved, BOTH prompt bars were in the document, which
 * the UI gate caught as two elements answering to one test id. A control that is present and inert
 * is worse than no control: it is the dead button the design contract forbids, with a plausible
 * excuse.
 *
 * ## What else it deliberately does not draw
 *
 * The summary sentence, the blocker banner, the columns, the budgets. Every one is a claim about the
 * venture, and a skeleton in the shape of a claim is still a claim — a founder glancing at a
 * greyed-out "nothing needs you" has been told something false.
 */
export function DeskWaiting({
  ventureName,
  ventureStatus,
}: {
  ventureName: string;
  ventureStatus: string;
}) {
  return (
    <section data-testid="desk-waiting" style={{ padding: '2rem 2.25rem' }}>
      <p className="eyebrow">
        <span className="eyebrow-id">{ventureName}</span> — {ventureStatus}
      </p>
      <p className="muted" data-testid="desk-waiting-line"
         style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 1.25rem', maxWidth: 'var(--content-narrow)' }}>
        Reading your venture&rsquo;s records&hellip;
      </p>
    </section>
  );
}
