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

type NavKey = 'desk' | 'tickets' | 'needs' | 'activity' | 'memory' | 'handbook';

const NAV: ReadonlyArray<{ key: NavKey; label: string; href: string; badge?: boolean }> = [
  { key: 'desk', label: 'The desk', href: '' },
  { key: 'tickets', label: 'Tickets', href: '/tickets' },
  { key: 'needs', label: 'Needs you', href: '/tickets?filter=needs', badge: true },
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
 * **Rows with a query are shortcuts, not sections, and never match.** "Needs you" is
 * `/tickets?filter=needs` — a filtered view of Tickets. `usePathname()` carries no query, so matching
 * on its path would make it tie with Tickets and win on raw length, highlighting the shortcut on every
 * ticket route. On `/tickets?filter=needs` the section a founder is in is Tickets; Needs you is how
 * they got there.
 */
export function activeKey(pathname: string, base: string): NavKey {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const match = NAV
    .filter((n) => n.href !== '' && !n.href.includes('?') && rest.startsWith(n.href))
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
            href={`${base}${n.href}`}
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
