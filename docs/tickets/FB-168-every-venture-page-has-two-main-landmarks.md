# FB-168 — every venture page has two `<main>` landmarks

**Status:** Open · **Phase:** 3 · **Found by:** FB-156, on production

## What is wrong

`document.querySelectorAll('main').length === 2` on `/venture/arca`, `/venture/arca/tickets` and
`/venture/arca/knowledge` in production, with one `<main>` nested inside the other:

```
1) <main class="main">…</main>
2) <main>…</main>          ← inside (1)
```

A page has one main region. Two — nested — means a screen-reader user navigating by landmark finds a
"main" inside the main, and assistive technology has no way to tell which one is the content. It is
the same class of defect as the two navigations FB-124 shipped, which is the reason the Playwright UI
gate became a required check in the first place (CLAUDE.md #2, amended 2026-08-28).

It also silently breaks tooling: `page.locator('main')` is a strict-mode violation, so any check
written against it throws rather than measures. That is how this was found — a verification script
failed on the selector, not on the thing it was checking.

## Scope

- Find which layout or component contributes the second `<main>` and make it a `<div>` or a
  `<section>` with an appropriate heading.
- A UI-gate assertion, on every route the gate already walks, that there is exactly **one** `<main>`.
  The nav-count check that exists after FB-124 is the model — this is the same rule for the other
  landmark, and the same lesson.

## Acceptance criteria

- [ ] Exactly one `<main>` on every route in the UI gate, desktop and phone.
- [ ] Adding a second one turns the gate red.
