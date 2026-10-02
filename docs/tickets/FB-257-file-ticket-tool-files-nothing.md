# FB-257 — the studio's `file_ticket` tool cannot file a ticket

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** found while building FB-236, 2026-10-02 ·
**Depends on:** FB-200 · One ticket = one branch = one PR.

**Shipped in part:** the tool now builds a complete plan, passes the access check, and files one ticket and opens one pull request — proven end to end against a stand-in GitHub. It has not yet been run against a real repository. That needs John: a tool credential for ARCA, and one real ticket asked for through Claude.

## What happens

A founder talking to Claude through the studio's tools (FB-200) asks it to file a ticket. Claude
calls `file_ticket`. The tool answers *"That did not work: That plan could not be read. Nothing
changed."* Every time.

## Why

`app/api/mcp/route.ts` hands `filePlan` a plan with only a title and a body:
`{ tickets: [{ title, body }] }`. `filePlan` checks every plan it is given by reading it with
`parsePlanDraft`, which needs the venture, the repository, a source, a slug and a date. None of those
are there, so the plan is refused before anything is written.

The tool's own tests mock the tool runner, so nothing ever ran this path end to end.

## What it means for a founder

Nothing was filed wrongly, so nothing needs undoing. But the one tool that turns a conversation into
work does not work, and it says so only after Claude has tried it.

## Scope

- Build a complete one-ticket plan in the tool: this venture, the repository asked for, a slug made
  from the title, a source of "a conversation with Claude", today's date.
- A test that calls the real `file_ticket` path against a mocked GitHub and sees one ticket file
  written. Break the plan it builds and watch the test go red.

## Out of scope

- A tool for filing a whole set. That is a separate decision about what a founder sees before a set
  is filed.

## Acceptance criteria

- [ ] Asking Claude to file one ticket through the studio's tools writes one ticket file and opens a
      pull request. *(True in code and in the test below; not yet seen on a real repository.)*
- [x] A test proves it, and fails when the plan the tool builds is incomplete.
      (`app/api/mcp/__tests__/route.test.ts`)

## What shipped

**There were two faults, not one.** The ticket above names the first. Fixing it alone would still
have refused every ticket, because of the second.

1. **The plan was incomplete.** The tool now builds a whole one-ticket plan: this venture, the
   repository asked for, a short name made from the title, "a conversation with Claude" as the
   source, and today's date (`lib/tool-ticket.ts`). If the body has no heading, the title becomes
   its heading, so the ticket is not filed as "Untitled".
2. **The access check refused the tool.** A tool call acts as `studio-tools@<venture>`. That is not
   a founder's or an admin's address, so the venture check said "You do not have access to this
   venture" to every tool that writes or reads a ticket. The check now trusts a tool call for the one
   venture its signed credential names.

**A safety hole closed on the way.** `filePlan`, `readThread` and `appendToThread` are server
actions, so anyone can call them with any arguments, signed in or not. Each took an optional
"actor", and the actor's email was believed. Founders' emails are in the public manifests, so a
request that claimed to be a founder could file into their backlog or read their tickets'
conversations without signing in. Now an actor only counts if the studio made it, in the same
process, after checking a signed credential (`toolActor` in `lib/venture-access.ts`). Anything sent
in a request is refused.

**What the tool now checks, because it is a public endpoint:** the venture comes from the signed
credential and never from the arguments; the repository must be one of the venture's own; the title
must be one line, under 160 characters, with no line breaks; the body must be under 40,000
characters. A title with nothing usable in it for a file name (one written in another script, say)
gets a fixed name made from a fingerprint of the title, so asking twice updates the ticket instead of
filing it twice.

A single ticket's pull request is now titled with its id and title (`ARCA-068: Show every live
auction`) rather than "<source>: 1 tickets".
