/**
 * Edge-safe Auth.js base config (FB-092 split). The middleware bundles for the edge runtime,
 * where node:crypto — needed by the password provider (lib/password-login) — cannot go. So the
 * middleware builds its gate from THIS config, which carries no providers at all, and auth.ts
 * spreads it and adds the real providers for the Node runtime.
 *
 * That is sufficient because the middleware never signs anyone in: it only validates the session
 * JWT (signed with AUTH_SECRET, same on both sides) and applies `authorized`. Sign-in itself always
 * runs in the Node runtime via app/api/auth and the login page's server actions.
 */

import type { NextAuthConfig } from 'next-auth';

export const baseConfig = {
  // Deploys run off-Vercel (one VPS per venture, D1); trust the host so Auth.js doesn't 500.
  trustHost: true,
  providers: [],
  pages: { signIn: '/login' },
  callbacks: {
    // Middleware gate (FB-005): matched routes require a signed-in user. Without this callback,
    // next-auth v5 middleware defaults to "authorized" and lets everything through — the
    // placeholder routes (and FB-006/007/008's real data pages) would be publicly reachable.
    authorized({ auth }) {
      // FB-015: no Foundry page is public. Every matched route requires a signed-in user; only
      // `/login`, `/not-authorized`, `/api/auth`, and `/api/health` are excluded (middleware matcher).
      return !!auth?.user;
    },
    // Persist the email on the JWT so `auth()` exposes it server-side for scoping.
    jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email;
      return session;
    },
  },
} satisfies NextAuthConfig;
