# FB-141 — The pocket studio as an app, and one push (gap G8)

**Status:** Shipped in part ·  **Area:** Studio / mobile · **Depends on:** FB-138
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

## The transport decision, as the ticket asked

**Web Push with VAPID keys held by the studio**, not a third-party service.

- A service would mean every "you are the blocker" notification for every venture passing through
  somebody else's infrastructure, carrying a venture name and a count. That is a founder's operational
  state leaving Bruntsfield's control for a feature whose entire value is one buzz a day.
- VAPID is two keys, one of them public. The private half is one more secret in the venture's
  deployment environment, which is where every other secret already lives (CLAUDE.md #8).
- Both iOS Safari 16.4+ and Android Chrome speak it. There is no capability argument for a service.

**iOS has a gate, and it changes the onboarding copy.** Safari will not accept a subscription at all
until the PWA has been **added to the home screen** — so the sequence is install, then ask. A founder
on an iPhone who is asked for permission in a browser tab gets a prompt that cannot be honoured. That
is why the manifest and icons shipped first and the asking has not.

## Subscriptions need a home, and there isn't one

A push subscription is a per-device endpoint and a pair of keys. It is:

- **not venture repo content** — D8 covers `context/` and `library/`, which are things a founder
  hands over. A device secret is neither, and committing one to git would put it in permanent history;
- **not environment configuration** — it is per founder, per device, and it changes.

So it needs a store the studio does not have. D6 names Supabase and it is unused. **This is the same
missing piece FB-164 names**, arrived at from the other direction, and the two should be decided
together rather than each growing its own answer.

Until then, **nothing asks for permission**. A permission prompt the studio cannot honour is worse
than no prompt: it spends the one moment a founder is willing to say yes.

## Acceptance criteria

- [x] The pocket studio installs to the home screen. The manifest, the icons and the service worker
      are served and correct — see below for what a headless browser can and cannot prove.
- [x] Exactly one push fires when the queue goes from zero to non-zero, and none for subsequent items
      in the same run — `shouldNotify`, pinned by test. Nine decisions must not be nine buzzes: a
      phone that buzzes nine times is a phone whose owner turns notifications off, which loses the
      one notification that mattered.
- [x] The first look at a queue never pushes. A founder installing the studio and immediately being
      buzzed about a week-old backlog is a notification about the past, and it teaches them the buzz
      does not mean "something just happened".
- [x] The push opens the queue, filtered — not the desk. A founder woken by a buzz has one question.
- [x] The push says nothing about **what** is waiting. A lock screen is read by whoever is holding the
      phone.
- [ ] No other event pushes. The rule is written and tested; there is no sender to assert it against
      yet.
- [ ] Permission is requested after a first decision, not on first load. **Deliberately not built** —
      see above.
- [ ] Opting out is one press and survives a restart.
- [ ] A subscription cannot receive another venture's push.
- [ ] Installed and driven on a real iOS and a real Android device. **I have neither.** Everything a
      phone reads before it decides is asserted in `e2e/pwa.spec.ts`; whether iOS then adds it is a
      question only a phone answers.

## What shipped

- `app/manifest.ts` — `standalone`, not `fullscreen`: a founder deciding something should still be
  able to see the time and their battery. `start_url` is `/`, never a venture — an icon is not a
  session, and isolation is decided per request (CLAUDE.md #6).
- Generated icons (`scripts/make-icons.mjs`), including a **maskable** one padded inside the safe
  zone so Android's circle crop cannot clip it. The mark is a placeholder, not the brand's.
- `public/sw.js`, which caches **almost nothing** and is written as an allow-list. A service worker
  that cached responses would be the single most dangerous file in this repository: every interesting
  page is venture- and session-scoped, and a cache in front of that can serve one founder's desk to
  the next person to open the app on a shared device. A deny-list would need updating for every new
  route, and the cost of forgetting is a founder seeing another founder's work.
- The installable shell is **public** in the middleware, anchored per file. A phone fetches the
  manifest and icons without a session; behind the gate they redirect to `/login`, the OS reads HTML
  where it expected JSON, and the install silently fails.
- `lib/brand.ts` — the two colours iOS and Android read, which cannot be CSS variables, in one
  declared place with a test asserting they still equal the tokens they copy.

## For John, to finish it

The install is the part a device has to answer. On an iPhone: open the studio in Safari, Share → **Add
to Home Screen**, and check it opens without browser chrome and shows the dark green status bar. On
Android, Chrome should offer **Install app** on its own.

If the icon looks wrong, `node scripts/make-icons.mjs` regenerates it from the tokens — the mark in
there is deliberately plain and is waiting for the brand's own.
