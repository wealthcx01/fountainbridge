# FB-150 — Two design tokens that do not exist, used on four screens

**Status:** Done · **Area:** Studio / design system · **Depends on:** —

## What happens

`--color-rule` and `--color-surface` are referenced by four components and are **defined nowhere** —
not in `app/globals.css`, not in any other stylesheet:

```
$ grep -c -- "--color-rule:" app/globals.css
0
```

An undefined custom property makes the whole declaration *invalid at computed-value time*, so:

- `border: 1px solid var(--color-rule)` computes to **no border**
- `background: var(--color-surface)` computes to **transparent**

Every text input and textarea in the studio is therefore an unbordered strip on the page's own
ground colour. It has been that way since the components were written, and nothing caught it:
`design-lint` checks that colours come from tokens, not that the tokens resolve, and the e2e asserts
`toBeVisible()`, which a borderless input passes.

Found by the `/review` pass on FB-128 (PR #163), which fixed the one instance it introduced
(`components/PromptBar.tsx`) and left the rest rather than widening that PR.

## Scope

- Replace both names with the tokens that exist — `--color-border` and `--color-paper-raised` — in
  `components/Composer.tsx`, `components/WorkDetail.tsx` and `components/PlanPanel.tsx`.
- **Make `design-lint` fail on a custom property that is never defined.** The substitution is the
  real fix; the check is what stops the next one, and this is the third class of thing that was green
  because nothing was looking at it.

## Out of scope

- Any change to what the inputs look like beyond having a border again. If a different treatment is
  wanted, that is a design decision and its own ticket.

## Acceptance criteria

- [x] No component references a custom property that `app/globals.css` does not define.
- [x] `design-lint` fails when one does, with the property named.
- [x] A text input in the composer has a visible border, asserted by a computed-style check rather
      than by `toBeVisible()`.

## What shipped

- The three components now use `--color-border` and `--color-paper-raised`. The composer's text
  box, its folded-away ticket draft, the plan panel's lines and a piece of work's full record all
  have their border back.
- `design-lint` has a new rule, `undefined-token`. It collects every custom property the studio
  defines — in `app/globals.css`, set inline on an element, or handed over by next/font in
  `app/layout.tsx` — and fails on any `var(--name)` that is none of those, naming it:
  `components/Composer.tsx:328  undefined-token  --color-rule is used here but defined nowhere`.
  Run against the old components it found exactly the seven uses this ticket describes.
- `e2e/composer.spec.ts` reads the border and background the browser actually drew on the text box
  and compares them with what the two tokens resolve to. On the old code it fails with "the box has
  no border" (the browser reported `none`).

One limit: a name built while the page runs, like `var(--tone-${tone})` in `lib/status.ts`, cannot
be checked from the text, so the rule skips it. That file's own test covers every tone it makes.
