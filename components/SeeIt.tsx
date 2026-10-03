import { offerFor, type PreviewCheck } from '@/lib/result-link';

/**
 * The work page's "See it" (FB-064, FB-184): the preview of this change, and the product as it stands.
 *
 * Review, click, look at the real thing — the one check a founder can always make for themselves.
 * The preview is this work specifically; the product link is the product as it stands, and they are
 * labelled as the different things they are rather than merged into one hopeful button.
 *
 * Each is a link only when the studio opened it and it worked. Otherwise the same place says why
 * there is no link, in the words the ticket's "Follow it to…" line uses.
 *
 * Its own file, with no client-only imports, so a unit test can draw it and check both halves.
 */
export function SeeIt({
  previewCheck = null,
  launch = null,
  launchCheck = null,
}: {
  /** What opening this work's preview found. `null` when the work has no preview. */
  previewCheck?: PreviewCheck | null;
  /** This surface's door from the manifest, when the venture declares one. */
  launch?: { label: string | null; url: string } | null;
  /** What opening `launch.url` found. */
  launchCheck?: PreviewCheck | null;
}) {
  const preview = offerFor(previewCheck);
  const product = launch ? offerFor(launchCheck) : null;
  if (!preview && !product) return null;
  return (
    <section data-testid="work-see-it" style={{ marginBottom: '1.5rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>See it</p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {preview?.kind === 'link' ? (
          <a className="btn" href={preview.href} target="_blank" rel="noreferrer" data-testid="work-preview">
            See this change running ↗
          </a>
        ) : null}
        {product?.kind === 'link' ? (
          <a className="btn" href={product.href} target="_blank" rel="noreferrer" data-testid="work-launch">
            {launch?.label ?? 'Open your product'} ↗
          </a>
        ) : null}
      </div>
      {preview?.kind === 'why' ? (
        <p className="muted" data-testid="work-preview-why" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
          The preview of this change: {preview.text}.
        </p>
      ) : null}
      {product?.kind === 'why' ? (
        <p className="muted" data-testid="work-launch-why" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
          {launch?.label ?? 'Your product'}: {product.text}.
        </p>
      ) : null}
    </section>
  );
}
