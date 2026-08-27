import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { auth, signIn, passwordLoginEnabled } from '@/auth';
import { toneColor } from '@/lib/status';

// Sign-in page. Google is the primary provider; FB-092 adds an email+password form for the
// env-configured allowlist (lib/password-login). When E2E_TEST_LOGIN=1 a test form is shown so
// Playwright/CI can sign in as an arbitrary email to drive the three authorization cases.
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
    <section style={{ maxWidth: '28rem', margin: '4rem auto', textAlign: 'center' }}>
      <h1>Sign in</h1>
      {/* FB-100's item 1: this read "Foundry Studio is invite-scoped. Sign in with your venture Google
          account." — directly above the email-and-password form FB-092 added. A founder holding an
          email login was told, by the page offering it, that Google was the way in. One sentence
          that covers whichever doors are actually open. */}
      <p className="muted">
        {passwordLoginEnabled
          ? 'Sign in with your venture account — Google, or the email and password you were given.'
          : 'Sign in with your venture Google account.'}
      </p>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
        style={{ marginTop: '1.5rem' }}
      >
        <button className="btn btn-primary" type="submit">Continue with Google</button>
      </form>

      {passwordLoginEnabled ? (
        <form
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
          style={{ marginTop: '2rem', display: 'grid', gap: '0.5rem' }}
        >
          <p className="muted" style={{ marginBottom: 0 }}>Or with email and password:</p>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="email"
            data-testid="password-email"
            style={{ padding: '0.5rem', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-input)' }}
          />
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="password"
            data-testid="password-password"
            style={{ padding: '0.5rem', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-input)' }}
          />
          <button className="btn" type="submit" data-testid="password-submit">Sign in</button>
          {error === 'password' ? (
            <p role="alert" data-testid="password-error" style={{ color: toneColor('blocked'), marginBottom: 0 }}>
              That sign-in didn&rsquo;t work. Check the email and password; after several failed
              tries an account is paused for 15 minutes.
            </p>
          ) : null}
        </form>
      ) : null}

      {e2e ? (
        <form
          data-testid="e2e-login"
          action={async (formData: FormData) => {
            'use server';
            await signIn('e2e', {
              email: String(formData.get('email') ?? ''),
              secret: String(formData.get('secret') ?? ''),
              redirectTo: '/',
            });
          }}
          style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
        >
          {/* Secret is rendered from server env only while the test provider is enabled; login
              still fails without the matching E2E_TEST_LOGIN_SECRET. */}
          <input type="hidden" name="secret" value={process.env.E2E_TEST_LOGIN_SECRET ?? ''} />
          <input name="email" type="email" placeholder="test email" data-testid="e2e-email"
            style={{ padding: '0.5rem', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-input)' }} />
          <button className="btn" type="submit" data-testid="e2e-submit">Test sign in</button>
        </form>
      ) : null}
    </section>
  );
}
