# FB-257 — the studio's `file_ticket` tool cannot file a ticket

**Status:** Todo · **Phase:** 3 · **Raised by:** found while building FB-236, 2026-10-02 ·
**Depends on:** FB-200 · One ticket = one branch = one PR.

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
      pull request.
- [ ] A test proves it, and fails when the plan the tool builds is incomplete.
