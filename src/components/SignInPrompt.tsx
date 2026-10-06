// Presentational sign-in prompt shown to signed-out visitors.
export function SignInPrompt() {
  return (
    <section className="measure">
      <span className="eyebrow">Foundry Studio</span>
      <h1>Sign in to the studio</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>
        Fountainbridge is Bruntsfield Capital&apos;s founder-facing platform for co-created ventures.
        Sign in with your venture Google Workspace account to see your venture&apos;s lanes, tickets,
        and the attention queue.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <a href="/api/auth/login" className="btn btn-primary">
          Sign in with Google
        </a>
      </p>
    </section>
  );
}
