# FB-141 — The pocket studio as an app, and one push (gap G8)

**Status:** Shipped in part · **Area:** Studio / mobile · **Depends on:** FB-138
**Design:** `docs/design/foundry-desk/` — screen 11: *"a push arrives the moment they become the blocker."*
**Gap:** G8.

**Shipped in part:** the push is built end to end and tested, but no real phone has received one yet.
Three things stand between this and a buzz on a founder's phone, and all three are John's: set the
keys, apply the database change, and start a timer that rings the studio every few minutes. Then
install the studio on a real iPhone and a real Android phone and watch one push arrive. See
"For John, to finish it" at the bottom.

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
is why, on an iPhone in a browser tab, the studio says how to install instead of asking.

## Where a phone's subscription lives (decided in the second pass)

A push subscription is a per-device address and a pair of keys. It is not venture repo content —
committing one to the repository would put a device secret in permanent history — and it is not
environment configuration, because it is per founder, per device, and it changes.

The studio now has a database (FB-170), so subscriptions live there, in their own schema,
`pushstore` (`db/005_push.sql`):

- **One row per phone, per venture.** A phone that subscribed to two ventures is two rows.
- **Only the studio reads them**, and only one venture at a time. The same row-level security as
  every other studio table: a connection scoped to ARCA cannot see, write or remove a phone saved
  under The Reset. Proven against real Postgres in `lib/__tests__/push-store.test.ts`.
- **Never dropped.** Unlike the read model, nothing rebuilds a subscription. If it is lost, the
  founder silently stops being told — so the file says, in words, never drop this.
- The same schema keeps **what the queue looked like last time**, per venture. That is what turns a
  count into a *transition*: "nothing last time, something now" is the one moment a phone buzzes.

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
- [x] No other event pushes. There is now exactly one sender, `checkQueue` in `lib/push-send.ts`,
      and it takes a **count**, not a message — there is no parameter through which a caller could
      send anything other than "you are the blocker". A test fails if `sendWebPush` is ever called
      from any other file.
- [x] Permission is requested after a first decision, not on first load. Every approve, refuse,
      accept, send-back and routine decision passes through `noteDecision`, and so do letting a
      held plan go ahead and filing a plan; only after one of those does a small card ask. A test
      fails if a decision button skips it. A browser test (`e2e/push-pocket.spec.ts`, on a phone
      size) checks no card on first load, the card after a decision, "Not now" sticking after a
      reload, and that pressing "Turn on" where the phone cannot be kept says so in words.
- [x] Opting out is one press and survives a restart. "Not now" and "Turn it off" are remembered
      on the device and the server forgets the phone. The studio never asks again on that device.
      The Tickets screen's "Needs you" list — where every buzz lands — keeps one quiet line to turn
      it back on.
- [x] A subscription cannot receive another venture's push. The database itself enforces it, and
      a test proves a push for ARCA never reaches a phone that only subscribed to The Reset.
- [ ] Installed and driven on a real iOS and a real Android device. **Not done — no device here.**
      Everything a phone reads before it decides is asserted in `e2e/pwa.spec.ts`; the push itself
      is checked byte for byte against the published standard's worked example (RFC 8291). Whether
      Apple's and Google's push services then deliver it is a question only a phone answers.

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

### Second pass: the push itself

- **Sending, with no third-party library** (`lib/webpush.ts`). Encrypting for one phone (RFC 8291)
  and signing with our key (RFC 8292, "VAPID") are both short, both published standards, and both
  come with worked examples. The encryption test reproduces the standard's example byte for byte.
  The studio only ever posts to Apple's, Google's, Mozilla's or Microsoft's push services — any other
  address is refused when it is saved and again when it is used. It never follows a redirect, and it
  gives up after ten seconds.
- **The heartbeat** (`app/api/push/check`). The studio only works when somebody asks it to, and a
  founder who is the blocker is by definition not looking. So a timer outside calls this every few
  minutes with a secret in a header. For each venture it reads the same number the rail's badge
  shows (FB-149: open work plus sends waiting on the founder), compares it with last time, and
  pushes only on "nothing → something". A queue the studio could not fully read counts as
  *unknown*, never zero — otherwise the next good read would fake a transition and buzz a founder
  about work that had been waiting all along.
- **The asking** (`components/PushSwitch.tsx`, rules in `lib/push-offer.ts`). After a decision, a
  card at the foot of the screen: *"Want a buzz when something needs you?"* On an iPhone in a
  browser tab it says how to add the studio to the Home Screen instead, because an iPhone will not
  accept the request anywhere else. If the browser or the server refuses, the card says which.
- **The words of the push** say which venture and how many, never what. A lock screen is read by
  whoever holds the phone. Pressing it opens Tickets, filtered to "Needs you".

## Verified on production, unauthenticated

Fetched the way an operating system fetches them — no session, no redirect followed:

```
/manifest.webmanifest    200  application/manifest+json
/icon-192.png            200  image/png
/icon-512.png            200  image/png
/apple-touch-icon.png    200  image/png
/sw.js                   200  application/javascript

name          Bruntsfield Foundry Studio
short_name    Foundry
start_url     /
display       standalone
theme_color   #1a3b26
```

That is everything a phone reads before it offers to install. What it does next is the part only a
phone can answer.

## For John, to finish it

Four things, in this order. None of them is a code change.

1. **Make the keys.** `npx web-push generate-vapid-keys` prints a pair. Set `VAPID_PUBLIC_KEY` and
   `VAPID_PRIVATE_KEY` on the Railway studio service, and `VAPID_SUBJECT` to a `mailto:` address the
   push services can write to if something goes wrong. Never in the repository.
2. **Apply `db/005_push.sql`** to the studio's Supabase database, the same way 001–004 were applied.
3. **Start the timer.** Set `PUSH_CHECK_SECRET` (random, at least 16 characters) on the studio, and
   have something call `POST /api/push/check` with `Authorization: Bearer <that secret>` every five
   minutes — a Railway cron service or a scheduled workflow both work. Without the timer nothing is
   ever sent. The studio does not offer the buzz at all until the keys and the database are both
   set, so nobody is asked for something that cannot work.
4. **Try it on a phone.** On an iPhone: open the studio in Safari, Share → **Add to Home Screen**,
   open it from there, decide something, and press "Turn on notifications". On Android, Chrome should
   offer **Install app** on its own. Then become the blocker — exactly one push should arrive and
   open the "Needs you" list. Clear the queue, become the blocker again: one more. Never two for one
   transition.

If the icon looks wrong, `node scripts/make-icons.mjs` regenerates it from the tokens — the mark in
there is deliberately plain and is waiting for the brand's own.
