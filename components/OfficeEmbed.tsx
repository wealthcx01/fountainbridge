'use client';

import { useEffect, useState } from 'react';

/**
 * The real office, embedded read-only (FB-163, gap G6).
 *
 * ## What a founder sees
 *
 * FB-139's plate says *"Build is working"*. This says *"Build walked over, sat down and started
 * typing four seconds ago"* — animated pixel-art agents on the venture's own machine, driven by the
 * Claude sessions the lane is actually running.
 *
 * ## Read-only, and where that is enforced
 *
 * Not here. `sandbox` and `pointer-events` are comfort, not a gate — the real one is in `server.js`,
 * which forwards exactly one message from the browser to the box (`webviewReady`, the handshake) and
 * drops everything else. It has to be a filter rather than a setting because the box accepts
 * `closeAgent` from any connection: only the hooks install is token-gated upstream, so a viewer who
 * could talk to the box could remove agents from the office.
 *
 * The iframe is still sandboxed, because two locks on a door that must never open is not excessive.
 *
 * ## When it cannot be shown
 *
 * The plate takes over. It is a drawing, it says so in its own header, and it is honest about a
 * venture with no box — which is every venture that has not been provisioned. This component never
 * shows an empty frame in place of it.
 */
export function OfficeEmbed({
  src,
  fallback,
}: {
  /** The studio's own path, with a short-lived token naming the venture. Never the box's address. */
  src: string;
  /** FB-139's plate, rendered by the server and handed in — not a second implementation of it. */
  fallback: React.ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'live' | 'unreachable'>('loading');

  // A frame that never loads must not sit there empty. The office is one HTTP fetch away from
  // being knowable, so the studio asks before it draws — the same read the frame is about to do,
  // through the same proxy, so the two cannot disagree.
  useEffect(() => {
    let cancelled = false;
    const probe = new URL(src, window.location.origin);
    probe.pathname = probe.pathname.replace(/\/$/, '') + '/api/health';
    fetch(probe.toString(), { cache: 'no-store' })
      .then((r) => { if (!cancelled) setState(r.ok ? 'live' : 'unreachable'); })
      .catch(() => { if (!cancelled) setState('unreachable'); });
    return () => { cancelled = true; };
  }, [src]);

  if (state !== 'live') {
    return (
      <div data-testid="office-embed-fallback" data-office-state={state}>
        {fallback}
      </div>
    );
  }

  return (
    <section data-testid="office-embed" style={{ marginBottom: '1.5rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
        <span className="eyebrow-id">The office</span> — live from your venture&rsquo;s own machine
      </p>
      <iframe
        src={src}
        title="Your venture's office — your team at work on its own machine"
        data-testid="office-frame"
        // `allow-scripts` and nothing else. No same-origin, so the frame cannot reach the studio's
        // cookies; no forms, no popups, no top-level navigation.
        sandbox="allow-scripts"
        loading="lazy"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 'var(--content-narrow)',
          height: '19rem',
          border: '1px solid var(--color-border)',
          background: 'var(--color-paper-sunken)',
        }}
      />
      <p className="muted" data-testid="office-embed-note" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0', maxWidth: 'var(--content-narrow)' }}>
        Each figure is one of your team at work on this venture&rsquo;s own machine. You are watching; nothing here
        can be changed from the studio.
      </p>
    </section>
  );
}
