import { devLoginEnabled, googleConfigured } from "@/lib/auth";

// Sign-in page. Offers Google OAuth; when Google isn't configured it explains why, and in
// dev/test it exposes the guarded dev-login so the shell is exercisable without real credentials.
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; oauth?: string; dev?: string }>;
}) {
  const params = await searchParams;
  const dev = devLoginEnabled();

  return (
    <section className="measure">
      <span className="eyebrow">Foundry Studio</span>
      <h1>Sign in</h1>

      {params.error && (
        <p style={{ color: "var(--color-error)" }}>
          Sign-in didn&apos;t complete ({params.error}). Please try again.
        </p>
      )}

      {googleConfigured() ? (
        <p style={{ marginTop: "1.25rem" }}>
          <a href="/api/auth/login" className="btn btn-primary">
            Sign in with Google
          </a>
        </p>
      ) : (
        <p style={{ color: "var(--color-ink-soft)" }}>
          Google OAuth isn&apos;t configured on this deployment yet (set{" "}
          <code className="mono">GOOGLE_CLIENT_ID</code> /{" "}
          <code className="mono">GOOGLE_CLIENT_SECRET</code>).
        </p>
      )}

      {dev && (
        <div className="card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
          <span className="eyebrow">Dev login</span>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Development / test only — set a session without Google.
          </p>
          <form action="/api/auth/dev-login" method="post" style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="email"
              name="email"
              placeholder="you@venture.com"
              required
              style={{
                flex: 1,
                padding: "0.5rem 0.7rem",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
              }}
            />
            <button type="submit" className="btn btn-secondary">
              Continue
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
