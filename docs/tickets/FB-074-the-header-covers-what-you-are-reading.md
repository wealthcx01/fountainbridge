# FB-074 — The header covers the words you are reading

**Status:** Todo · **Phase:** 3 · **Depends on:** — · **Repo:** fountainbridge ·
**Branch:** `fb-074-the-header-covers-what-you-are-reading` · One ticket = one branch = one PR.

## Why this matters (for the founder)
On a long page, the bar at the top of the studio sits **on top of the text**. A line of the answer
you are reading disappears behind it. Not dimmed, not pushed down — covered.

A founder who loses a sentence out of an explanation does not think "that is a CSS bug". They think
they misread it, scroll back, lose their place, and trust the page a little less.

## What was found
Walked on 2026-08-01, on the composer, on ARCA. The composer's reply ran to 4,282 characters. Partway
down, the studio header — `Bruntsfield Foundry · Ventures · Workstreams · Attention 4 · Activity ·
Foundry · Handbook · Sign out` — is drawn over the middle of a paragraph. The covered line reads:

> *"…already known and there's an existing, closely-related ticket (ARCA-24) still marked 'In
> progress' that…"*

and then vanishes behind the nav.

That sentence is not decoration. It is the composer telling the founder their problem is already
known and already being worked on — arguably the single most useful line in the reply, because it is
the one that stops them asking for something that already exists.

The header is fixed or sticky, and the content below it is not offset by its height, so on any page
long enough to scroll the two occupy the same space. It will be worst exactly where it matters most:
the longest, most information-dense answers.

## Why it has not been noticed before
Every page in the studio until now was short, or was a board of cards where a covered row was
obvious and a founder would simply scroll. The composer is the first surface that produces a single
continuous block of prose long enough to scroll *through* the header, and it arrived yesterday
(FB-065).

It is also invisible to the tests. The Playwright suite asserts on text content and test ids, and a
covered element is still present, still visible to the DOM, and still returns its text. This is a
class of defect that automated checks structurally cannot see — which is an argument for the
screenshot gallery being read by a person, not just produced.

## Scope
- **Offset the content by the header's height** so nothing is ever drawn underneath it. The header's
  height is a known quantity; the page should reserve it rather than the two competing.
- **Check every scrolling surface**, not just the composer: the venture board with many lanes, the
  activity feed, the handbook and playbook pages, a long ticket in the drawer.
- **Check it at phone width too.** The mobile gate runs at 393px, where the header may wrap to two
  lines and cover twice as much.
- **Add a check that can actually see it.** The design contract (FB-057) is enforced by a script that
  reads source; this is a rendered-geometry problem. The cheapest honest check is a Playwright
  assertion that the first block of page content sits below the header's bottom edge on a scrolled
  page — a real geometric comparison, not a text assertion.

## Out of scope
- Reducing the number of things in the header. That is FB-067, and it is a separate argument: even a
  four-item header would still cover the text.
- Any redesign of the header's appearance.

## Acceptance criteria
- [ ] On a page long enough to scroll, no page content is ever drawn underneath the header.
- [ ] True at desktop and at 393px.
- [ ] A test compares real geometry — the top of the content against the bottom of the header — and
      fails if they overlap.
- [ ] The composer reply that exposed this renders with every line readable.

## Verification
`/review` + CI, plus the exact reproduction: the composer on ARCA, asked *"Card prices on the market
page look stale — some are weeks old. I want them fresh."*, scrolled to the middle of the reply, with
a screenshot showing the sentence about ARCA-24 fully legible. Then the same at 393px.

## A note on how this was found
This did not come from a test failing. It came from opening the screenshot and reading it. The suite
was green — 70 Playwright tests, including seven on this exact page — while a founder's most useful
sentence was being covered up.

Worth recording as a lesson rather than a one-off: the UI gate proves that the right *things* are on
the page. It says nothing about whether a person can read them. Anything that produces screenshots
should have someone look at the screenshots.
