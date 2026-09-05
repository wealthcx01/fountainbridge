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
 *
 * ## Not on a phone
 *
 * The plate takes over there too, and that is a decision rather than a shortcut. pixel-agents draws
 * its room at a fixed scale and does not shrink it to fit: at 393px the room is wider than the
 * screen, so a phone shows a corner of a floor and part of a sofa, at every frame height that was
 * tried. A fragment of a room tells a founder nothing.
 *
 * It also keeps the pocket studio what FB-160 decided it should be — the four things a founder can
 * act on, and a live animation is not one of them.
 */
export function OfficeEmbed({
  src,
  readyHref,
  fallback,
}: {
  /** The studio's own path, with a short-lived token naming the venture. Never the box's address. */
  src: string;
  /** Where the studio answers whether the office socket actually holds (FB-193). */
  readyHref: string;
  /** FB-139's plate, rendered by the server and handed in — not a second implementation of it. */
  fallback: React.ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'live' | 'unreachable' | 'pocket'>('loading');

  // The address the frame keeps for as long as it is on the screen.
  //
  // Rounding the token's expiry (OFFICE_TOKEN_STEP_MS) already stops the usual churn, but it only
  // narrows the window: a desk open across a step boundary would still be handed a new `src`, and a
  // new `src` reloads the frame, closes the socket and redraws the room. There is no reason for a
  // frame that is already connected to be restarted because the page around it re-rendered.
  //
  // So the first address wins for the life of the mount. If the office does need a fresh token —
  // after a very long sitting, if the socket ever drops and cannot get back in — the founder
  // reloads the page, which is what they would do anyway on seeing an empty room.
  const [frameSrc] = useState(src);

  // A frame that never loads must not sit there empty, so the studio asks before it draws.
  //
  // FB-193: it used to ask the box for one HTTP file. That answered 200 on a day when the socket was
  // dying five milliseconds after every handshake, and a founder got a frame that said "Loading…"
  // for ever — strictly worse than the plate it replaced. `office-ready` asks the question the frame
  // actually depends on: it opens the office socket from the studio and waits for the office to say
  // something. The plate is the answer whenever it does not.
  //
  // The width is asked first and the frame is never mounted on a phone, rather than mounted and
  // hidden: a hidden iframe still loads the app and still holds a socket open, and a founder on a
  // train would pay for a room they cannot see.
  useEffect(() => {
    const wideEnough = window.matchMedia('(min-width: 40rem)');
    let cancelled = false;

    const look = () => {
      if (!wideEnough.matches) { setState('pocket'); return; }
      fetch(readyHref, { cache: 'no-store' })
        .then((r) => r.json())
        .then((body: { ready?: boolean }) => { if (!cancelled) setState(body?.ready ? 'live' : 'unreachable'); })
        .catch(() => { if (!cancelled) setState('unreachable'); });
    };

    look();
    // A window dragged narrow is the same case as a phone, and a window dragged wide should get the
    // office without a reload.
    wideEnough.addEventListener('change', look);
    return () => { cancelled = true; wideEnough.removeEventListener('change', look); };
  }, [readyHref]);

  if (state !== 'live') {
    return (
      <div data-testid="office-embed-fallback" data-office-state={state}>
        {fallback}
      </div>
    );
  }

  return (
    <section data-testid="office-embed" className="office-embed">
      <p className="eyebrow office-embed-title">
        <span className="eyebrow-id">The office</span> — live from your venture&rsquo;s own machine
      </p>
      {/*
        A window onto the room, not the room's own viewport.

        pixel-agents draws its office low and left inside whatever space it is given, and fills the
        rest with empty background. Given enough height to show the whole room — about 44rem — over
        a third of that height is nothing at all. So the frame is tall and the window over it is
        short: the studio clips the dead space instead of buying it, and a founder sees the room and
        no padding. `.office-embed-window` holds the height a reader pays for; the offset in
        `.office-embed-frame` is what is scrolled past.
      */}
      <div className="office-embed-window">
        <iframe
          src={frameSrc}
          title="Your venture's office — your team at work on its own machine"
          data-testid="office-frame"
          className="office-embed-frame"
          // `allow-scripts` and nothing else. No same-origin, so the frame cannot reach the studio's
          // cookies; no forms, no popups, no top-level navigation.
          sandbox="allow-scripts"
          loading="lazy"
        />
      </div>
      <p className="muted office-embed-note" data-testid="office-embed-note">
        Each figure is one of your team at work on this venture&rsquo;s own machine. You are watching; nothing here
        can be changed from the studio.
      </p>
    </section>
  );
}
