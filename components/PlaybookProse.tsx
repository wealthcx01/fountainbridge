'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders playbook markdown. Bare-slug links in the content (e.g. `[moats](moats)`) are rewritten to
// `/playbook/<slug>` so cross-links work from any route; external/absolute/anchor links pass through.
/**
 * `measure` is the line length (FB-134).
 *
 * The playbook keeps the width it has had; the handbook's reader asks for `var(--measure)` — 62ch,
 * the design system's figure. A prop rather than a change here, because widening the shared renderer
 * to suit one surface silently restyles the other.
 */
export function PlaybookProse({ body, measure = '46rem' }: { body: string; measure?: string }) {
  return (
    <div className="playbook-prose" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.65, maxWidth: measure }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const raw = href ?? '';
            // Bare slug → in-playbook link; absolute/anchor/mailto pass through. Protocol-relative
            // (`//host`) is treated as external so it carries rel="noreferrer".
            const to = /^(https?:|\/|#|mailto:)/.test(raw) ? raw : `/playbook/${raw}`;
            const external = /^https?:/.test(to) || to.startsWith('//');
            return (
              <a
                href={to}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
