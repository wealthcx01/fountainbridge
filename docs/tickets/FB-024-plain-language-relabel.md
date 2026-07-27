# FB-024 — Plain-language relabel of founder-facing UI

**Phase:** 1 · **Depends on:** FB-006, FB-007 · **Repo:** fountainbridge
**Branch:** `fb-024-plain-language-relabel` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The studio currently uses engineering words — "PR open," "lane," "the workshop never merges." You
shouldn't need to know what a pull request is to run your company. This ticket swaps the developer
jargon for plain English on the screens you see, without changing anything about how the work
actually happens underneath.

## Context
The founders are **non-technical**. Several founder-facing labels leak git/GitHub vocabulary:
- The venture board column is literally **"PR open"** (`components/VentureBoard.tsx:13`).
- The lanes view is titled **"Lanes"** (`app/lanes/page.tsx:22-23`).
- System copy reads **"the workshop never merges, so each one needs a human"**
  (`app/attention/page.tsx:28`, `lib/attention.ts:3`).

The **git/PR reality underneath stays exactly the same** (non-negotiable 2: never merge; PRs are
real). We change only the words the founder reads. To keep terms consistent across the app,
introduce a small shared glossary rather than editing strings ad hoc.

## Scope
- **Glossary/config:** a single source of founder-facing terms (e.g. `lib/glossary.ts` — a small
  typed map) so the same concept always shows the same words. Proposed mappings (confirm wording
  with John at review):
  - "PR open" → **"In review (needs your OK)"**
  - "lane" / "Lanes" → **"workstream" / "Workstreams"** (agreed term)
  - "the workshop never merges …" → soften to plain reassurance, e.g. "Nothing goes live until
    you approve it." — keep the *meaning* (human approval required), drop the jargon.
- **Apply the glossary** to the founder-facing surfaces: the board column
  (`components/VentureBoard.tsx`), the lanes/workstreams page (`app/lanes/page.tsx` heading +
  eyebrow), and the attention-queue copy (`app/attention/page.tsx`, plus the human-facing string
  in `lib/attention.ts` if it surfaces to the UI).
- **Do not** rename routes, data model fields, test ids, or internal identifiers — only the
  visible labels/copy. Keep `data-testid`s stable so e2e keeps passing (update expected *text*
  in specs where a spec asserts on visible copy).
- Update any e2e assertions that check the old visible strings.

## Out of scope
- Changing PR/merge behaviour (non-negotiable 2 stands — this is labels only).
- Renaming routes (`/lanes` stays as a URL; only its display label changes) or contract/type
  field names (bcap-contracts terms are unchanged).
- A full copy rewrite of every page (targeted relabel of the jargon called out here).

## Acceptance criteria
- [ ] A single glossary/config holds the founder-facing terms; screens read from it.
- [ ] Board column reads "In review (needs your OK)" (or the agreed wording), not "PR open."
- [ ] "Lane"/"Lanes" reads as the agreed plain term everywhere it's shown to founders.
- [ ] The "workshop never merges" system copy is softened to plain language while preserving the
      meaning (human approval required before anything goes live).
- [ ] No route, test id, or contract field renamed; e2e still green (with updated text assertions).

## Verification
/review + /qa + UI-gate + updated e2e specs.
