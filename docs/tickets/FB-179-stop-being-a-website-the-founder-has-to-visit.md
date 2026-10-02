# FB-179 — stop being a website the founder has to visit

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-02, from the Omarchy/OpsLayer post

**Shipped in part:** the keyboard palette and the push's deep link are built and checked in a
browser. Not yet done: a real notification on a real phone (that is FB-141's last step, and needs
John's keys, database change and timer first), and driving the palette with a real screen reader
(VoiceOver or NVDA) rather than checking its labels and roles in code.

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
      **The opening is built; the real device is not done.** When exactly one thing is waiting, the
      push now opens that thing — the work's own page, or the send's own page — instead of the list.
      With several waiting it opens "Needs you", because picking one of them would be arbitrary. A
      real phone receiving it waits on FB-141's last steps (keys, database, timer).
- [x] ⌘K reaches any venture, ticket, or the composer, from any screen, with the keyboard only.
      Checked in a browser at 1440×1000 and 393×851 on ARCA's real data, keyboard only: Ctrl-K from
      the Handbook, type "arca 61", arrow down, Enter → the Tickets screen opened on ARCA-61. ⌘K,
      "composer", Enter → the composer. Escape closes it and puts focus back.
- [x] Every notification and external link deep-links to the exact item. The studio sends exactly
      one kind of notification (FB-141), and it now opens the exact item when there is one. Every
      address the palette uses is the studio's own and is the same address a message or an email
      can carry — `/venture/arca/tickets?filter=all&t=arca%2FARCA-61` opens that ticket, keyed by
      repository as well as id, so two repositories that share an id cannot be confused. The studio
      sends no emails or Slack messages of its own today, so there are no other links to check.
- [ ] The palette is reachable and operable by a screen reader. **Built, not yet proven with one.**
      It is a labelled modal dialog with a combobox over a listbox, the active option announced
      through `aria-activedescendant`, and a polite live region that says how many matches there
      are. A "Go to anything" button is the first thing Tab reaches on every page, out of sight until
      it has focus, like a skip link. All of that was checked in a browser; none of it has been
      listened to through VoiceOver or NVDA, and that is the only test that counts here.

## What shipped

- **"Go to anything"** (`components/CommandPalette.tsx`, rules in `lib/palette.ts`). ⌘K on a Mac,
  Ctrl-K elsewhere. Lists, in order: what is waiting on you, the venture's screens, its tickets, and
  your other ventures with their composers. Typing narrows it — every word must appear, in any order,
  so "arca 61" finds ARCA-61. Thirty rows at most: it is for jumping, not browsing.
- **It only ever goes somewhere.** It never approves, refuses or sends. "Approve the thing that is
  waiting" means it takes you to that thing's own page, because FB-183 made that the one place a
  decision is signed, and a second place to approve would be a second place to get it wrong.
- **Isolation is on the server.** The list is read by a server action that checks the venture
  against the session first. Naming another founder's venture reads nothing from it.
- **It says what it could not read.** If the tickets could not be read, every screen is still listed
  and a sentence says the tickets are missing — never a shorter list shown as though it were whole.
- **Waiting work goes to the right place.** On ARCA, finished work on a branch named `ARCA-061-…`
  belongs to a ticket filed as `ARCA-61`. An address naming `ARCA-061` would have opened the Tickets
  screen on a different ticket, so waiting work goes to its ticket only when that ticket is really on
  the board, and to its own work page otherwise. Found by pressing it, not by reading the code.
- **The push opens the exact item** when one thing is waiting (see the first criterion).

Not in this ticket, and worth a ticket of its own: the studio does not recognise that branch
`ARCA-061-…` is ticket `ARCA-61`, so on ARCA that piece of finished work is listed as untied to any
ticket.
