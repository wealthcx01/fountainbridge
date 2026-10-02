# The approval gate in real ActiveGraph (FB-171)

Nothing external goes out without a person's recorded approval (CLAUDE.md non-negotiable 4). Until
FB-171 that record was our own JSON log on a git ref, which we had also named "ActiveGraph". This
folder puts the same record into **ActiveGraph itself** — Yohei Nakajima's event-sourced graph
runtime, version 1.10.0, the version installed on the ARCA box — and lets the executor ask it before
it acts.

## How it fits together

1. The founder approves or refuses in the studio. The studio writes, as before, a signed grant file
   on the venture's `foundry-approvals` ref and two signed events on the studio's own
   `foundry-activegraph` ref. **Nothing about the studio's write path changed**, except that the
   first event now also names the ticket, department and kind of action.
2. Before acting on a grant, the executor reads that approval's events from git and passes them to
   `foundry_graph.py ingest`, which records them in an ActiveGraph run for the venture:
   - `approval.proposed`, `approval.granted`, `approval.rejected` and `action.*` as ActiveGraph
     events, each carrying the signed git event it came from and **the time git recorded**;
   - the venture, the approval, the ticket it gates and the department that raised it as objects,
     joined by `belongs_to`, `gates` and `raised_by` relations;
   - anything that does not verify, or breaks the rules, as a `foundry.event.refused` event with the
     reason. It is kept, not dropped, and it changes nothing.
3. Then `foundry_graph.py gate` answers: has a person agreed to exactly this proposal? The executor
   combines that answer with its own check of the grant file, according to `ACTIVEGRAPH_GATE`.

Git stays the record. The graph is built from it, by one writer (the executor), so it can be deleted
and rebuilt from git at any time with `migrate`. That single writer is also why SQLite is safe here:
the two-writer problem the ticket raised does not arise.

## What keeps the gate safe

- **A lane cannot forge a grant.** An event enters the graph only if its signature verifies with
  `FOUNDRY_APPROVAL_SECRET`, which the studio and the executor hold and the lane does not.
- **Only a person can grant.** A correctly signed grant from an agent or the executor is refused.
- **A refused send stays refused (FB-183).** A refusal is final; a grant after it is refused, and the
  gate says no.
- **The store is not trusted on its own.** At decision time the gate re-checks every signature it
  relies on from the graph's own log. A grant written into the file by hand, or a state changed by
  hand, does not open it; an unsigned event anywhere in that approval's log closes it.
- **It fails closed.** No secret, no answer, an unreadable answer, or the wrong ActiveGraph version:
  nothing is sent, and the executor tries again on its next pass.

## The three settings

`ACTIVEGRAPH_GATE` on the executor:

| setting | what decides | use it for |
| --- | --- | --- |
| `off` (default) | the grant file alone, exactly as before FB-171 | today |
| `shadow` | the grant file alone; any disagreement with ActiveGraph is logged as `SHADOW DISAGREEMENT` | proving the switch-over on a box |
| `enforce` | both must say yes, for the same person | after shadow has run clean |

Anything else counts as `enforce`, so a typo closes the gate rather than opening it. Set the same
value on the studio (Railway) so its message to a founder stays true when the record cannot be written.

## Run it locally

    make activegraph-test       # builds .ag-venv with activegraph==1.10.0, runs the gate's 28 tests
    FB171_REQUIRE_ACTIVEGRAPH=1 npx vitest run deploy/executor/__tests__/executor-activegraph.e2e.test.mjs

The second runs the real executor process against a real ActiveGraph store, with GitHub stood in for
by a local server.

## Install and cut-over — needs John's approval, not yet done

This is a deploy, so none of it has been run on a box. In order:

**0. Decide where the executor runs.** It must hold `FOUNDRY_APPROVAL_SECRET`, and the secret must
never be on a lane box (FB-071 checked that it is not on ARCA). So the executor and its graph run on a
host that is **not** the ARCA box. The ActiveGraph already on ARCA (`/opt/activegraph`) is the lane's;
the gate's copy goes beside the executor. Today the executor is not deployed anywhere and its
`performAction` is still a stub, so nothing external can go out at all yet.

**1. Install ActiveGraph on that host**, from a checkout of this repo:

    sudo bash deploy/lane/install-activegraph.sh        # pinned to 1.10.0; prints the version it installed

**2. Put the executor and this folder in place, and make the store's directory:**

    sudo mkdir -p /opt/foundry-executor /var/lib/foundry-activegraph
    sudo cp -r deploy/executor deploy/activegraph /opt/foundry-executor/
    sudo chmod 700 /var/lib/foundry-activegraph

**3. Write `/etc/foundry/executor-arca-marketing.env`, mode 600, owned by root.** One file per repo
that holds approvals; for ARCA that is the Sell repo:

    REPO=wealthcx01/arca-marketing
    EXECUTOR_GITHUB_TOKEN=<the executor's own token: Contents write on REPO and on ACTIVEGRAPH_REPO>
    FOUNDRY_APPROVAL_SECRET=<the studio's secret, the same value Railway holds>
    APPROVER_IDENTITIES=<comma-separated approver emails>
    ACTIVEGRAPH_REPO=wealthcx01/fountainbridge
    VENTURE_ID=arca
    ACTIVEGRAPH_STORE=/var/lib/foundry-activegraph/arca.db
    ACTIVEGRAPH_GATE=shadow

**4. Migrate the history**, and read the result:

    set -a; . /etc/foundry/executor-arca-marketing.env; set +a
    GITHUB_TOKEN="$EXECUTOR_GITHUB_TOKEN" node /opt/foundry-executor/activegraph/export-history.mjs arca \
      | /opt/activegraph/bin/python /opt/foundry-executor/activegraph/foundry_graph.py migrate

Expect `"ok": true`, three approvals (`fb187-approve-proof`, `fb187-refuse-proof`,
`live-proof-fb071`) each with its original `proposed_at`, `"replay": {"identical": true}`, and exactly
two refusals, both on `live-proof-fb071`: its third event (a second grant) and its fourth (a grant
written by an agent). Those two were faults in the git record too. `"not one event verified"` means the
secret is wrong — stop and fix it.

**5. Run in shadow** on a timer (every 5 minutes is plenty) for at least one real approval:

    node /opt/foundry-executor/executor/executor.mjs       # with the env file loaded, as above

Look for `ActiveGraph gate: shadow` at the start and for any `SHADOW DISAGREEMENT` line. There should
be none.

**6. Before enforcing,** check the studio can still write its own record: the studio's
`/api/readiness` check (FB-187) must report the record as writable. Under `enforce`, an approval that
never reached the record does not go out.

**7. Enforce.** Set `ACTIVEGRAPH_GATE=enforce` in the env file **and** on the studio's Railway service.

**Rollback** at any step: set `ACTIVEGRAPH_GATE=off`. The graph is a projection of git, so the store
file can be deleted and rebuilt with step 4.

## What else it can do

    foundry_graph.py replay-check                    # rebuild the graph from its signed record and compare
    foundry_graph.py what-if --repo R --id ID        # fork before a decision, refuse it there, and diff

`what-if` writes the fork as a separate run in the same file. The gate only ever reads the venture's
own run (`approvals-<venture>`), so a fork cannot open or close anything real. Forking needs SQLite,
which is one reason the store is SQLite rather than the Postgres the ticket first suggested.
