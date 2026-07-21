# Ticket-file parser (FB-004)

The studio renders work items straight from a venture repo's `docs/tickets/*.md` — git is the
source of truth (D2), there is no separate ticket database. This library turns one ticket markdown
file into the bcap-contracts **`Ticket`** contract. It lives in `tools/ticket-parser/`, isolated
from the studio app (which arrives in FB-005), and has no runtime dependencies.

- **Fetching** ticket files over the GitHub API is **FB-006**, not here.
- **PR-derived status** (open PR → `pr-open`, merged → `done`) is **FB-007**. At parse time status
  comes only from the markdown, defaulting to `todo`.

## API

```ts
import { parseTicket, looksLikeTicket } from 'fountainbridge-ticket-parser';

const { ticket, warnings } = parseTicket(markdown, {
  repo: 'fountainbridge',                       // required — the contract `repo`
  path: 'docs/tickets/FB-004-ticket-file-parser.md', // required — the contract `path`
});
```

`parseTicket` **never throws** on string content — malformed input yields a best-effort `Ticket`
plus `warnings` (it throws only if you omit `repo`/`path`, which is a usage error). `looksLikeTicket`
tells a caller whether a file in the directory is actually a ticket vs. a stray README/design note.

## Tolerated formats

Real repos don't follow one template. The parser reads two live styles side by side:

| | grassmarket | fountainbridge |
|---|---|---|
| **H1** | `# GRS-0001 — Scaffold (Loop 0)` | `# FB-004 — Ticket-file parser: …` |
| **Metadata** | bullet list: `- **Loop:** 0` | inline: `**Phase:** 1 · **Depends on:** FB-002` |
| **Phase key** | `Loop` | `Phase` |
| **Status** | free text: `In review — PR #22`, `Fixed`, `⏸ PAUSED …` | usually absent (PR-inferred, FB-007) |
| **IDs** | may carry a letter suffix: `GRS-0147b` | `FB-004` |

Recognized metadata keys (case-insensitive, `- ` optional): **Phase/Loop**, **Depends on / Depends
/ Dependencies / Deps**, **Branch**, **Status**. Other keys (Owner, Severity, Normative sources, …)
are ignored, not flagged — they're legitimately common.

### Status mapping

Free-text status is mapped to the contract enum (`todo | in-progress | pr-open | done`) from the
**leading clause** (before the first `—`, `(`, `;`):

- **done** ← done, complete(d), shipped, merged, closed, fixed, resolved, implemented, delivered, landed, ratified
- **pr-open** ← in review, under/awaiting/ready-for review, `PR #…`, pr-open
- **todo** ← todo, backlog, planned, not started, draft, proposed, queued, pending
- **in-progress** ← in progress, wip, active, doing, ongoing, building, paused, blocked, on hold, halted, started

A **present but unmappable** status (e.g. `CRITICAL` — a severity mis-filed as status) defaults to
`todo` **and emits an `unrecognized-status` warning**. An **absent** status is normal and silent.

## Warnings (fail loud — CLAUDE.md #10)

| code | meaning |
|---|---|
| `no-h1` | no `# ` heading; id + title derived from the filename |
| `no-id-in-heading` | H1 present but no id in it; id taken from the filename |
| `no-id` | no ticket id anywhere — likely not a ticket file (`looksLikeTicket` → false) |
| `no-title` | no title in an H1; derived from the filename |
| `unrecognized-status` | a status was declared but didn't map to a lifecycle state |

Imperfect tickets are shown **flagged, never hidden**. Every parsed `Ticket` — even a degraded one
— is guaranteed to validate against the vendored `Ticket` schema (`schema/Ticket.schema.json`);
`test/schema.test.ts` enforces this.

## Testing

`tools/ticket-parser/` — `npm run typecheck` + `npm test` (also `make parse-tickets` from the repo
root; run in CI as the **Parse tickets** job). Tests run against a corpus of **real** tickets copied
into `fixtures/real/` from grassmarket + fountainbridge, plus synthetic edge cases in
`fixtures/edge/`. The corpus test asserts the ticket's bar: **100%** parse without throwing and
**≥90%** with zero warnings (currently 93.8% — the one warned ticket, GRS-0042, has a severity in its
Status field, which is correctly flagged). arca's ticket queue is intentionally empty (FB-003), so it
contributes no fixtures.
