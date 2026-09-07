# FB-200 — the studio as a tool: an MCP server that reads, files, and proposes

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-07

## The idea

Expose the studio as an MCP server, so a founder talking to Claude — in Claude's own app, on their
phone, or in Claude Code on their venture's machine — can ask the studio things and file work into
it, without visiting a website.

## The one rule that shapes every tool on it

**It reads, it files, and it proposes. It never grants.**

Non-negotiable 4 says nothing external executes without a recorded human approval, and FB-183 spent
a ticket establishing that there is exactly **one** surface where a grant is signed. A tool that
could sign a grant would create a second one — invisibly, on a device, with no screen showing what
was agreed to. So:

| | |
|---|---|
| **read** | the queue, a ticket and its trail, what happened, memory and corpus, run reports, budgets |
| **write** | file a ticket, add to the corpus, comment on a ticket |
| **propose** | raise `approval.proposed` — and nothing else |
| **never** | grant, send, spend, merge, deploy |

`approval.proposed` comes from Claude. `approval.granted` comes from a founder who looked at it on
the desk. That also gives the mobile story a clean shape: **Claude drafts and explains, the studio is
where you press the button.**

Venture isolation is unchanged and enforced the same way (non-negotiable 6): the credential is
venture-scoped server-side, so a founder's Claude on ARCA can never read the-reset. Same rule, new
client.

## Does this mean the composer goes? — the question John asked

He asked it precisely: *"do we need the composer though? would the mcp not just work with claude chat
and co work as well?"*

**On the second half: yes, and it changes the argument.** Claude's own apps support remote MCP
servers as connectors. So this is not only a path for people who use a terminal — a founder can add
the studio to Claude on their phone and say *"file a ticket to redo the launch email"*, and it lands
on the desk. The standing objection to Claude Code — that a Sell or Scale founder will never install
a coding agent — mostly dissolves, because for most founders there is nothing to install.

**On the first half, my answer is: keep a text box, and stop building it into a chat.**

Three things are true at once.

**The composer's conversation is replaceable and we should stop competing.** Claude's own apps are
better at conversation than anything built here will be, and FB-144 — "two doors to one
conversation" — has been unresolved for weeks precisely because nobody could say what our chat was
*for* next to LibreChat. This collapses the question rather than answering it.

**But two things the composer does are not chat**, and they would be quietly lost. It carries the
studio's own guides (FB-079), and it reads back the ticket file it wrote (FB-073). Both have to move
into the MCP tool definitions and their responses, or the quality of filed tickets drops without
anyone noticing.

**And a founder with no Claude subscription still needs a door.** An MCP connector needs a paid plan
and a setup step. Making the studio depend on a second product being bought and configured is a
bigger bet than it looks.

So: shrink the composer to the one thing it uniquely is — *tell the studio what you want* → a
proposed ticket you read and confirm. That is a form with a language step in it, not a conversation.
Everything conversational moves to Claude. FB-144's memo gets rewritten as: **Claude is the good
door, the composer is the plain door, and the grant is signed in neither.**

## What it is worth before any founder adopts it

This is useful on day one to the lanes and to whoever is building the studio, regardless of whether a
founder ever adds a connector. "What is waiting on John across all three ventures" and "file this as
a ticket on arca-ops" are questions asked constantly, by hand, today.

## Scope

- A `foundry-studio` MCP server. The studio's public surface, not a per-venture thing — scoped by
  credential, one venture per credential.
- The read, write and propose tools above. Nothing that grants.
- Tool descriptions carry FB-079's guidance, and the file-a-ticket response reads the written ticket
  back (FB-073), so a filed ticket is as good as one filed through the composer.
- Refusals are loud and say which venture and which rule (#10) — a tool that fails silently inside a
  chat is worse than one that fails on a screen, because nobody is looking at it.
- Every write goes through the same choke-points the studio's own actions use, so a ticket filed by
  Claude is indistinguishable downstream from one typed on the desk.

## Acceptance criteria

- [ ] A founder can add the studio to Claude on a phone and read their queue.
- [ ] A ticket filed through a tool is byte-identical in the repository to one filed on the desk.
- [ ] There is no tool, and no combination of tools, that grants an approval — proven by a test that
      tries.
- [ ] A credential for one venture cannot read another's queue, corpus, or tickets — proven by a test
      that tries.
- [ ] The guidance that shapes a good ticket reaches Claude, and a filed ticket is read back.
- [ ] FB-144's memo is rewritten around this and the composer's scope is cut to match.

## Depends on

Nothing hard. It reads what git already holds. It is listed after FB-174 only because the storage
work is more urgent, not because this waits on it.
