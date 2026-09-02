import Link from 'next/link';
import { RailNav } from './RailNav';
import { formatMoney } from '@/lib/budgets';
import { toneColor } from '@/lib/status';
import { railWords, type RailData } from '@/lib/rail';

/**
 * The persistent rail (FB-124).
 *
 * The studio used to be pages a founder navigated between. This makes it a desk they keep open: one
 * column that never goes away, carrying the venture's state — what waits on them, what is being
 * spent, whether the engine is alive — so it is answered on every screen without being asked for.
 *
 * Everything here is a fact or it is absent. A budget with no envelope says "not open" rather than
 * "£0", an engine nobody can hear from says so, and the office is drawn as a placeholder that admits
 * what it is. The rail is the most-seen surface in the product; a number invented here would be
 * believed everywhere.
 */

export function Rail({
  ventureId,
  ventureName,
  ventureStatus,
  data,
  departmentIds,
}: {
  ventureId: string;
  ventureName: string;
  ventureStatus: string;
  /**
   * The venture's live numbers, or `null` while they are still being read (FB-151).
   *
   * One component renders both states rather than a shell and a copy of it: a fallback that is a
   * second implementation of the same rail is a fallback that drifts, and this one is on every
   * screen under a venture.
   */
  data: RailData | null;
  /** In the venture's declared order, so a department with no envelope still has a name to show. */
  departmentIds: string[];
}) {
  // One place where "not known yet" becomes words (lib/rail.ts), so the three facts below cannot
  // each decide differently what an unknown looks like.
  const words = railWords(data);
  return (
    // The rail's layout lives in `.rail` in globals.css, not inline. It used to be inline, and
    // `display: flex` there beat the media query meant to hide it on a phone — so a 250px rail sat on
    // a 393px screen, the board scrolled sideways, and no unit test could see it. An inline style is
    // not overridable, which makes it the wrong place for anything responsive.
    // The waiting shell answers to `rail-waiting`, not `rail` (FB-158).
    //
    // While a Suspense boundary resolves, the fallback and the streamed content are BOTH in the
    // document for an instant — measured: two at `domcontentloaded`, one by the time the board is
    // visible. Sharing one test id made that instant a strict-mode violation, and worse, made the
    // two states indistinguishable to anything asking "is the rail there?". They are different
    // things: one of them knows this venture's numbers and one of them does not.
    <nav className="rail" data-testid={data === null ? 'rail-waiting' : 'rail'} aria-label="Venture">
      <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h4)', letterSpacing: '0.04em' }}>
          BRUNTSFIELD
        </div>
        <div className="eyebrow" style={{ marginTop: '0.1rem' }}>Foundry Studio</div>
      </Link>

      <div className="eyebrow" data-testid="rail-venture" style={{ margin: '1.6rem 0 0.6rem' }}>
        {ventureName} · {ventureStatus}
      </div>
      <div className="hr" style={{ margin: '0 0 0.6rem' }} />

      <RailNav ventureId={ventureId} needsYou={words.needsYou} />

      {/* The office placeholder that stood here is gone (FB-167).
          It read "Not live yet. Your team's desks appear here once this venture's machine reports
          what they are doing" — and it sat three lines above this same rail's engine line saying
          "Your team checked in 2 minutes ago". Two statements about one machine, one screen apart,
          contradicting each other on every venture page in production.
          It was honest when nothing was live. FB-139 built the live office on the desk and its own
          comment here said "FB-139 replaces this" — the replacement shipped, the placeholder did
          not get deleted, and a true sentence became a false one the moment the office became real.
          The office lives on the desk. The rail already answers "is this venture's machine alive"
          once, below, from the run reports. Answering it twice from two sources is exactly what
          FB-139's own constraint forbids: same events, so they cannot disagree. */}

      <div style={{ marginTop: '1.6rem' }}>
        <div className="eyebrow">Budgets, month</div>
        {/* A department with no envelope renders "not set", never a blank line and never "£0".
            The first version rendered an empty <li> for it, so ARCA's Build surface — the one with
            all the work in it — simply was not there, and nothing said why. A budget nobody has set
            and a budget of nothing are different facts. */}
        <ul data-testid="rail-budgets" style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
          {departmentIds.map((departmentId, i) => {
            const b = words.budgets?.[i] ?? null;
            return (
              <li
                key={departmentId}
                className="mono"
                style={{
                  fontSize: 'var(--fs-meta)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  color: b?.overLimit ? toneColor('blocked') : 'var(--color-ink-muted)',
                }}
              >
                <span>{departmentId}</span>
                {b ? (
                  <span>
                    {formatMoney(b.reportedMinor + b.queuedMinor, b.currency)}/
                    {formatMoney(b.limitMinor, b.currency)}
                  </span>
                ) : words.budgets === null ? (
                  // Still reading. "not set" would be a statement about this venture's setup, and
                  // "£0" would be a statement about its spending; neither is known yet.
                  <span>checking</span>
                ) : (
                  <span>not set</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ marginTop: '1.6rem', fontSize: 'var(--fs-meta)' }}>
        <span
          data-testid="rail-engine"
          data-state={words.engine.state}
          style={{ color: words.engine.state === 'stalled' ? toneColor('blocked') : 'var(--color-ink-muted)' }}
        >
          {words.engine.text}
        </span>
      </div>

      {/* No link to the venture box's own chat here, and that is deliberate.
       *
       * The first version of this rail had one, and `e2e/composer.spec.ts` caught it: "nothing on the
       * composer sends the founder to another product". That test is FB-065's whole point — the
       * composer was moved inside the studio precisely so a founder stops being handed to a second
       * application — and a link in the persistent rail would have put that hand-off on every screen.
       *
       * The design's rail does not have one either. It was invented here, and removed. The desk keeps
       * its existing link (FB-128's business); a rail is not the place to leave the studio from.
       *
       * The pocket-studio link the design shows arrives with FB-138. It is omitted rather than stubbed
       * because a nav row to a screen that does not exist is a dead control, which the design contract
       * forbids and `design-lint` enforces. */}
      <div style={{ marginTop: 'auto', paddingTop: '1.6rem', fontSize: 'var(--fs-meta)' }}>
        <div>
          <Link href="/api/auth/signout" data-testid="rail-signout">Sign out</Link>
        </div>
      </div>
    </nav>
  );
}
