# FB-144 — The doors: where a founder works, where work runs, and where a "yes" is signed

**Status:** Todo · **Area:** Composer / decision memo · **Depends on:** — · **Rewritten** 2026-10-07 by
the October re-baseline (`docs/status/2026-10-re-baseline.md`) · **Output:** a decision memo and a
ticket set. **This ticket writes no product code.** · One ticket = one branch = one PR.

## Why it is rewritten

This ticket first asked how the studio composer and LibreChat relate: two doors into a conversation
with no stated relationship between them. Since then, two things have changed the question.

1. **D10 was ruled** (2026-09-29). A founder's own Claude (Claude Code, on desktop, terminal or phone)
   is the workbench. The studio is the ledger, reached through the Foundry tool server, which can read,
   file and propose but **never grant**. The composer is retired as the main surface but kept as the
   plain front door for a founder who never installs anything.
2. **Archon arrived** (2026-10-06). It is the engine that works tickets, and it has doors of its own:
   a dashboard, a chat, and soon Telegram. John confirmed on 2026-10-07 that Archon works the tickets
   and Cowgate runs the machines and the spending caps.

So there are now four things a founder could reach, and the memo this ticket asked for has to place
all four.

## The question

**Where does a founder do each kind of work, and where is each decision signed?**

| door | what it is | who it is for |
| --- | --- | --- |
| Claude Code, with the Foundry tool server | the workbench (D10) | a founder who will install it |
| The studio composer | the plain front door (D10) | every founder, including one who installs nothing |
| LibreChat, on the venture's machine | a full chat with file upload, model choice and long threads | to be decided by this memo |
| Archon's dashboard, chat and Telegram | the factory's controls | John, not founders (tailnet only, John-only sign-in) |

## What is already settled, and must not be re-litigated

- **An approval is signed in the studio and nowhere else** (FB-183, D10). No tool server call, no
  composer reply, no LibreChat tool and no Archon gate signs a grant for anything that leaves the
  company. An Archon plan approval is a "yes" to work in a branch, never to a send, spend or deploy.
- **FB-065's three findings about LibreChat**, confirmed on ARCA's machine: file upload is not on the
  Agents API; there is no conversation id to thread by; tool calls are visible but tool results are
  not.
- **Nothing merges without a human yes** (non-negotiable 2, 2026-10-07). A founder's approval
  recorded in the studio is that yes for their venture's work.

## What to research

- **Does a founder need LibreChat at all once Memory takes a document?** The studio can now take a
  PDF, Word, PowerPoint or Excel file into the venture's memory. If the composer reads it from there,
  the file-upload gap may close without LibreChat.
- **Drive the loose case as a founder** (upload a document, argue with it, change direction twice,
  land it as tickets) through the composer, and through Claude Code with the tool server. Record where
  each helps and where it gets in the way. Running it beats reading it.
- **One history or two.** LibreChat keeps conversations in its own database on the machine; the studio
  keeps them in the venture's `context/`. Two records of the same venture's thinking is what D8 exists
  to prevent.
- **What the composer must keep doing** if Claude Code is the workbench: the studio's guides (FB-079)
  and reading back the ticket file it wrote (FB-073) must move into the tool server's definitions,
  or the quality of filed tickets quietly drops.
- **How a founder approves an Archon plan** without seeing Archon: the studio shows the paused plan on
  the ticket's page and passes the answer back. Name the ticket that builds it.

## What to produce

1. **`docs/decision-doors.md`**: what is being decided, what holds either way, the options with honest
   costs, and a recommendation. It must say whether LibreChat stays on venture machines for founders,
   for operators, or not at all.
2. **The ticket set that follows**, each one branch and one pull request, including the re-cut of the
   FB-140 to FB-149 composer tickets that D10 asked for.
3. **A plain answer a founder would understand, in three sentences:** where do I go to think, where do
   I go to ask for work, and where do I say yes?

## Out of scope

- Building any of it.
- Giving founders Archon's own dashboard or chat. They stay the factory's controls.
- Retiring LibreChat. That is a possible outcome of the memo, not an assumption going in.

## Acceptance criteria

- [ ] The loose case was driven end to end as a founder, through the composer and through Claude Code
      with the tool server, with what happened recorded.
- [ ] The Memory-upload hypothesis is tested: whether it closes the file gap without LibreChat.
- [ ] `docs/decision-doors.md` places all four doors, states the options with honest costs, and
      recommends one.
- [ ] It states plainly that a grant is signed only in the studio, and that an Archon plan approval is
      never a grant.
- [ ] The three-sentence founder answer exists and was read to someone who does not know what an API is.
- [ ] A ticket set follows, including the FB-140 to FB-149 re-cut.
