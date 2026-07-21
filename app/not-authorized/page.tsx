import { auth, signOut } from '@/auth';

// Clean refusal for an authenticated-but-unlisted account (D6 scoping). No venture data is loaded.
export default async function NotAuthorized() {
  const session = await auth();
  return (
    <section style={{ maxWidth: '32rem', margin: '4rem auto', textAlign: 'center' }} data-testid="not-authorized">
      <p className="eyebrow"><span className="eyebrow-id">403</span> — Not authorized</p>
      <h1>No venture access</h1>
      <p className="muted">
        {session?.user?.email ? (
          <>
            <span className="mono">{session.user.email}</span> isn’t linked to a venture. Access is
            scoped to Bruntsfield and each venture’s founder. If this is wrong, contact Bruntsfield.
          </>
        ) : (
          'This account isn’t linked to a venture.'
        )}
      </p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
        style={{ marginTop: '1.5rem' }}
      >
        <button className="btn" type="submit">Sign out</button>
      </form>
    </section>
  );
}
