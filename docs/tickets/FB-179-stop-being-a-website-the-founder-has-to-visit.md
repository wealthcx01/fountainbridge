# FB-179 — stop being a website the founder has to visit

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-02, from the Omarchy/OpsLayer post

## The argument, and the half of it that applies to us

The post John shared makes an argument worth taking seriously. Its author built OpsLayer — chat with
your agents, manage projects, share files and knowledge, approve sensitive API calls, control evals
and guardrails — which is, feature for feature, close to what Fountainbridge is. After a few days on
Omarchy he wrote:

> *"Why am I still treating my AI team like something I access through a browser window? I want to
> hit a keyboard shortcut and talk to an agent from anywhere. I want an approval to appear
> immediately when an agent needs me."*

That is a real observation about this product, and the studio currently loses on it. A founder must
remember to open a tab. An approval that blocks an external send sits there until someone looks.

## Where the argument does not transfer

He is building for **himself**. His distribution problem is zero: he installs the OS he likes on the
machine he owns. Fountainbridge's users are the founders of Bruntsfield ventures — the whole point of
the studio is that a non-technical founder can run a company with an AI team. "First install this
Linux distribution" is not a product.

So the OS is his answer and cannot be ours. The *need* is identical and is unaddressed here.

## What actually closes the gap

- **Push, which we have already built and never proved.** FB-141 shipped the PWA — installable to a
  home screen, `shouldNotify` firing only when a queue goes from zero to non-zero, a push that names
  the venture and the count and never the content. Its unticked half is a real device install and a
  real delivered notification. That is the "an approval appears immediately" half of his argument,
  and it is *nearly done*. Finishing it beats starting anything new here.
- **A command palette.** ⌘K / Ctrl-K from any screen: jump to a venture, a ticket, the composer,
  approve the thing that is waiting. The keyboard-first half of the post, inside a web app, for the
  cost of one component. It also helps the founder who is not fast with a mouse, which is a real
  accessibility gain and not just a power-user nicety.
- **Deep links that survive.** A push notification, an email, a Slack message must open the exact
  screen — `/venture/arca/tickets?t=ARCA-61` — not the desk. FB-156's `workHref` already establishes
  that the studio owns its routes; this makes them addressable from outside.

## Explicitly not in scope

- **An Electron app.** It changes nothing measurable. The studio's slowness is round trips to a code
  host (FB-170, FB-177); the same calls from a desktop shell take the same time. A wrapper would add
  a build target, a signing story and an update channel, and buy a window frame.
- **An OS.** For the reason above.
- **Omarchy on the build machine.** A separate question, and a matter of John's own preference — it
  would not change how fast this gets built. The bottleneck is decisions, verification and CI.

## Acceptance criteria

- [ ] A real approval on a real device raises a real notification, and pressing it opens that item.
- [ ] ⌘K reaches any venture, ticket, or the composer, from any screen, with the keyboard only.
- [ ] Every notification and external link deep-links to the exact item.
- [ ] The palette is reachable and operable by a screen reader.
