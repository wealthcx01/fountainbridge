# FB-124 — The hairline pass and the persistent rail

**Status:** Todo · **Area:** Studio / shell · **Depends on:** —
**Design:** `docs/design/foundry-desk/` — screen 3 "Rail"; README §Design tokens.

## Why this matters (for the founder)

Today the studio is a set of pages you navigate between. The design makes it a **desk you keep open**:
one shell that never goes away, with the venture's state — what your agents are doing, what waits on
you, what you have spent — visible on every screen without asking for it.

This ticket is the shell and the look. It ships nothing new to read; it is what the other ten screens
are built inside. Doing it first means no screen is built twice.

## What is true today

Navigation is a pill row. Cards carry `--radius-*` and `--shadow-*`. Every page owns its own header.
There is no persistent surface holding venture state.

The design contract (`docs/studio-design-contract.md`, FB-057) already says tokens only, one status
vocabulary, machine values in mono, no dead UI. That stays; this changes what some of the tokens are.

## Scope

**The look.** Adopt the Bruntsfield hairline system, as the handoff's README specifies:

- `border-radius: 0` everywhere. Inputs may keep 2px.
- No drop shadows. Elevation is carried by 1px `--color-border` rules and `--color-paper-sunken` insets.
- Eyebrows at 11px, tracked, uppercase.
- Serif page summaries around `--fs-h3`, weight 400.
- **The five `--tone-*` colours do not change.** They are the studio's one status vocabulary and every
  screen, badge and dot depends on them meaning the same thing.

`--radius-*` and `--shadow-*` are retired from `app/globals.css` and their five current users
(`components/Composer.tsx`, `TicketDrawer.tsx`, `WorkDetail.tsx`, and `globals.css` itself).

**The rail.** A persistent left column, 250px, sticky full height:

- Wordmark, then the venture name and status.
- Nav: The desk · Tickets · **Needs you** (amber count badge) · What happened · Memory · Handbook.
- Below the nav: the live mini-office plate, per-surface budgets, the engine heartbeat line, the
  pocket-studio link, sign out.

The mini-office is a **placeholder drawing** in this ticket. The live plate is FB-139 (G6). It must
read as deliberately not-yet-live rather than as a broken image.

**Where the rail lives, and how it gets its data.** This was hand-waved on the first draft and is the
first thing that would have stopped work, so it is decided here:

- The rail is **`app/venture/[id]/layout.tsx`**, which does not exist today — `app/layout.tsx` is the
  only layout in the tree. Everything under `/venture/[id]` gets the rail by being a child route.
- **Two of the rail's own nav destinations are currently outside that subtree.** `/activity` and
  `/handbook` are top-level routes. They move to `/venture/[id]/activity` and
  `/venture/[id]/handbook`, with the old paths redirecting — a founder may have either bookmarked.
  `/activity` is also cross-venture today (`loadAccessibleHealth` spans every venture the viewer can
  reach) and becomes venture-scoped; that scope change belongs to FB-132 and is called out there.
- **A layout cannot receive data from its page** in the App Router, so the rail must load its own.
  Wrap the rail's reads in React `cache()` so the layout and the page share one fetch per request
  rather than making two. Two fetches here is precisely the FB-123 failure — a page that got slower
  because something else needed the same data.

**The scoping rule is unchanged.** Every route keeps server-side venture scoping (CLAUDE.md #6).

## Out of scope

- Any screen's content. The rail plus an empty main column is the whole deliverable.
- The live office feed (FB-139) and the mobile layout (FB-138).
- grassmarket. The brand change is studio-only for now, by John's call of 2026-08-27; the two will
  visibly diverge until grassmarket follows, and that is accepted.

## Validation gates

Run these; they must pass before review.

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint          # tokens only, one status vocabulary, no dead UI
make ticket-drift
grep -rn -- "--radius-\|--shadow-" app/ components/ | grep -v "^Binary"   # expect: no output
```

Plus, by eye on the running studio: the rail is present and sticky on every route below `/venture/[id]`,
the "Needs you" badge shows the same number the desk's blocker banner does, and nothing anywhere has a
rounded corner or a shadow.

## Acceptance criteria

- [ ] `--radius-*` and `--shadow-*` no longer exist in `app/globals.css`, and no file references them.
- [ ] The five `--tone-*` values are byte-identical to what they are today.
- [ ] A persistent 250px rail renders on every venture route, sticky, scrolling independently.
- [ ] The rail's "Needs you" badge, the desk's blocker banner and the Tickets "Needs you (N)" filter
      all read from one count and cannot disagree.
- [ ] The rail is a layout at `app/venture/[id]/layout.tsx`; every child route gets it without
      re-declaring it.
- [ ] `/activity` and `/handbook` redirect to their venture-scoped paths; neither 404s.
- [ ] Budgets, the engine heartbeat and the office plate render in the rail, and the layout and the
      page make **one** fetch between them for the same data, asserted by a test that counts reads.
- [ ] The office plate says it is a placeholder, in words, rather than looking like a failed image.
- [ ] `make design-lint` passes, and no raw colour or size literal was added.
- [ ] Venture scoping is unchanged: a founder still cannot reach another venture's rail or its numbers.
