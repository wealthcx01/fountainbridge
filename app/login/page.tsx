import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { auth, signIn, passwordLoginEnabled } from '@/auth';
import { toneColor } from '@/lib/status';

/**
 * The studio's front door (FB-005, FB-092, restyled FB-135).
 *
 * Google is the primary provider; FB-092 added an email-and-password form for the env-configured
 * allowlist (`lib/password-login`). When `E2E_TEST_LOGIN=1` a test form is shown so the UI gate can
 * sign in as an arbitrary email and drive the three authorization cases.
 *
 * ## Nothing about how signing in WORKS changed here
 *
 * FB-135 is a restyle, and this is the one screen where a cosmetic change that breaks a door locks a
 * founder out of everything. The server actions, the field names, the `autoComplete` hints, the
 * generic failure message and every test id are byte-for-byte what they were. What moved is the
 * markup around them.
 *
 * ## Why the top bar is hidden here
 *
 * The design's first screen is a centred block on an empty page, and it carries the wordmark itself.
 * The top bar carries one too, so leaving it up would print the name twice on the one screen whose
 * whole job is to introduce the studio. `body:has(.signin) .topbar` in `app/globals.css`, the same
 * shape as the rail's rule.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) redirect('/');

  const { error } = await searchParams;
  const e2e = process.env.E2E_TEST_LOGIN === '1';

  return (
    <section className="signin" data-testid="signin">
      <div className="wordmark" style={{ alignItems: 'center' }}>
        <span className="wordmark-name">Bruntsfield</span>
        <span className="wordmark-sub">Foundry Studio</span>
      </div>

      <div className="signin-block">
        <h1 style={{ margin: '0 0 0.5rem' }}>Sign in</h1>
        {/* FB-100's item 1: this read "Foundry Studio is invite-scoped. Sign in with your venture
            Google account." — directly above the email-and-password form FB-092 added. A founder
            holding an email login was told, by the page offering it, that Google was the way in.
            One sentence that covers whichever doors are actually open. */}
        <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
          {passwordLoginEnabled
            ? 'Sign in with your venture account: Google, or the email and password you were given.'
            : 'Sign in with your venture Google account.'}
        </p>
      </div>

      <form
        className="signin-block"
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
      >
        <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
          Continue with Google
        </button>
      </form>

      {passwordLoginEnabled ? (
        <form
          className="signin-block"
          data-testid="password-login"
          action={async (formData: FormData) => {
            'use server';
            try {
              await signIn('password', {
                email: String(formData.get('email') ?? ''),
                password: String(formData.get('password') ?? ''),
                redirectTo: '/',
              });
            } catch (err) {
              // Auth.js signals both outcomes by throwing: success is a NEXT_REDIRECT (rethrown),
              // failure an AuthError. One generic message on purpose — which check failed (unknown
              // email, wrong password, throttled) is exactly what a guesser wants to know.
              if (err instanceof AuthError) redirect('/login?error=password');
              throw err;
            }
          }}
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <p className="signin-or" style={{ margin: 0 }}>Or with email and password</p>
          <input
            className="signin-field"
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="email"
            aria-label="Email"
            data-testid="password-email"
          />
          <input
            className="signin-field"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="password"
            aria-label="Password"
            data-testid="password-password"
          />
          <button className="btn" type="submit" data-testid="password-submit">Sign in</button>
          {error === 'password' ? (
            <p role="alert" data-testid="password-error"
               style={{ color: toneColor('blocked'), fontSize: 'var(--fs-body-sm)', margin: 0 }}>
              That sign-in didn&rsquo;t work. Check the email and password; after several failed
              tries an account is paused for 15 minutes.
            </p>
          ) : null}
        </form>
      ) : null}

      {e2e ? (
        <form
          className="signin-block"
          data-testid="e2e-login"
          action={async (formData: FormData) => {
            'use server';
            await signIn('e2e', {
              email: String(formData.get('email') ?? ''),
              secret: String(formData.get('secret') ?? ''),
              redirectTo: '/',
            });
          }}
          style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
        >
          {/* Secret is rendered from server env only while the test provider is enabled; login
              still fails without the matching E2E_TEST_LOGIN_SECRET. */}
          <input type="hidden" name="secret" value={process.env.E2E_TEST_LOGIN_SECRET ?? ''} />
          <input className="signin-field" name="email" type="email" placeholder="test email"
                 aria-label="Test email" data-testid="e2e-email" />
          <button className="btn" type="submit" data-testid="e2e-submit">Test sign in</button>
        </form>
      ) : null}

      <p className="muted" data-testid="signin-footer" style={{ fontSize: 'var(--fs-meta)', margin: 0 }}>
        A Bruntsfield Capital venture · Edinburgh
      </p>
    </section>
  );
}
