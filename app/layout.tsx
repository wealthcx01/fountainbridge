import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { loadAccessibleAttention } from '@/lib/attention';

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

const NAV = [
  { href: '/', label: 'Ventures' },
  { href: '/lanes', label: 'Lanes' },
  { href: '/attention', label: 'Attention' },
  { href: '/activity', label: 'Activity' },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Attention badge: count of PRs awaiting review across accessible ventures (cached per venture).
  // Guarded — the badge must never take down every page if GitHub is unreachable.
  let attentionCount = 0;
  if (session?.user?.email) {
    try {
      attentionCount = (await loadAccessibleAttention(session.user.email)).approvals.length;
    } catch {
      attentionCount = 0;
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
          <span className="eyebrow topbar-spacer topbar-eyebrow">
            <span className="eyebrow-id">03</span> — Foundry Studio
          </span>
          <nav className="topnav" data-testid="topnav">
            {NAV.map((n) => (
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
          {session?.user?.email ? (
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
          ) : null}
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
