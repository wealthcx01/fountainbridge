"""The approval record, kept in real ActiveGraph (FB-171).

## What this is

Until now, "ActiveGraph" in this studio meant our own JSON log: one signed file per event on the
`foundry-activegraph` git ref. That log works. It is not ActiveGraph. This module puts the same
record into **ActiveGraph itself** — Yohei Nakajima's event-sourced graph runtime, pinned at 1.10.0,
the version installed on the ARCA box — and asks it the one question the executor needs answered
before anything leaves the company:

    Has a person agreed to exactly this?

## Git is still the record. The graph is built from it.

The studio keeps writing signed events to git, exactly as before. This module reads those events
and replays them into an ActiveGraph run, one run per venture. So:

- **Nothing about the studio's write path changes,** and the git log keeps working until the
  switch-over is proven on a real box (the ticket's own rule: the JSON path is retired only after
  the graph gates a real action).
- **There is one writer to the graph** — this module, run by the executor. The studio and the lane
  never write to it. That is what makes SQLite safe here: the two-writer problem the ticket worried
  about does not arise, because nobody but the executor writes.
- **Migration and normal running are the same code.** Feeding the whole git log in once is the
  migration; feeding one approval's events in before each send is the steady state. Every event
  keeps the time it was recorded with on git.

## Why a lane still cannot forge a grant

The graph is stored on disk where the executor runs. Anyone who can write that file can write
anything into it, so **the gate never trusts the graph's state on its own**:

1. An event only enters the graph if its HMAC signature verifies against `FOUNDRY_APPROVAL_SECRET`,
   which the studio and the executor hold and the lane does not. An event that fails is recorded as
   refused, with the reason, and changes nothing.
2. Only a person can grant. A correctly signed grant whose actor is an agent or the executor is
   refused, in a second place from the signature, so a leaked secret alone is not enough.
3. At decision time, `gate()` re-verifies every signature it relies on, straight from the graph's
   own event log, and requires the graph's projected state to agree. A row slipped into the file
   by hand is either unsigned (ignored) or signed by the studio (genuine).
4. A refused send is closed for good (FB-183): `approval.rejected` is terminal, a grant cannot
   follow it, and the gate says no.

Signatures here use the same formula as `lib/activegraph.ts` and `deploy/executor/executor-lib.mjs`,
byte for byte. The shared vector in `test_foundry_graph.py` pins it.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
from typing import Any, Iterable, Optional

from activegraph import Event, Graph, Runtime, SQLiteEventStore
from activegraph.core.clock import Clock
from activegraph.runtime.diff import compute_diff

# The version this was written and tested against. The box pins the same one
# (deploy/lane/install-activegraph.sh). A different version is refused rather than trusted, because
# this module reaches one level below the public API (`compute_diff`) and replay must not drift.
ACTIVEGRAPH_PIN = "1.10.0"

# Event types the studio and executor write, and which may follow which. A copy of `ALLOWED` in
# lib/activegraph.ts — kept identical on purpose; the tests check the cases that matter.
ALLOWED: dict[str, tuple[str, ...]] = {
    "unknown": ("approval.proposed",),
    "proposed": ("approval.granted", "approval.rejected"),
    "granted": ("action.executing", "action.executed", "action.failed"),
    "executing": ("action.executed", "action.failed"),
    "executed": (),
    "failed": (),
    "rejected": (),
}
RESULT: dict[str, str] = {
    "approval.proposed": "proposed",
    "approval.granted": "granted",
    "approval.rejected": "rejected",
    "action.executing": "executing",
    "action.executed": "executed",
    "action.failed": "failed",
}
REFUSED_TYPE = "foundry.event.refused"


# ---------------------------------------------------------------------------------------------
# The signature. Must match canonicalEvent() in lib/activegraph.ts byte for byte.
# ---------------------------------------------------------------------------------------------

def canonical_event(e: dict[str, Any]) -> str:
    data = e.get("data") or {}
    ordered = "&".join(f"{k}={data[k]}" for k in sorted(data))
    actor = e.get("actor") or {}
    return "|".join(
        str(x)
        for x in (
            e.get("v"), e.get("seq"), e.get("venture"), e.get("repo"), e.get("id"), e.get("type"),
            e.get("at"), actor.get("kind"), actor.get("id"), ordered,
        )
    )


def sign_event(e: dict[str, Any], secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), canonical_event(e).encode("utf-8"), hashlib.sha256).hexdigest()


def verify_event(e: dict[str, Any], secret: str) -> bool:
    """Constant-time, and false for anything missing — the same rule as verifyEvent in the studio."""
    got = e.get("attestation")
    if not secret or not isinstance(got, str) or not got:
        return False
    return hmac.compare_digest(sign_event(e, secret), got)


def short_repo(repo: str) -> str:
    # The studio writes the manifest slug ("arca-marketing"); the executor writes the full name
    # ("wealthcx01/arca-marketing"). Both mean one repository, and the git log files them under one
    # directory, so the graph keys them the same way (eventPath in lib/activegraph.ts).
    return repo.split("/")[-1] if repo else ""


def approval_key(venture: str, repo: str, approval_id: str) -> str:
    return f"{venture}/{short_repo(repo)}/{approval_id}"


def actor_label(e: dict[str, Any]) -> str:
    a = e.get("actor") or {}
    return f"{a.get('kind', '?')}:{a.get('id', '?')}"


# ---------------------------------------------------------------------------------------------
# Time. Every graph event carries the time it was recorded with on git, not the time it was
# replayed — the ticket's "with its original time".
# ---------------------------------------------------------------------------------------------

class RecordedClock(Clock):
    """A clock set, before each event, to the moment the original record says it happened."""

    def __init__(self) -> None:
        self._t = "1970-01-01T00:00:00Z"

    def set(self, t: str) -> None:
        self._t = t

    def now(self) -> str:
        return self._t


class FoundryGraph:
    """One venture's approvals, as an ActiveGraph run.

    `store_path` is a SQLite file, or None for an in-memory graph (tests and the replay check).
    One run per venture, with a fixed id, so the gate always reads the same run and never a fork.
    """

    def __init__(self, venture: str, secret: str, store_path: Optional[str] = None) -> None:
        if not venture:
            raise ValueError("a venture id is required")
        self.venture = venture
        self.secret = secret
        self.store_path = store_path
        self.run_id = f"approvals-{venture}"
        self.clock = RecordedClock()
        self.runtime = self._open()

    def _open(self) -> Runtime:
        if self.store_path and os.path.exists(self.store_path):
            runs = {r.run_id for r in SQLiteEventStore.list_runs(self.store_path)}
            if self.run_id in runs:
                rt = Runtime.load(self.store_path, self.run_id)
                rt.graph.clock = self.clock
                return rt
        graph = Graph(clock=self.clock, run_id=self.run_id)
        if self.store_path:
            return Runtime(graph, persist_to=self.store_path)
        return Runtime(graph)

    @property
    def graph(self) -> Graph:
        return self.runtime.graph

    # ----- reading the graph ---------------------------------------------------------------

    def _approval_object(self, key: str):
        for o in self.graph.objects("approval"):
            if o.data.get("key") == key:
                return o
        return None

    def _object_by(self, type_: str, field: str, value: str):
        for o in self.graph.objects(type_):
            if o.data.get(field) == value:
                return o
        return None

    def recorded(self) -> list[dict[str, Any]]:
        """Every git event this graph has taken in — applied or refused — in the order it did."""
        out = []
        for ev in self.graph.events:
            fe = (ev.payload or {}).get("foundry_event")
            if isinstance(fe, dict):
                out.append(fe)
        return out

    def _seen(self) -> dict[tuple[str, int], str]:
        """(approval key, seq) → the attestation already taken in for that position."""
        seen: dict[tuple[str, int], str] = {}
        for ev in self.graph.events:
            p = ev.payload or {}
            fe = p.get("foundry_event")
            if isinstance(fe, dict) and ev.type != REFUSED_TYPE:
                seen[(p.get("approval", ""), int(fe.get("seq", 0)))] = str(fe.get("attestation", ""))
        return seen

    def _refused_already(self) -> set[str]:
        return {
            str((ev.payload or {}).get("foundry_event", {}).get("attestation", ""))
            + "|" + str((ev.payload or {}).get("reason", ""))
            for ev in self.graph.events
            if ev.type == REFUSED_TYPE
        }

    # ----- writing the graph ---------------------------------------------------------------

    def ingest(self, events: Iterable[dict[str, Any]]) -> dict[str, Any]:
        """Take signed git events into the graph. Safe to repeat: what is already in is skipped.

        Events are taken in per approval, in `seq` order, because that is the order they happened
        in; two writers' clocks are not a source of order (lib/activegraph.ts says the same).
        """
        batch = [e for e in events if isinstance(e, dict)]
        batch.sort(key=lambda e: (approval_key(str(e.get("venture", "")), str(e.get("repo", "")), str(e.get("id", ""))),
                                  int(e.get("seq", 0) or 0)))
        report: dict[str, Any] = {"recorded": 0, "already": 0, "refused": []}
        for e in batch:
            outcome = self._take(e)
            if outcome == "recorded":
                report["recorded"] += 1
            elif outcome == "already":
                report["already"] += 1
            else:
                report["refused"].append({
                    "approval": approval_key(str(e.get("venture", "")), str(e.get("repo", "")), str(e.get("id", ""))),
                    "seq": e.get("seq"), "type": e.get("type"), "reason": outcome,
                })
        return report

    def _take(self, e: dict[str, Any]) -> str:
        key = approval_key(str(e.get("venture", "")), str(e.get("repo", "")), str(e.get("id", "")))
        seq = int(e.get("seq", 0) or 0)

        reason = self._why_not(e, key, seq)
        if reason == "already":
            return "already"
        if reason:
            if (str(e.get("attestation", "")) + "|" + reason) not in self._refused_already():
                self.clock.set(str(e.get("at") or "1970-01-01T00:00:00Z"))
                self.graph.emit(Event(
                    id=self.graph.ids.event(), type=REFUSED_TYPE,
                    payload={"approval": key, "reason": reason, "foundry_event": e},
                    actor=actor_label(e), timestamp=self.clock.now(),
                ))
            return reason

        self._apply(e, key)
        return "recorded"

    def _why_not(self, e: dict[str, Any], key: str, seq: int) -> str:
        """Why this event may not enter the graph, or "" when it may. "already" when it is in."""
        etype = str(e.get("type", ""))
        if e.get("venture") != self.venture:
            # Venture isolation (CLAUDE.md #6), enforced where the data is, not in the UI.
            return f"it belongs to venture {e.get('venture')!r}, not {self.venture!r}"
        if etype not in RESULT:
            return f"{etype or 'an event with no type'} is not something an approval can do"
        if seq < 1:
            return "it has no position in its approval's history"
        prior = self._seen().get((key, seq))
        if prior is not None:
            return "already" if prior == e.get("attestation") else f"two events claim position {seq}"
        if not verify_event(e, self.secret):
            return "its signature does not verify, so the studio did not write it"
        kind = (e.get("actor") or {}).get("kind")
        if etype == "approval.granted" and kind != "human":
            article = "an" if str(kind)[:1].lower() in "aeiou" else "a"
            return f"{article} {kind} cannot grant — only a person can agree to this"
        obj = self._approval_object(key)
        state = obj.data.get("state", "unknown") if obj else "unknown"
        if etype not in ALLOWED.get(state, ()):
            return f"{etype} cannot follow {state}"
        return ""

    def _apply(self, e: dict[str, Any], key: str) -> None:
        etype = str(e["type"])
        data = e.get("data") or {}
        at = str(e.get("at") or "")
        actor = actor_label(e)
        self.clock.set(at)

        # The fact itself, in ActiveGraph's own vocabulary: an `approval.proposed` /
        # `approval.granted` event, carrying the signed record it came from.
        cause = self.graph.emit(Event(
            id=self.graph.ids.event(), type=etype,
            payload={"approval": key, "approval_id": key, "foundry_event": e},
            actor=actor, timestamp=self.clock.now(),
        ))

        if etype == "approval.proposed":
            venture = self._object_by("venture", "id", self.venture) or self.graph.add_object(
                "venture", {"id": self.venture}, actor=actor, caused_by=cause.id)
            fields = {
                "key": key, "venture": self.venture, "repo": short_repo(str(e.get("repo", ""))),
                "approval_id": e.get("id"), "state": "proposed", "proposed_at": at,
                "proposal_sha": data.get("proposal_sha", ""), "last_seq": e.get("seq"),
            }
            for k in ("summary", "action_type", "ticket", "department"):
                if data.get(k):
                    fields[k] = data[k]
            approval = self.graph.add_object("approval", fields, actor=actor, caused_by=cause.id)
            self.graph.add_relation(approval.id, venture.id, "belongs_to", actor=actor, caused_by=cause.id)
            if data.get("ticket"):
                ticket = self._object_by("ticket", "id", data["ticket"]) or self.graph.add_object(
                    "ticket", {"id": data["ticket"], "venture": self.venture}, actor=actor, caused_by=cause.id)
                self.graph.add_relation(approval.id, ticket.id, "gates", actor=actor, caused_by=cause.id)
            if data.get("department"):
                dept = self._object_by("department", "id", data["department"]) or self.graph.add_object(
                    "department", {"id": data["department"], "venture": self.venture}, actor=actor, caused_by=cause.id)
                self.graph.add_relation(approval.id, dept.id, "raised_by", actor=actor, caused_by=cause.id)
            return

        approval = self._approval_object(key)
        assert approval is not None  # _why_not refused anything without a proposal first
        update: dict[str, Any] = {"state": RESULT[etype], "last_seq": e.get("seq")}
        person = (e.get("actor") or {}).get("id")
        if etype == "approval.granted":
            update.update({"approver": person, "granted_at": at, "granted_sha": data.get("proposal_sha", "")})
        elif etype == "approval.rejected":
            update.update({"refused_by": person, "refused_at": at})
            if data.get("note"):
                update["note"] = data["note"]
        else:
            update[f"{RESULT[etype]}_at"] = at
            if data.get("reason"):
                update["reason"] = data["reason"]
        self.graph.patch_object(approval.id, update, actor=actor, caused_by=cause.id)

    # ----- the gate --------------------------------------------------------------------------

    def gate(self, repo: str, approval_id: str, proposal_sha: str) -> dict[str, Any]:
        """May the executor perform this approval's action now?

        `ok` only when a person's grant, signed by the studio, pins this exact proposal, and the
        graph's own state agrees. `retry` says whether waiting could change the answer — a grant
        the studio has not written to git yet, as opposed to a refusal, which is final.
        """
        key = approval_key(self.venture, repo, approval_id)

        # Re-verify straight from the log rather than trusting the projected state: the store is a
        # file, and a file can be edited.
        verified = [
            fe for fe in self.recorded()
            if approval_key(str(fe.get("venture", "")), str(fe.get("repo", "")), str(fe.get("id", ""))) == key
            and verify_event(fe, self.secret)
        ]
        applied = [
            (ev.payload or {}).get("foundry_event") for ev in self.graph.events
            if ev.type in RESULT and (ev.payload or {}).get("approval") == key
        ]
        applied_ok = [fe for fe in applied if isinstance(fe, dict) and verify_event(fe, self.secret)]
        obj = self._approval_object(key)
        state = obj.data.get("state") if obj else None

        if any(fe.get("type") == "approval.rejected" for fe in applied_ok):
            who = next(fe for fe in applied_ok if fe.get("type") == "approval.rejected")
            return _no(key, state, f"it was refused by {who['actor']['id']}, and a refused send is closed", retry=False)
        if obj is None or not verified:
            return _no(key, state, "ActiveGraph has no signed record of this approval yet", retry=True)
        if len(applied) != len(applied_ok):
            return _no(key, state, "the graph holds an approval event that does not verify — someone wrote to it directly", retry=False)

        grants = [fe for fe in applied_ok if fe.get("type") == "approval.granted"
                  and (fe.get("actor") or {}).get("kind") == "human"]
        if not grants:
            if state == "proposed":
                return _no(key, state, "nobody has approved it yet", retry=True)
            return _no(key, state, f"ActiveGraph shows it as {state}, with no person's grant", retry=False)
        grant = grants[-1]
        if state != "granted":
            # executing / executed / failed: the executor has already acted once.
            return _no(key, state, f"it is already {state}, so it must not run again", retry=False)
        pinned = (grant.get("data") or {}).get("proposal_sha", "")
        if not pinned:
            return _no(key, state, "the grant does not say which version of the request was approved", retry=False)
        if pinned != proposal_sha:
            return _no(key, state, "the request changed after it was approved", retry=False)
        return {"ok": True, "approval": key, "state": state, "approver": grant["actor"]["id"],
                "reason": "a person approved exactly this", "retry": False}

    # ----- replay, fork, diff ----------------------------------------------------------------

    def replay_check(self) -> dict[str, Any]:
        """Rebuild this venture's graph from the signed records alone, and compare.

        The stored run is reloaded from its event log (ActiveGraph's own replay), and a second graph
        is built in memory by taking in the same git events again, one at a time, in the order they
        first arrived. If the two are not identical — every event, object and relation — the graph
        is not a faithful projection of the record, and this says so.
        """
        if not self.store_path:
            raise ValueError("replay needs a stored run")
        reloaded = Runtime.load(self.store_path, self.run_id)
        rebuilt = FoundryGraph(self.venture, self.secret, None)
        for fe in self.recorded():
            rebuilt.ingest([fe])
        d = compute_diff(reloaded.graph, rebuilt.graph, self.run_id, "rebuilt")
        return {
            "identical": d.is_identical,
            "events": len(reloaded.graph.events),
            "objects": len(reloaded.graph.all_objects()),
            "relations": len(reloaded.graph.all_relations()),
            "differences": [o.summary() for o in d.divergent_objects] + [r.summary() for r in d.divergent_relations],
        }

    def what_if_refused(self, repo: str, approval_id: str) -> dict[str, Any]:
        """Fork the run just before a person decided, refuse it there instead, and diff.

        A founder's "what if I had said no?". The fork is a separate run in the same file; the gate
        only ever reads this venture's own run, so a fork cannot open or close anything real.
        """
        if not self.store_path:
            raise ValueError("forking needs a stored run")
        key = approval_key(self.venture, repo, approval_id)
        events = self.graph.events
        decision = next((i for i, ev in enumerate(events)
                         if ev.type in ("approval.granted", "approval.rejected")
                         and (ev.payload or {}).get("approval") == key), None)
        if decision is None or decision == 0:
            raise LookupError(f"no decision on {key} to fork from")
        fork = self.runtime.fork(at_event=events[decision - 1].id, label=f"what-if-refused {key}")
        obj = next(o for o in fork.graph.objects("approval") if o.data.get("key") == key)
        fork.graph.patch_object(obj.id, {"state": "rejected", "refused_by": "what-if"},
                                actor="what-if", rationale="what if this had been refused")
        d = self.runtime.diff(fork)
        mine = [o for o in d.divergent_objects if o.id == obj.id]
        return {
            "fork_run": fork.run_id,
            "approval": key,
            "actual": (mine[0].in_parent or {}).get("data", {}).get("state") if mine else None,
            "what_if": (mine[0].in_fork or {}).get("data", {}).get("state") if mine else None,
            "other_differences": len(d.divergent_objects) - len(mine) + len(d.divergent_relations),
            "events_after_fork_in_actual": len(d.parent_only_events),
        }


def _no(key: str, state: Optional[str], reason: str, *, retry: bool) -> dict[str, Any]:
    return {"ok": False, "approval": key, "state": state, "approver": None, "reason": reason, "retry": retry}


# ---------------------------------------------------------------------------------------------
# Command line. The executor calls `ingest` then `gate`; a person runs `migrate`, `replay-check`
# and `what-if` by hand. Output is one JSON object on stdout; anything for a human goes to stderr.
# ---------------------------------------------------------------------------------------------

def _read_jsonl(stream) -> list[dict[str, Any]]:
    out = []
    for n, line in enumerate(stream, 1):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError as err:
            raise SystemExit(f"line {n} of the input is not JSON: {err}")
    return out


def installed_version() -> str:
    from importlib.metadata import PackageNotFoundError, version
    try:
        return version("activegraph")
    except PackageNotFoundError:
        return "none"


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="foundry_graph", description=__doc__.split("\n\n")[0])
    parser.add_argument("--store", default=os.environ.get("ACTIVEGRAPH_STORE", ""),
                        help="the SQLite file holding the graph (env ACTIVEGRAPH_STORE)")
    parser.add_argument("--venture", default=os.environ.get("VENTURE_ID", ""))
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ingest", help="take signed git events (JSON lines on stdin) into the graph")
    sub.add_parser("migrate", help="the same as ingest, for the whole history at once, then a replay check")
    g = sub.add_parser("gate", help="may the executor act on this approval?")
    g.add_argument("--repo", required=True)
    g.add_argument("--id", required=True)
    g.add_argument("--proposal-sha", required=True)
    sub.add_parser("replay-check", help="rebuild the graph from the record and compare")
    w = sub.add_parser("what-if", help="fork before a decision, refuse it there, and diff")
    w.add_argument("--repo", required=True)
    w.add_argument("--id", required=True)
    args = parser.parse_args(argv)

    def out(obj: dict[str, Any]) -> None:
        print(json.dumps(obj, sort_keys=True))

    installed = installed_version()
    if installed != ACTIVEGRAPH_PIN:
        out({"ok": False, "reason": f"ActiveGraph {installed} is installed; this needs {ACTIVEGRAPH_PIN}", "retry": True})
        return 2
    secret = os.environ.get("FOUNDRY_APPROVAL_SECRET", "")
    if not secret:
        # Fail closed. With no secret nothing can be verified, so nothing can be approved.
        out({"ok": False, "reason": "FOUNDRY_APPROVAL_SECRET is not set, so no grant can be verified", "retry": True})
        return 2
    if not args.store or not args.venture:
        out({"ok": False, "reason": "both --store and --venture are required", "retry": True})
        return 2

    fg = FoundryGraph(args.venture, secret, args.store)
    if args.cmd in ("ingest", "migrate"):
        given = _read_jsonl(sys.stdin)
        report = fg.ingest(given)
        if args.cmd == "migrate" and given and report["recorded"] + report["already"] == 0:
            # Every single event refused is not a history full of forgeries; it is the wrong secret.
            out({"ok": False, **report,
                 "reason": "not one event verified. FOUNDRY_APPROVAL_SECRET is almost certainly not the studio's "
                           "real secret, so nothing was migrated. Run this where the studio's secret is set."})
            return 5
        if args.cmd == "migrate":
            report["replay"] = fg.replay_check()
            report["approvals"] = sorted(
                ({"approval": o.data["key"], "state": o.data.get("state"), "proposed_at": o.data.get("proposed_at")}
                 for o in fg.graph.objects("approval")), key=lambda r: r["approval"])
        out({"ok": True, **report})
        return 0
    if args.cmd == "gate":
        verdict = fg.gate(args.repo, args.id, args.proposal_sha)
        out(verdict)
        return 0 if verdict["ok"] else 3
    if args.cmd == "replay-check":
        r = fg.replay_check()
        out({"ok": r["identical"], **r})
        return 0 if r["identical"] else 4
    if args.cmd == "what-if":
        out({"ok": True, **fg.what_if_refused(args.repo, args.id)})
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
