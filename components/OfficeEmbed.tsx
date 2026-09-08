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
 * Not here. `sandbox` is comfort, not a gate — the real one is the gate on the venture's own box
 * (`deploy/office/office-gate-lib.mjs`), which forwards exactly one message from the browser
 * (`webviewReady`, the handshake) and drops everything else. It has to be a filter rather than a
 * setting because pixel-agents accepts `closeAgent` from any connection: a viewer who could talk to
 * the box could remove agents from the office.
 *
 * That filter used to run in the studio. It moved to the box in FB-198, when the browser started
 * watching directly — Railway's edge will not carry a WebSocket for the studio (FB-197). It is the
 * same single lock, one step further along, and it is tested by trying to break it.
 *
 * The frame is sandboxed and cross-origin, so the office's code — which is upstream code we do not
 * write — cannot reach the studio's cookies or its server actions.
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
  socket,
  fallback,
}: {
  /** The office's page on the venture's own box, with a short-lived ticket the studio signed. */
  src: string;
  /** The office's live socket on that box, for the check below. */
  socket: string;
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
  const [socketHref] = useState(socket);

  // A frame that never loads must not sit there empty, so the desk asks before it draws — and it
  // asks from HERE, in the browser, which is the whole lesson of FB-193.
  //
  // That ticket's check ran on the studio. It answered "ready" on a day when the office was
  // unusable, because it proved the STUDIO could reach the box and said nothing about whether a
  // founder could. A founder got a frame that said "Loading…" for ever. Only the browser knows the
  // leg that matters, so the browser is what opens a socket and waits for the office to say
  // something.
  //
  // One real message is the bar. A handshake proves the door opens, not that anything is behind it.
  //
  // The width is asked first and the frame is never mounted on a phone, rather than mounted and
  // hidden: a hidden iframe still loads the app and still holds a socket open, and a founder on a
  // train would pay for a room they cannot see.
  useEffect(() => {
    const wideEnough = window.matchMedia('(min-width: 40rem)');
    let cancelled = false;
    let probe: WebSocket | null = null;
    let giveUpAt: ReturnType<typeof setTimeout> | null = null;

    // Answered once, by the first thing that happens.
    //
    // Without the guard the answer overwrites itself: the office replies, `settle('live')` closes
    // the probe because the question has been answered, closing it fires `onclose`, and `onclose`
    // says unreachable. Seen in a browser against a working office — the frame connected, the room
    // replied, and the desk drew the plate anyway.
    let settled = false;
    const settle = (next: 'live' | 'unreachable') => {
      if (cancelled || settled) return;
      settled = true;
      if (giveUpAt) clearTimeout(giveUpAt);
      // The question is answered; the connection was only ever the asking of it. The frame opens
      // its own.
      try { probe?.close(); } catch { /* already gone */ }
      setState(next);
    };

    const look = () => {
      settled = false;
      if (!wideEnough.matches) { setState('pocket'); return; }
      try {
        probe = new WebSocket(socketHref);
      } catch {
        setState('unreachable');
        return;
      }
      // The office says nothing until it is asked. The box's gate asks on our behalf the moment it
      // connects, so this only has to listen — but it says it too, because a probe that depends on
      // someone else's courtesy is a probe that breaks quietly.
      probe.onopen = () => { try { probe?.send(JSON.stringify({ type: 'webviewReady' })); } catch { /* closing */ } };
      probe.onmessage = () => settle('live');
      probe.onerror = () => settle('unreachable');
      probe.onclose = () => settle('unreachable');
      giveUpAt = setTimeout(() => settle('unreachable'), 8_000);
    };

    look();
    // A window dragged narrow is the same case as a phone, and a window dragged wide should get the
    // office without a reload.
    wideEnough.addEventListener('change', look);
    return () => {
      cancelled = true;
      if (giveUpAt) clearTimeout(giveUpAt);
      try { probe?.close(); } catch { /* already gone */ }
      wideEnough.removeEventListener('change', look);
    };
  }, [socketHref]);

  if (state !== 'live') {
    return (
      <div data-testid="office-embed-fallback" data-office-state={state}>
        {fallback}
      </div>
    );
  }

  return (
    <section data-testid="office-embed" className="office-embed">
      {/* FB-203, item 7: the section above carries the heading now, so this is the live label
          alone — and it renders here because this is the only place that knows the real room is on
          the screen rather than the drawing. */}
      <p className="office-live" data-testid="office-live-label">
        <span className="office-live-dot" aria-hidden="true" />
        Live from your venture&rsquo;s own machine
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
