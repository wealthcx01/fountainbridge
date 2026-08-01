# The studio design contract

**FB-057.** What every studio screen must obey so the Foundry Studio reads as one coherent product
rather than a patchwork. Applies to `app/` and `components/`. Enforced by `make design-lint` in CI —
the parts a reviewer would otherwise have to catch by eye, every time, forever.

This is discipline, not a look. It does not tell you what to design; it tells you what not to
reinvent. Adapted from meridian's `ARCHITECTURE.md` token rubric, which is the same idea applied to a
different studio.

## 1. Tokens only

Every colour, type size and radius comes from `app/globals.css` — the single source of truth, pulled
from grassmarket / the Bruntsfield brand and **not invented** (D6, and CLAUDE.md's branding rule).

A component never writes a raw value. `#1a3b26` in a component is a colour that will drift from the
brand the first time the brand moves; `13px` is a value someone chose because it looked right in one
place, which is how six sizes become fourteen.

**The one exception is `1px`.** The hairline rule is an atom of this design system — the whole
paper/ink aesthetic is built from 1px borders — so tokenising it buys a `var()` and no clarity.

### The type scale

The complete scale. If the size you want is not here, the answer is to use the nearest one, not to
add a value inline.

| Token | Size | For |
| --- | --- | --- |
| `--fs-display` | clamp 56–96px | The landing statement |
| `--fs-h1` | clamp 36–56px | Page title |
| `--fs-h2` | clamp 26–34px | Section |
| `--fs-h3` | 22px | Sub-section |
| `--fs-h4` | 18px | Card heading |
| `--fs-subhead` | 15px | Titles *inside* a card — repo names, department names |
| `--fs-body` | 16px | Prose |
| `--fs-body-sm` | 14px | Secondary text, list rows |
| `--fs-meta-lg` | 13px | Supporting detail — check results, next steps |
| `--fs-meta` | 12px | Timestamps, ids, machine values |
| `--fs-eyebrow` | 11px | Kickers, ticket ids on cards |

Layout distances are `rem`, not `px` — they scale with the founder's browser text-size setting, and
a founder who has bumped their default size gets a studio that follows.

## 2. One status vocabulary

Five tones, defined in `lib/status.ts`, wired to colour in `globals.css` as `--tone-*`.

| Tone | Means | Reads as |
| --- | --- | --- |
| `ok` | it worked / healthy / done | bottle green |
| `working` | under way right now | accent |
| `attention` | needs a human, or a next step the founder must take | amber |
| `blocked` | it failed, or cannot proceed | red |
| `idle` | nothing is happening, or we do not know | grey |

Every domain status — CI conclusions, ticket columns, approval states, lane faults — maps onto these
through a function in `lib/status.ts`. A component asks for a tone and calls `toneColor(tone)`; it
never names `--color-warn` directly. That indirection is the entire point: a founder learns amber
once, and it means the same thing on the board, the queue and the activity feed.

Two rules that fall out of this, and matter more than they look:

- **`attention` is not a failure.** It is amber because a *human* is the next step — an approval to
  grant, a credential to install. Dressing a real fault in amber to seem calmer breaks the founder's
  ability to triage, and violates non-negotiable 10.
- **An unclassified fault reads `blocked`.** When we do not know what went wrong, we say so loudly.
  `laneErrorTone` tones only the two *known* setup states as `attention`; everything else is red.

Adding a sixth tone means the founder has a new colour to learn. That is a design decision — it
belongs in a PR to this document, not in a component.

## 3. Machine values in mono

Anything the founder could paste into a terminal or a URL bar — repo names, ticket ids, branch names,
timestamps, counts — uses `--font-mono` (the `.mono` class). Prose does not. This is how a founder
tells at a glance what is a name they must type exactly and what is us talking to them.

## 4. No dead UI

Every control does something real. A `<button>` must have an `onClick`, a `type="submit"`, or a
`form` — or be honestly `disabled`. A feature that is not built yet says so in words (as the
composer entry does when a venture has no box yet); it does not render a button that shrugs.

This is a trust property, not a tidiness one. A founder who clicks a button that does nothing learns
that the studio might be lying elsewhere too.

## Enforcement

```bash
make design-lint                     # the gate CI runs
node scripts/design-lint.mjs --list  # the rules, with the reason for each
```

| Rule | Catches |
| --- | --- |
| `raw-colour` | a hex colour outside `globals.css` |
| `raw-px` | any px except the `1px` hairline |
| `raw-status-colour` | `--color-ok/warn/error` named directly instead of through a tone |
| `dead-control` | a `<button>` that dispatches nothing |

What the linter deliberately does **not** check: spacing rhythm, hierarchy, whether a screen is
*good*. Those need an eye — `/design-review` and `/review`. The linter's job is to stop the
mechanical decay so review can spend its attention on the things only a person can see.


## Reading the screenshot gallery (FB-074)

The gallery is produced with Playwright's `fullPage: true`, which **stitches** a tall image out of a
scrolling page. A `position: sticky` element — the studio header — is rendered at the position it
occupied during that scroll, so on any page long enough to scroll it appears **in the middle of the
image, drawn over the text.**

That is an artifact of the screenshot. It does not happen in a browser.

This cost an afternoon and an 800-word ticket once. Before treating a gallery image as evidence about
the product, ask the browser:

```js
// scrolled to the middle of a real viewport, compare boxes
const bar = document.querySelector('.topbar').getBoundingClientRect();
[...document.querySelectorAll('p, li, h1, h2, h3')]
  .filter((el) => { const b = el.getBoundingClientRect();
                    return b.height > 0 && b.top < bar.bottom && b.bottom > bar.top; });
```

An empty result means nothing is covered. **A screenshot is evidence about a screenshot.**
