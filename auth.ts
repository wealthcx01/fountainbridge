/**
 * Auth.js (NextAuth v5) configuration (FB-005). Google OAuth is the Holy Corner vertical-login
 * pattern (D4); venture scoping keys off the signed-in email against `founder.workspace_email` in
 * the manifests (see lib/authz). Google is the ONLY real provider.
 *
 * Test login: when `E2E_TEST_LOGIN=1` AND `E2E_TEST_LOGIN_SECRET` is set, a credentials provider
 * signs in as an arbitrary email — but ONLY if the request carries the matching secret. This lets
 * Playwright drive the three authorization cases against a production build without a live Google
 * client, while a stray `E2E_TEST_LOGIN=1` in real prod is inert (no secret → provider refuses).
 * Real deployments (FB-009) set neither var.
 *
 * Auth mechanism decision (documented in the PR): Auth.js in-app now; Supabase remains the D6 data
 * layer (wired in FB-009). GitHub access is a separate server-side org token (lib/github), not the
 * user's OAuth — the studio reads git on the org's behalf, scoped per request by lib/authz.
 */

import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

const providers: NextAuthConfig['providers'] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
];

const e2eSecret = process.env.E2E_TEST_LOGIN_SECRET;
if (process.env.E2E_TEST_LOGIN === '1' && e2eSecret) {
  providers.push(
    Credentials({
      id: 'e2e',
      name: 'E2E Test Login',
      credentials: { email: { label: 'Email', type: 'text' }, secret: { type: 'text' } },
      authorize: (creds) => {
        const secret = typeof creds?.secret === 'string' ? creds.secret : '';
        // Constant target compare; the provider only exists when a secret is configured.
        if (!e2eSecret || secret !== e2eSecret) return null;
        const email = typeof creds?.email === 'string' ? creds.email.trim() : '';
        return email ? { id: email, email, name: 'E2E Test User' } : null;
      },
    }),
  );
}

export const config: NextAuthConfig = {
  // Deploys run off-Vercel (one VPS per venture, D1); trust the host so Auth.js doesn't 500.
  trustHost: true,
  providers,
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
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
