# FB-022 — Strip DRAFT banners from rendered content (and guard against recurrence)

**Phase:** 1 · **Depends on:** FB-016, FB-017 · **Repo:** fountainbridge
**Branch:** `fb-022-strip-draft-banners` · One ticket = one branch = one PR.

## Why this matters (for the founder)
When you sign in, the story and playbook pages currently show a grey box that says "DRAFT copy
— placeholder to show the layout." It's an internal note that was never meant for your eyes, and
it makes the studio feel unfinished. This removes those notes everywhere and puts a tripwire in
place so one can never sneak back in.

## Context
FB-016/FB-017 seeded the Foundry story and "how it works" pages with **original draft copy**
deliberately marked with a placeholder blockquote, e.g. in `content/foundry/00-hero.md:8`:

> **DRAFT copy — placeholder to show the layout. Replace in the UI/UX review.**

Those markers exist across `content/foundry/*.md` (and any similar `content/**` files). They were
a scaffolding aid for John's layout review — but they render verbatim to signed-in founders,
which is not acceptable now the pages are live. Removing them by hand is easy; keeping them out
permanently needs a guard.

## Scope
- Remove every DRAFT placeholder blockquote/line from **all** `content/**` markdown (currently
  `content/foundry/00-hero.md`, `01-what-foundry-is.md`, `02-why-founders-choose-foundry.md`,
  `03-how-and-cta.md`; sweep the whole `content/` tree, not just `foundry/`). The surrounding
  original copy stays — only the DRAFT marker lines go.
- Add a **guard** so a `DRAFT`-marker line can never ship in rendered content again: a test (or
  lint step wired into CI) that scans `content/**/*.md` and fails if any line matches the DRAFT
  marker pattern (case-insensitive `DRAFT`-as-placeholder marker). Prefer a test alongside the
  existing `lib/__tests__/content.test.ts` so it runs in the normal `lint + typecheck + test` CI.
- Keep the pattern narrow enough not to false-positive on legitimate prose that happens to
  contain the word "draft" (match the marker form, e.g. a blockquote beginning "DRAFT copy" /
  "DRAFT — replace"), and document the pattern in a comment so future authors know the rule.

## Out of scope
- Rewriting the draft copy into final copy (that is John's UI/UX-review pass, a later ticket).
- Content outside `content/**` (tickets, docs, source PDFs legitimately discuss "draft").

## Acceptance criteria
- [ ] No DRAFT placeholder markers remain in any `content/**/*.md` file.
- [ ] A CI-run guard fails if a DRAFT-marker line is reintroduced (proven by a fixture that the
      test rejects).
- [ ] The guard does not false-positive on ordinary prose containing the word "draft."
- [ ] Signed-in founder pages (story, how-it-works, playbook) render with no placeholder banner.

## Verification
/review + /qa + the new content guard test, run under CI.
