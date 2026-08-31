import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { auth, signOut } from '@/auth';
import { loadAccessibleAttention } from '@/lib/attention';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { timed } from '@/lib/timing';

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

/**
 * The count beside "Needs you", loaded off the critical path (FB-151).
 *
 * ## What was measured
 *
 * On production, signed in as ARCA's founder, `/login` — which renders this layout and a sign-in
 * form, and has no rail — took **5,354 ms**. The same route signed out took **196 ms**. The only
 * difference between those two numbers is the signed-in block of this layout, and the expensive
 * half of it is `loadAccessibleAttention`: open work across every venture the viewer can see, read
 * in the ROOT layout, on **every page of the studio**.
 *
 * FB-151 was written believing the rail was the five seconds. It was not; the rail was simply
 * present on the screens that got measured, and `/login` has never had one.
 *
 * ## Why streaming rather than a faster read
 *
 * Nothing above the fold depends on it. A number beside a link is not worth a blank screen, so the
 * shell flushes immediately and this arrives when it arrives. The read itself is unchanged — same
 * call, same per-venture cache, same FB-083 budget. What changed is that the founder stops waiting
 * for it.
 *
 * ## Why it renders nothing rather than a zero
 *
 * A zero here is a claim that nothing needs the founder, and this studio has learned what an
 * invented number does once it is on a screen (FB-124). Until the count is known there is no badge.
 */
async function AttentionBadge({ email }: { email: string }) {
  let count = 0;
  try {
    // The email is deliberately NOT recorded as the reading's detail: the ring is process-global and
    // read by an admin, and a diagnostic is no place to accumulate who was signed in.
    count = (await timed('root layout: open work across your ventures', () => loadAccessibleAttention(email)))
      .approvals.length;
  } catch {
    // Guarded — the header must never take down every page when the code host is unreachable.
    count = 0;
  }
  if (count === 0) return null;
  return (
    <span className="tag tag-accent" data-testid="nav-attention-badge" style={{ marginLeft: '0.35rem', padding: '0.05rem 0.35rem' }}>
      {count}
    </span>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;

  // Stays on the critical path deliberately: this reads the manifests off local disk, which is the
  // same read every venture page already makes and is not where the five seconds were. Deferring it
  // would buy nothing and would change the first nav row's word under the reader a beat after they
  // looked at it. Never fatal — a header that throws takes every page with it.
  let isAdmin = false;
  if (email) {
    try {
      isAdmin = authorizeVentures(email, loadVentures(), parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS)).isAdmin;
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
          {email ? (
            <>
              <nav className="topnav" data-testid="topnav">
                {NAV(isAdmin).map((n) => (
                  <Link key={n.href} className="pill" href={n.href}>
                    {n.label}
                    {/* The one expensive thing in this header, and the only thing that waits.
                        `fallback={null}` because there is no honest placeholder for a count — a
                        zero would be a claim, and a spinner beside a word is noise. */}
                    {n.href === '/attention' ? (
                      <Suspense fallback={null}>
                        <AttentionBadge email={email} />
                      </Suspense>
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
                <button className="btn" type="submit" title={email}>
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
