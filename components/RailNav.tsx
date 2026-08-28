'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toneColor } from '@/lib/status';

/**
 * The rail's navigation (FB-124).
 *
 * The only client component in the rail, and only because of one thing: a layout cannot know which of
 * its children is rendering. Everything else about the rail is server-rendered from data the layout
 * already has.
 *
 * It carries no state and fetches nothing. `usePathname` is the whole reason it is here.
 */

/** `tickets` returns with FB-129, which builds the screen. A key with no row is a dead control. */
type NavKey = 'desk' | 'needs' | 'tickets' | 'activity' | 'memory' | 'handbook';

/**
 * The rows, and only rows that go somewhere.
 *
 * **Tickets is absent, deliberately.** `/venture/[id]/tickets` is FB-129 and does not exist yet. The
 * first version of this rail listed it anyway: the link 404'd, and Next's prefetch fired that 404 on
 * every venture page load before a founder had clicked anything. A nav row to a screen that is not
 * built is a dead control — the design contract forbids them, and `design-lint` did not catch this
 * one because it only sees buttons.
 *
 * **Needs you points at `/attention`**, which is that queue, works today, and is what FB-129 will
 * absorb. Pointing it at the real thing is better than pointing it at the eventual thing.
 *
 * FB-129 adds Tickets and repoints Needs you. Until then every row here goes somewhere real.
 */
/**
 * The rows, exported so a test can assert each one points at a route that exists.
 *
 * FB-124 shipped a Tickets row whose screen did not exist; Next prefetched the 404 on every venture
 * page load. The guard for that has to read this list, not a copy of it.
 */
export const NAV: ReadonlyArray<{ key: NavKey; label: string; href: string; absolute?: boolean; badge?: boolean }> = [
  { key: 'desk', label: 'The desk', href: '' },
  // FB-129: the venture's own tickets, filtered. It pointed at `/attention` — a cross-venture page
  // that lists open work and nothing else — so the badge stated a number its destination could
  // contradict. Now the row, the badge and the screen it opens count the same things (FB-149).
  { key: 'needs', label: 'Needs you', href: '/tickets?filter=needs', badge: true },
  { key: 'tickets', label: 'Tickets', href: '/tickets' },
  { key: 'activity', label: 'What happened', href: '/activity' },
  { key: 'memory', label: 'Memory', href: '/knowledge' },
  { key: 'handbook', label: 'Handbook', href: '/handbook' },
];

/**
 * Which row is the current screen.
 *
 * Longest suffix wins, so `/venture/arca/handbook/chapter-3` marks Handbook rather than falling
 * through to the desk. The desk is the empty suffix and therefore matches everything, which is why it
 * is chosen last rather than first.
 *
 * Rows outside the venture subtree (`absolute`) and rows with a query are shortcuts, not sections,
 * and never match. "Needs you" is one: since FB-129 it is a *filter* on Tickets, so the section a
 * founder is in when they follow it is Tickets — which is what the row below it marks.
 */
export function activeKey(pathname: string, base: string): NavKey {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const match = NAV
    .filter((n) => n.href !== '' && !n.absolute && !n.href.includes('?') && rest.startsWith(n.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.key ?? 'desk';
}

export function RailNav({ ventureId, needsYou }: { ventureId: string; needsYou: number }) {
  const base = `/venture/${ventureId}`;
  const pathname = usePathname() ?? base;
  const active = activeKey(pathname, base);

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {NAV.map((n) => (
        <li key={n.key}>
          <Link
            href={n.absolute ? n.href : `${base}${n.href}`}
            data-testid={`rail-nav-${n.key}`}
            data-active={active === n.key ? 'true' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.6rem',
              fontSize: 'var(--fs-body-sm)',
              textDecoration: 'none',
              color: active === n.key ? 'var(--color-ink)' : 'var(--color-ink-soft)',
              background: active === n.key ? 'var(--color-paper-sunken)' : undefined,
              fontWeight: active === n.key ? 500 : 400,
            }}
          >
            {n.label}
            {/* The count of work waiting on this founder — the same number the desk's blocker banner
                reads. Absent at zero rather than showing "0": a badge that is always there stops
                being a signal, and this one has to keep meaning something. */}
            {n.badge && needsYou > 0 ? (
              <span
                className="tag"
                data-testid="rail-needs-badge"
                style={{ background: toneColor('attention'), color: 'var(--color-paper)' }}
              >
                {needsYou}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
