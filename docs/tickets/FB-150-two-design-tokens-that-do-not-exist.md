# FB-150 — Two design tokens that do not exist, used on four screens

**Status:** Todo · **Area:** Studio / design system · **Depends on:** —

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

- [ ] No component references a custom property that `app/globals.css` does not define.
- [ ] `design-lint` fails when one does, with the property named.
- [ ] A text input in the composer has a visible border, asserted by a computed-style check rather
      than by `toBeVisible()`.
