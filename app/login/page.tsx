import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

// Sign-in page. Google is the only real provider. When E2E_TEST_LOGIN=1 a test form is shown so
// Playwright/CI can sign in as an arbitrary email to drive the three authorization cases.
export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email) redirect('/');

  const e2e = process.env.E2E_TEST_LOGIN === '1';

  return (
    <section style={{ maxWidth: '28rem', margin: '4rem auto', textAlign: 'center' }}>
      <p className="eyebrow"><span className="eyebrow-id">03</span> — Foundry Studio</p>
      <h1>Sign in</h1>
      <p className="muted">Foundry Studio is invite-scoped. Sign in with your venture Google account.</p>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
        style={{ marginTop: '1.5rem' }}
      >
        <button className="btn btn-primary" type="submit">Continue with Google</button>
      </form>

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
            style={{ padding: '0.5rem', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius)' }} />
          <button className="btn" type="submit" data-testid="e2e-submit">Test sign in</button>
        </form>
      ) : null}
    </section>
  );
}
