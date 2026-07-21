// Placeholder for nav destinations whose real views arrive in later tickets (FB-006/007/008).
// Keeps the shell navigable without faking data.
export function ComingSoon({ eyebrow, title, ticket }: { eyebrow: string; title: string; ticket: string }) {
  return (
    <section data-testid="coming-soon">
      <p className="eyebrow">
        <span className="eyebrow-id">{eyebrow}</span> — Foundry Studio
      </p>
      <h1>{title}</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        This view lands in <span className="mono">{ticket}</span>. The studio shell (FB-005) ships the
        frame, auth and venture scoping; the data views come next.
      </p>
    </section>
  );
}
