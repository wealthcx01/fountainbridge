import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { loadAccessibleAttention } from '@/lib/attention';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';

const serif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-source-serif' });
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Foundry Studio',
  description: 'Bruntsfield Foundry Studio — launch and run co-created ventures.',
};

// FB-009: usable on a phone. Explicit viewport so mobile scaling is correct.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Four places, each named for what the founder is doing there (FB-067).
 *
 * The header used to offer eight, three of which — Ventures, Workstreams, Foundry — sat next to each
 * other and could not be told apart from the words. They described how the software is organised,
 * not what a founder came to do.
 *
 * Two are gone from the header and neither is deleted:
 *
 *  - **Workstreams** (`/lanes`) was a cross-venture view of the same lanes the venture board already
 *    shows. It is reachable, and nothing links to it from a founder's header.
 *  - **Foundry** (`/foundry`) is the story of how the studio works. It belongs where people are
 *    deciding whether to join, not in a working founder's header — the ticket says the public site,
 *    and there is no public site yet, so it moves to the handbook rather than nowhere.
 *
 * The composer is deliberately absent: after FB-065 it is something you do from your venture, not a
 * place you visit.
 *
 * The names deliberately match the page headings — "Needs you" and "What has been happening" — so a
 * founder who clicks a word arrives somewhere that uses the same word (FB-076, FB-080).
 */
const NAV = (isAdmin: boolean) => [
  // An admin genuinely is choosing between ventures; a founder has one and is going to theirs.
  { href: '/', label: isAdmin ? 'All ventures' : 'Your venture' },
  { href: '/attention', label: 'Needs you' },
  { href: '/activity', label: 'What happened' },
  { href: '/handbook', label: 'Handbook' },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Attention badge: count of PRs awaiting review across accessible ventures (cached per venture).
  // Guarded — the badge must never take down every page if GitHub is unreachable.
  let attentionCount = 0;
  let isAdmin = false;
  if (session?.user?.email) {
    try {
      attentionCount = (await loadAccessibleAttention(session.user.email)).approvals.length;
    } catch {
      attentionCount = 0;
    }
    // Never fatal: a header that throws takes every page with it.
    try {
      isAdmin = authorizeVentures(
        session.user.email,
        loadVentures(),
        parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS),
      ).isAdmin;
    } catch {
      isAdmin = false;
    }
  }
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="wordmark" aria-label="Foundry Studio home">
            <span className="wordmark-name">Bruntsfield</span>
            <span className="wordmark-sub">Foundry</span>
          </Link>
          {/* FB-067: the `03` was a section number from the Bruntsfield marketing site. It means
              something there and nothing here. */}
          <span className="eyebrow topbar-spacer topbar-eyebrow">Foundry Studio</span>
          {session?.user?.email ? (
            <>
              <nav className="topnav" data-testid="topnav">
                {NAV(isAdmin).map((n) => (
                  <Link key={n.href} className="pill" href={n.href}>
                    {n.label}
                    {n.href === '/attention' && attentionCount > 0 ? (
                      <span className="tag tag-accent" data-testid="nav-attention-badge" style={{ marginLeft: '0.35rem', padding: '0.05rem 0.35rem' }}>
                        {attentionCount}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </nav>
              <form
                className="signout-form"
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <button className="btn" type="submit" title={session.user.email}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            /* Signed-out (login / not-authorized only, FB-015): just the wordmark, no nav. */
            <span className="topnav signout-form" data-testid="topnav-signedout" />
          )}
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
