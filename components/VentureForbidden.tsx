import Link from 'next/link';

// Shown when a signed-in user requests a venture they don't own (or that doesn't exist). No ticket
// data is loaded server-side before this renders — the security property is "data never fetched",
// not merely "hidden in the UI". A 404-style message for a non-existent venture avoids confirming
// existence to a non-owner.
export function VentureForbidden({ ventureId, exists }: { ventureId: string; exists: boolean }) {
  return (
    <section style={{ maxWidth: '32rem', margin: '4rem auto', textAlign: 'center' }} data-testid="venture-forbidden">
      <p className="eyebrow">
        <span className="eyebrow-id">{exists ? '403' : '404'}</span> — {exists ? 'Not your venture' : 'Unknown venture'}
      </p>
      <h1>No access</h1>
      <p className="muted">
        You don’t have access to <span className="mono">{ventureId}</span>. Venture data is scoped to
        Bruntsfield and each venture’s founder.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Link className="btn" href="/">Back to ventures</Link>
      </p>
    </section>
  );
}
