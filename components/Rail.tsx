import Link from 'next/link';
import { RailNav } from './RailNav';
import { formatMoney } from '@/lib/budgets';
import { toneColor } from '@/lib/status';
import type { RailData } from '@/lib/rail';

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
}: {
  ventureId: string;
  ventureName: string;
  ventureStatus: string;
  data: RailData;
}) {
  return (
    <nav
      data-testid="rail"
      aria-label="Venture"
      style={{
        width: '15.625rem',
        flex: '0 0 15.625rem',
        borderRight: '1px solid var(--color-border)',
        padding: '1.6rem 1.4rem 1.4rem',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
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

      <RailNav ventureId={ventureId} needsYou={data.needsYou} />

      {/* FB-139 replaces this with the live feed from the venture box. Until then it says what it is:
          a placeholder is honest, a frozen last-known scene would not be. */}
      <div style={{ marginTop: '1.6rem' }}>
        <div className="eyebrow">The office</div>
        <div
          data-testid="rail-office-placeholder"
          style={{
            marginTop: '0.4rem',
            padding: '0.8rem',
            border: '1px dashed var(--color-border-strong)',
            background: 'var(--color-paper-sunken)',
            fontSize: 'var(--fs-meta)',
            color: 'var(--color-ink-muted)',
          }}
        >
          Not live yet. Your team’s desks appear here once this venture’s machine reports what they
          are doing.
        </div>
      </div>

      <div style={{ marginTop: '1.6rem' }}>
        <div className="eyebrow">Budgets, month</div>
        <ul data-testid="rail-budgets" style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
          {data.budgets.map((b, i) => (
            <li
              key={b?.department ?? `none-${i}`}
              className="mono"
              style={{
                fontSize: 'var(--fs-meta)',
                display: 'flex',
                justifyContent: 'space-between',
                color: b?.overLimit ? toneColor('blocked') : 'var(--color-ink-muted)',
              }}
            >
              {b ? (
                <>
                  <span>{b.department}</span>
                  {/* Reported plus queued, against the limit — the same figure the desk shows, so a
                      founder never meets two numbers for one budget. */}
                  <span>
                    {formatMoney(b.reportedMinor + b.queuedMinor, b.currency)}/
                    {formatMoney(b.limitMinor, b.currency)}
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '1.6rem', fontSize: 'var(--fs-meta)' }}>
        <span
          data-testid="rail-engine"
          data-state={data.engine.state}
          style={{ color: data.engine.state === 'stalled' ? toneColor('blocked') : 'var(--color-ink-muted)' }}
        >
          {data.engine.text}
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
