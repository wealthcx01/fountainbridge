# The studio's surface — what exists, and what is planned

**Written for a reviewer, 2026-09-08.** Read this beside `main`; where the two disagree, `main` is
right and this file is a bug.

Its companion is `docs/studio-design-contract.md` (what the studio must never do to a founder) and
`docs/design-conformance.md` (each screen measured against its design). This one is the inventory:
every door into the studio, what is behind it, and what is coming.

## The shape of the thing, in one paragraph

Git is the record. The studio is a **view over git and a write path into it** — a Next.js app on
Railway (eu-west) that reads a venture's repositories and writes back as pull requests. Each venture
also has its **own machine**, which runs the AI team, a chat composer, and a live picture of the team
at work. A Postgres database holds two things and only two: a cache that can be rebuilt from git, and
the bytes of documents a founder handed over, which cannot.

Two rules shape every entry below, and neither bends:

- **Venture isolation is server-side** — a session, ticket or credential scoped to one venture can
  never reach another's data, and it is the server that decides, never the caller.
- **Nothing external happens without a recorded human approval** — no email, spend, merge or deploy,
  and there is exactly **one** surface where a grant is signed.

---

## 1. Screens

Everything under `/venture/[id]` is scoped to one venture, server-side, by the signed-in identity.

| route | what it is |
|---|---|
| `/` | the studio's front page — a founder's ventures |
| `/venture/[id]` | **the desk** — the venture's home. Under design review (FB-203) |
| `/venture/[id]/tickets` | the tickets list, with one open beside it |
| `/venture/[id]/work/[repo]/[number]` | one piece of finished work, to accept or send back |
| `/venture/[id]/approvals/[repo]/[approvalId]` | **the one place a grant is signed** (FB-183) |
| `/venture/[id]/activity` | what happened, newest first |
| `/venture/[id]/knowledge` | *"What your venture knows"* — the corpus and what reads it |
| `/venture/[id]/routines` | work that happens on a schedule |
| `/venture/[id]/composer` | the conversational composer |
| `/venture/[id]/handbook`, `…/handbook/[slug]` | the handbook, per venture |
| `/attention` | everything waiting on the founder, across ventures |
| `/activity`, `/lanes` | cross-venture reads |
| `/handbook`, `/handbook/[slug]` | nine chapters. Ch. 9 is the founder's practical guide |
| `/playbook`, `/how-it-works`, `/foundry` | the method, and what the Foundry is |
| `/login`, `/not-authorized` | the two doors and the refusal |
| `/admin/timing` | admin only |

The **pocket studio** is not a route. It is `/venture/[id]` at phone width, with a different order
and fewer sections (FB-160).

## 2. HTTP endpoints

| route | auth | what it answers |
|---|---|---|
| `GET /api/health` | none | for the uptime monitor and Railway. Excluded from the gate |
| `GET /api/readiness` | admin session | whether every venture is reachable, whether the approval record is writable, and whether documents have somewhere to live. `?probe=1` does real writes rather than trusting configuration |
| `POST /api/mcp` | **a studio-issued ticket** in `Authorization: Bearer` | the tool surface (§4). Excluded from the gate so it can answer `401` in words — a machine cannot follow a redirect to a login page |
| `GET /api/composer/[id]`, `…/document` | session | the composer's stream and deposits |
| `/api/auth/[...nextauth]` | — | Google and password sign-in |

Everything not listed is gated by `middleware.ts`, which redirects to `/login` by default. The three
exclusions above are anchored, so `/api/mcp-something` stays gated.

## 3. Write paths — the choke-points

Every write into a venture goes through one of these. They are the *only* writers, and each begins
with `requireVentureRepo`, which checks the identity, the venture, and that the repository really
belongs to it.

| action | what it does |
|---|---|
| `filePlan` | files one or more tickets as a branch and a pull request |
| `depositDocument` | a founder hands over a document (§5) |
| `appendToThread` / `readThread` | the conversation on a ticket |
| `acceptWork` / `sendBackWork` | accept a piece of finished work, or return it with a note |
| `decideRoutine` | allow or stop recurring work |
| `releasePlan` | let a lane begin on a plan |
| **`approveExternalAction` / `refuseExternalAction`** | **the grant.** The only code that signs one, reachable from exactly one screen |

