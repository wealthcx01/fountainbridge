# Mission: Foundry Studio

## What it is

Foundry Studio is where a founder runs a company that Bruntsfield Capital builds with them. Its
codename is fountainbridge. It runs on Railway, at foundry.bruntsfield.capital once that address is
back, and at its Railway address until then.

A founder signs in with Google, or with a password if their account can't use Google. They land on
their venture's one page, "the desk". It answers one question first: does anything need me? From
there they can:

- approve a piece of work, or refuse it with a reason;
- tell the studio what they want, in the composer;
- read what their team did ("What happened") and what their venture knows ("Memory").

John, as the Bruntsfield partner, sees every venture. Today ARCA is the only real venture. Its
founder account, `arca.founder@bruntsfield.capital`, is John's, kept apart from his admin address.
THE RESET is parked.

**This pilot adds one thing: the factory page.** It shows the same cards, the same words and the
same buttons that the factory sends John on Telegram. Each founder sees only their own venture's
cards. A press on the page goes through the same path as a press on Telegram, so the two can never
disagree.

## Who it is for

Founders of Foundry ventures, and John. No page is public.

## Done, for this pilot

- The factory can start a test copy of the studio, and every journey in `harness/END-TO-END.md`
  passes against it.
- The factory page is live, and John has clicked through it in production twice: once as himself,
  once as ARCA's founder.
- One real run's card has shown in Telegram and on the page with the same words. A button pressed in
  one place has shown as done in the other.

## Always

- Every screen is looked at beside its design, at 1440×1000 and 393×851, with its height recorded
  (`CLAUDE.md`, rule 11).
- `/api/health` answers.
- **Venture isolation is checked on the server, never only in the page.** A founder's request for
  another venture's data, by any route, gets nothing.
- **Nothing merges without John's tap.**

## It must never become

1. **A window into another founder's venture.** Not by a link, a guessed address, or a direct call
   to the studio's server.
2. **A second engine.** The studio never runs, approves or merges factory work itself. It shows the
   factory's cards and hands each press to the factory's own listener on the planning box.
3. **A way round the gates.** No factory button approves an email, a payment, a post or a deploy.
   Those still need the studio's own signed approval (`docs/the-record.md`).
4. **A place that rewords the factory.** A card's words come from the factory, exactly as Telegram
   shows them.
5. **A place for secrets.** This repository is public. No keys, no real founder data in test
   fixtures, and no holdout. The holdout lives only on the planning box.
6. **Archon's dashboard for founders.** A founder never sees a run id, a step name, a server name or
   a private-network link.
7. **A redesign.** The factory follows `docs/studio-design-contract.md` and the Claude Design
   prototype. It adds no colours, tones or screens of its own.

## Decisions only John makes

Every merge. Who may press which button. Each issue's budget. Which ventures the factory works on.
The founder-facing words. Railway settings, domains and DNS.
