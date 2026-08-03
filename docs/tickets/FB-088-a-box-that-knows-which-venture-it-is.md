# FB-088 — A box that knows which venture it is

**Status:** Done · **Phase:** 0 (provisioning) · **Found by:** walking the founder journey against
production configuration · **Repo:** fountainbridge (+ the ARCA box) ·
**Branch:** `fb-088-venture-aware-seed` · One ticket = one branch = one PR.

## What the walk found

A founder walkthrough was run against a **production build carrying production environment** — the
real GitHub App, the real composer key, the real ARCA box. A real feature request went in ("people
lose their saved card lists, I want a basic sign-in"), and a real ticket came out:
`wealthcx01/arca#35`.

The loop works, and the composer is better than expected. It searched the venture brain, found that
ARCA-19 and ARCA-20 had already shipped session auth and ownership-scoped watchlists, and said so
rather than cheerfully scoping work that already existed. It asked **one** question. On the answer it
correctly re-diagnosed the ask as a client-side wiring bug and drafted a bug-fix ticket naming the
likely files.

Two defects came out of the same walk.

## Defect 1 — the composer stutters

Turn one told the founder *"Looking through what your venture knows"* **twice**, because the agent
searched the brain twice. Both calls were real and both were honestly labelled, so nothing was lying;
it simply read as a stutter in front of an otherwise excellent answer.

Consecutive identical activity labels now collapse to one. Only the immediate repeat — search, read,
search again is a genuine sequence, and flattening that would misrepresent what happened. The
underlying actions are untouched; this is a display rule.

## Defect 2 — the box did not know which venture it was

This is the one that matters today.

`deploy/librechat/seed-agent.js` held the literal string **ARCA nine times**: in the composer's
instructions, in the research assistant's brief, in the ticket template's id prefix, and in all eight
suggestion prompts.

So the ticket that came back was titled `ARCA-NEW — Saved card lists not persisting`. On ARCA that is
merely an unresolved placeholder. On **THE RESET** it would have been worse: its founder's first
ticket would have carried another venture's name, its composer would have introduced itself as ARCA's,
and its suggested prompts would have offered to research the graded trading-card market.

That is a venture-as-config violation (CLAUDE.md #5) sitting directly in the path of "duplicate ARCA
for THE RESET". The duplicate would have looked right and been wrong, and the person who found out
would have been Ross.

The venture's identity now comes from configuration: `VENTURE_REPO` (already present) supplies the id
and the default ticket prefix, and `VENTURE_NAME`, `VENTURE_DESCRIPTION` and optional
`VENTURE_TICKET_PREFIX` shape the prose. Unset, a box is **generic, never wrong-venture** — the
fallback names itself from the repo rather than from ARCA.

## The trap inside the fix

`seed-agent.js` is fed to **mongosh**, not node:

```
docker exec -i librechat-mongodb mongosh LibreChat < seed-agent.js
```

so `process.env` inside it is the *mongo container's* environment and has never heard of the box's
LibreChat `.env`. Reading `process.env` alone would have produced a generically-named composer on a
correctly-configured box — quiet wrongness of exactly the kind this ticket exists to remove, and it
would have passed every check that did not read the seeded record back.

Values are therefore injected as mongosh globals by a new **`deploy/librechat/seed.sh`**, which reads
the `.env` and passes them with `--eval`. That is the pattern `SEED_AUTHOR_EMAIL` already used.
`process.env` is kept as a second source only so the file still behaves under plain node.

`seed.sh` reads the `.env` **without sourcing it** — the values are unquoted and contain spaces
(`a graded trading-card market-analytics terminal`), which `.` would try to execute.

## Scope of this pull request

- Consecutive identical composer activity labels collapse.
- `seed-agent.js` takes the venture's identity from configuration; no venture string remains.
- `deploy/librechat/seed.sh` — the supported way to seed, because the direct mongosh invocation
  cannot see the configuration.
- `.env.example` documents the three new keys.
- ARCA's box updated: `.env` carries its name and description, and the agents were re-seeded and read
  back out of MongoDB to confirm the prompt still says ARCA and the template still says `ARCA-NEW`.

## Explicitly NOT in this pull request

- **Allocating a real ticket number.** `-NEW` is still a placeholder; the filing tool does not assign
  the next id, so a founder's ticket arrives numberless. Its own ticket — it needs the filer to read
  the backlog and pick, which is more than a prompt change.
- **The attention queue's 56 items.** The walk surfaced it; sizing what a founder should see there is
  a separate design question.

## Acceptance criteria

- [x] A repeated activity label appears once; a genuine return to the same tool still appears twice.
- [x] No venture name is hard-coded in the seeder.
- [x] A box with no extra configuration seeds generically, not as ARCA.
- [x] The values survive the mongosh boundary — verified by reading the seeded record back.
- [x] ARCA's rendered prompt is unchanged.

## Verification

Rendered for ARCA, for THE RESET, and for an under-configured box — the first byte-identical to
before. Seeded on the live ARCA box and read back out of MongoDB: the prompt opens
*"…composer for ARCA — a calm, plain-spoken chief-of-staff…"* and the template line is
`# ARCA-NEW — <short title>`. 649 unit tests green.
