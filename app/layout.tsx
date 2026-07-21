import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, signOut } from '@/auth';

const serif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-source-serif' });
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Foundry Studio',
  description: 'Bruntsfield Foundry Studio — launch and run co-created ventures.',
};

const NAV = [
  { href: '/', label: 'Ventures' },
  { href: '/lanes', label: 'Lanes' },
  { href: '/attention', label: 'Attention' },
  { href: '/activity', label: 'Activity' },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="wordmark" aria-label="Foundry Studio home">
            <span className="wordmark-name">Bruntsfield</span>
            <span className="wordmark-sub">Foundry</span>
          </Link>
          <span className="eyebrow topbar-spacer">
            <span className="eyebrow-id">03</span> — Foundry Studio
          </span>
          <nav style={{ display: 'flex', gap: '0.25rem' }}>
            {NAV.map((n) => (
              <Link key={n.href} className="pill" href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
          {session?.user?.email ? (
            <form
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
