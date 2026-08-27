# FB-141 — The pocket studio as an app, and one push (gap G8)

**Status:** Todo · **Area:** Studio / mobile · **Depends on:** FB-138
**Design:** `docs/design/foundry-desk/` — screen 11: *"a push arrives the moment they become the blocker."*
**Gap:** G8.

## Why this matters (for the founder)

The whole studio is built so a founder is never the silent bottleneck. Every part of that works except
the last inch: **nothing tells them.** A founder who is the blocker discovers it next time they open
the studio, which on a bad day is tomorrow.

The design asks for exactly one push, and the restraint is the point:

> A push the moment the founder becomes the blocker. Nothing else pushes; the queue is the only thing
> that waits on a person.

## What is true today

The FB-009 responsive pass, and FB-138's one-column pocket studio. No service worker, no manifest, no
notifications of any kind. The attention queue already knows precisely when a founder becomes the
blocker — it is the number in the rail's badge.

## Scope

- **A PWA shell**: manifest, icons, service worker, installable on iOS and Android.
- **Decide the push transport first, in the ticket.** Web Push with VAPID keys direct from the studio,
  or a service. This is unspecified on the first draft and it determines where subscriptions live,
  what secret the studio holds, and whether iOS is even reachable — Safari requires the PWA to be
  installed to the home screen before it will accept a subscription at all, which changes the
  onboarding copy. Confirm that on a real iPhone before designing the flow around it.
- **Subscriptions are venture-scoped state and need a home.** They are not venture repo content (they
  are per-device secrets), so D8 does not cover them. Say where they live and who can read them.
- **One push event: founder-became-blocker**, fired from the attention queue's transition from zero
  to non-zero. Not per item — per transition, or a founder with nine decisions gets nine buzzes and
  turns them off, which loses the one notification that mattered.
- **Nothing else ever pushes.** Asserted by a test, because this is the kind of rule that erodes one
  well-meant addition at a time.
- **Permission is asked at the right moment** — after a founder has decided something, not on first
  load, when it reads as a website being pushy.
- **Opting out is one press and it sticks.**
- Push subscriptions are per founder per venture and never cross (CLAUDE.md #6).

## Out of scope

- A native app.
- Any other notification: no digests, no "your lane finished", no marketing. One event.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx playwright test
make design-lint && make ticket-drift
```

On a real device before review — a PWA cannot be proven in a headless browser:

```
# install on iOS and Android from the browser
# become the blocker → exactly one push arrives, and opens the queue
# clear the queue, become the blocker again → one more. Never two for one transition.
```

## Acceptance criteria

- [ ] The pocket studio installs to the home screen on iOS and Android.
- [ ] Exactly one push fires when the queue goes from zero to non-zero, and none for subsequent items
      in the same run — asserted by a test.
- [ ] No other event pushes, asserted by a test.
- [ ] The push opens the queue.
- [ ] Permission is requested after a first decision, not on first load.
- [ ] Opting out is one press and survives a restart.
- [ ] A subscription cannot receive another venture's push, asserted by a test.
- [ ] Installed and driven on a real iOS and a real Android device before the PR is opened.
