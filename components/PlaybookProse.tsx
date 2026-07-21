'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders playbook markdown. Bare-slug links in the content (e.g. `[moats](moats)`) are rewritten to
// `/playbook/<slug>` so cross-links work from any route; external/absolute/anchor links pass through.
export function PlaybookProse({ body }: { body: string }) {
  return (
    <div className="playbook-prose" style={{ fontSize: '16px', lineHeight: 1.65, maxWidth: '46rem' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const raw = href ?? '';
            const to = /^(https?:|\/|#|mailto:)/.test(raw) ? raw : `/playbook/${raw}`;
            const external = /^https?:/.test(to);
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
