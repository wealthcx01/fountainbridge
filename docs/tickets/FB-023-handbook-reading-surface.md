# FB-023 — Handbook reading surface (/handbook index + chapter pages)

**Phase:** 1 · **Depends on:** FB-015, FB-013 (content mechanism); handbook chapter content in
`content/handbook/*.md` · **Repo:** fountainbridge
**Branch:** `fb-023-handbook-reading-surface` · One ticket = one branch = one PR.

## Why this matters (for the founder)
This is your plain-English guidebook — how to start, build, sell, and scale your venture, and how
Bruntsfield works alongside you. This ticket builds the place to read it: a clean contents page
and readable chapters, just like the Playbook. (The words themselves are written separately; this
is the shelf they sit on.)

## Context
An 8-chapter handbook is being authored in `content/handbook/*.md`
(`01-how-to-start` … `08-bruntsfield-playbook`). At time of writing, chapters `01`–`04` exist
(`01-how-to-start`, `02-how-to-build`, `03-how-to-sell`, `04-how-to-scale`) and `05`–`08` are
being written. The studio already has a proven content mechanism: `lib/content.ts`
(`loadContentSections`) → a thin per-collection loader (`lib/playbook.ts`) → an index page
(`app/playbook/page.tsx`) → `app/playbook/[slug]/page.tsx` rendering via
`components/PlaybookProse.tsx`. This ticket mirrors that mechanism for the handbook. **The chapter
copy is authored separately** — this ticket is the surface + wiring + tests, and must render
whatever chapters are present without hard-coding a fixed count.

## Scope
- **Loader:** a `lib/handbook.ts` mirroring `lib/playbook.ts` — a thin wrapper over
  `loadContentSections(content/handbook)` returning ordered sections (with a `getHandbookSection`
  by slug). No new rendering primitive — reuse the shared content loader.
- **Index page** `app/handbook/page.tsx`: numbered chapter cards mirroring the `/playbook` index
  (`data-testid="handbook-index"`, `pb-`-style per-card testids adapted to `hb-`), private
  (`auth()` self-guard + redirect to `/login`, as `/playbook` does).
- **Chapter page** `app/handbook/[slug]/page.tsx`: renders the chapter markdown via the existing
  `PlaybookProse` mechanism (rename/generalise only if trivially clean; otherwise reuse as-is),
  private, mobile-usable, grassmarket branding.
- **Nav:** add a `{ href: '/handbook', label: 'Handbook' }` entry to `NAV` in `app/layout.tsx`.
- **Renders what exists:** the surface must handle whatever chapters are present (4 today, 8 when
  authored) with no hard-coded chapter list.
- **e2e:** `e2e/handbook.spec.ts` mirroring `e2e/playbook.spec.ts` — index lists chapters, a
  chapter page renders, and (per FB-015) both redirect to `/login` when signed out.

## Out of scope
- Writing/editing the handbook chapter copy (authored separately).
- Any public exposure — private like the rest of the studio (FB-015).
- New markdown-rendering primitives beyond the existing content/PlaybookProse mechanism.

## Acceptance criteria
- [ ] `/handbook` lists every chapter present in `content/handbook/` as numbered cards, in order.
- [ ] `/handbook/[slug]` renders each chapter's markdown via the existing content mechanism.
- [ ] A new chapter file (e.g. `05-…`) appears automatically with no code change.
- [ ] "Handbook" appears in the top nav for signed-in users.
- [ ] Both routes are private (redirect to `/login` when signed out) and mobile-usable.
- [ ] `e2e/handbook.spec.ts` covers index, a chapter, and the signed-out redirect.

## Verification
/review + /qa + UI-gate + `e2e/handbook.spec.ts`.
