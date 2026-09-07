# FB-188 — the column beside the rail is a third narrower than the design, so every screen is taller

**Status:** Done · **Phase:** 3 · **Found by:** FB-186, 2026-09-03

## The measurement

At 1440×1000, on ARCA, measured on both sides:

| | content column beside the rail |
| --- | --- |
| the design | **1,080px** |
| the studio | **766px** |

Ours is **29% narrower**. Every sentence wraps sooner, so every block is taller, on every screen
that has a rail: the desk, Tickets, What happened, Memory, the Handbook.

## Why it is this way

`app/globals.css` already says what it meant to do:

```css
/* … The design's own figures are 32px/36px/64px against a ~1080px column. */
body:has(.rail) .main {
  max-width: 68rem;   /* 1,088px */
```

68rem is right for the column. The problem is what it is measured across: the rail is **inside**
`.main`, so those 1,088px are the rail *plus* the content. The rail takes 250px, the padding takes
72px, and the content is left with 766px.

The chain, read off the running page:

```
1088px  main.main          max-width: 68rem
1016px  flex row           rail + content
 766px  main               the content
```

So this is not a design decision that turned out badly. It is a rule that does not do the thing its
own comment says it is for.

## Why it is worth a ticket of its own

It is one line, and it moves every screen in the studio. Each one needs re-rendering beside its
design at both sizes and reading as a picture (CLAUDE.md rule 11), because a wider column changes
where things wrap and can uncover layout that only ever worked at 766px — the Tickets screen's
list-beside-detail split most of all.

That is a bigger and riskier change than the ticket that found it, which is why FB-186 filed it
rather than folding it in (non-negotiable 3).

## What it explains

FB-186 removed a real duplication and the desk came down 309px, to 2,603px against its 2,500px
target. The rest is not more duplication to find. It is that the desk is drawing a design meant for
1,080px into 766px.

## What it turned out to be worth

| | before | after |
| --- | --- | --- |
| The desk | 2,603px | **2,395px** |
| Tickets | 1,471px | **1,202px** |
| a ticket | 1,508px | **1,202px** |
| What happened | 1,487px | **1,264px** |
| Memory | 1,134px | **1,096px** |

No content was removed from any of them. The desk is under the 2,500px target FB-186 could not
reach, and it was never about the desk's content.

The sweep also found that **every handbook chapter scrolled sideways on a phone**, which this ticket
did not cause and has fixed: `.playbook-prose` was a class name with no rule behind it, the identical
case FB-153 fixed for `.ticket-body` and did not look at next door.

## Scope

- Make the 68rem measure the content column, not the column plus the rail.
- Re-render every screen with a rail, at 1440×1000 and 393×851, beside its design, and look at all
  of them.
- Add each new height to `docs/design-conformance.md`.
- Watch the Tickets split and the ticket body in particular: both were tuned at the narrow width.

## Acceptance criteria

- [x] The content column beside the rail is within 5% of the design's 1,080px at 1440×1000. **1,078px.**
- [x] Every screen with a rail has been rendered beside its design at both sizes and read.
- [x] No screen scrolls sideways at either size. **The handbook did, before this; it does not now.**
- [x] The scorecard carries the new numbers for all of them.