`requireVentureRepo` takes an optional **actor**, so a browser session and a tool ticket follow one
path rather than two. Its own comment says why: *a security check that exists twice is a security
check that will one day differ.*

## 4. The tool surface (MCP)

`POST /api/mcp`, JSON-RPC 2.0. One venture per credential. **It reads, it files, and it proposes. It
never grants.**

**Live now:**

| tool | kind |
|---|---|
| `whats_waiting` | read — the queue, oldest first |
| `read_ticket` | read — one ticket and its conversation |
| `comment_on_ticket` | write — a note, through the same function the ticket screen uses |

**Designed, not yet listed** — deliberately absent rather than present and broken, because a model
offered a tool that fails will try it and tell a founder it worked: `file_ticket`,
`propose_approval`, `what_happened`, `budgets`, `venture_memory`.

There is no tool that grants, and a test asserts the exact surface by name and kind, so adding one
means editing an assertion that says you must not.

## 5. Data

| where | what | may it be dropped? |
|---|---|---|
| **git** | tickets, corpus text, approvals, run reports, threads | it is the record |
| `public.ventures`, `public.run_reports` | a read cache | **yes** — rebuildable from git |
| `public.documents` | the record of a handed-over file | yes — the pointer is in git |
| `docstore.blobs` | **the file itself** | **no. It exists nowhere else** |

Every table has row-level security **enabled and forced**, scoped by a per-transaction setting the
server sets and a browser cannot influence. A connection naming no venture sees nothing.

Documents are addressed `<venture>/<sha256 of the bytes>`, and a check constraint means a row whose
object sits under another venture's prefix cannot be written at all. The studio holds `insert` and
`select` on the bytes and nothing else — it cannot update or delete a founder's document.

## 6. On a venture's own machine

| service | port | reached by |
|---|---|---|
| the AI lane | — | a timer, every 5 minutes, within a daily budget |
| the composer (LibreChat) | 3080 | the founder, through the studio |
| **pixel-agents** (the office) | 4310, loopback | nothing directly |
| **the office gate** | 4311, loopback | the founder's browser, via Caddy, with a studio-signed ticket |
| the brain bridge | — | the lane, read-only |

The office gate is the only thing between a browser and a venture's machine. It checks the ticket and
forwards exactly one message from a browser — the office's own handshake — because pixel-agents
accepts an instruction to remove an agent from any connection.

`deposit-mcp` and `brain-mcp` are stdio tool servers for the composer, on the box.

## 7. What is planned

**Next, and depended upon by the rest**

- **FB-203 — the desk against its design.** Thirteen items; the shell first, because the rail has no
  gutter and the page's sections measure from two different ancestors.
- **FB-200 (rest)** — `file_ticket`, `propose_approval`, the remaining read tools, a claude.ai
  connector (needs OAuth), and a screen to fetch a connection.
- **FB-173 — voice notes.** A founder records; it becomes a proposed ticket. Depends on §5.

**The studio's own shape**

- **FB-144** — what the composer is *for*, next to Claude. Expected answer: the composer becomes a
  form with a language step, not a conversation.
- **FB-179** — stop being a website a founder has to visit.
- **FB-201** — a cofounder that notices and proposes, with its limits as settings, and hard ceilings
  on how long it may go on.
- **FB-172** — the graph, on screen. **FB-171** — we call it ActiveGraph and are not running one.

**Correctness and safety**

- **FB-168** — every venture page has two `<main>` landmarks (the same fault as FB-203's shell).
- **FB-176** — one token in one place. **FB-072** — the lane's token can reach the whole org.
- **FB-164** — the studio re-derives everything from git on every load. §5's cache exists for this
  and nothing reads from it yet.
- **FB-184** — every ticket carries one link to where you can see the result.

**Known gaps in what shipped**

Documents cap at 12MB and cannot yet be fetched back on a screen; the composer's deposit path writes
only to git; `public.documents` has no writer; the office is desktop-only, because the room is wider
than a phone at any height.

## What a design reviewer should know before reading a screen

1. **Delete before adding.** Most drift from the design is sentences the design chose not to write.
2. **Amber `#8A5A00` means "needs you". There is no red** in the design; production has three.
3. **Every empty state is a real state** and must say something true — "nothing yet" and "could not
   be read" are different sentences, and confusing them loses a founder's work.
4. **Nothing on a screen may imply an action the studio cannot take.** A control that does nothing is
   worse than no control.
