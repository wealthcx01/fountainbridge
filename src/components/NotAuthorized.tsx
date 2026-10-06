import Link from "next/link";

// Shown when a signed-in identity requests a venture it may not see (server-side scoping, D6).
export function NotAuthorized({ ventureId }: { ventureId?: string }) {
  return (
    <section className="measure" data-testid="not-authorized">
      <span className="eyebrow" style={{ color: "var(--color-error)" }}>
        403 — not authorized
      </span>
      <h1>You can&apos;t see this venture</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>
        {ventureId ? (
          <>
            Your account isn&apos;t scoped to <code className="mono">{ventureId}</code>.
          </>
        ) : (
          "Your account isn't scoped to this venture."
        )}{" "}
        Venture isolation is enforced server-side — a founder only ever sees their own venture.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/" className="btn btn-secondary">
          Back to your ventures
        </Link>
      </p>
    </section>
  );
}
