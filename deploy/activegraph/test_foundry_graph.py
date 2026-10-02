"""Tests for the approval gate in real ActiveGraph (FB-171).

These run against the real library — `activegraph==1.10.0`, the version on the ARCA box — not a
stand-in. Run them with:

    make activegraph-test

Every test that guards the gate was mutation-checked: the guard it covers was broken by hand, the
test went red, and the guard was restored. The PR lists which.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import foundry_graph as fg  # noqa: E402
from activegraph import Event  # noqa: E402

SECRET = "test-secret-not-the-real-one"
LANE_GUESS = "a-secret-the-lane-made-up"
SHA = "e2eda1f8f77aaebef64138f681fde43bf1b77e48"


def signed(e: dict, secret: str = SECRET) -> dict:
    return {**e, "attestation": fg.sign_event(e, secret)}


def ev(seq: int, type_: str, kind: str, who: str, at: str, approval: str = "send-001",
       venture: str = "arca", repo: str = "arca-marketing", **data: str) -> dict:
    e = {"v": 1, "seq": seq, "venture": venture, "repo": repo, "id": approval, "type": type_, "at": at,
         "actor": {"kind": kind, "id": who}}
    if data:
        e["data"] = data
    return e


def proposed(approval: str = "send-001", sha: str = SHA, at: str = "2026-09-03T09:22:46.843Z", **extra: str) -> dict:
    return signed(ev(1, "approval.proposed", "agent", "foundry-lane", at, approval, proposal_sha=sha,
                     summary="Send the launch email to the waitlist", **extra))


def granted(approval: str = "send-001", sha: str = SHA, who: str = "founder@bruntsfield.capital",
            at: str = "2026-09-03T09:23:10.000Z", secret: str = SECRET, kind: str = "human", seq: int = 2) -> dict:
    return signed(ev(seq, "approval.granted", kind, who, at, approval, proposal_sha=sha), secret)


def rejected(approval: str = "send-001", sha: str = SHA, at: str = "2026-09-03T09:23:05.000Z") -> dict:
    return signed(ev(2, "approval.rejected", "human", "founder@bruntsfield.capital", at, approval,
                     proposal_sha=sha, note="Not this week."))


class Store(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "arca.db")

    def tearDown(self) -> None:
        self.dir.cleanup()

    def graph(self) -> fg.FoundryGraph:
        return fg.FoundryGraph("arca", SECRET, self.path)


class OneFormulaThreeRuntimes(unittest.TestCase):
    """The studio (TypeScript), the executor (Node) and this module (Python) sign the same way."""

    EVENT = {"v": 1, "seq": 3, "venture": "arca", "repo": "wealthcx01/arca-marketing", "id": "send-001",
             "type": "action.executed", "at": "2026-07-31T12:00:00Z",
             "actor": {"kind": "executor", "id": "foundry-executor"}, "data": {"result": "ok", "reason": "none"}}

    def test_canonical_form_matches_the_studio_vector(self) -> None:
        # The same string lib/__tests__/activegraph-compat.test.ts pins. Change one, change all three.
        self.assertEqual(
            fg.canonical_event(self.EVENT),
            "1|3|arca|wealthcx01/arca-marketing|send-001|action.executed|2026-07-31T12:00:00Z|executor|foundry-executor|reason=none&result=ok",
        )

    def test_signature_matches_the_executor(self) -> None:
        # Computed with deploy/executor/executor-lib.mjs signEvent(createHmac, 'shared-secret', EVENT).
        self.assertEqual(fg.sign_event(self.EVENT, "shared-secret"),
                         "02542c402481aa90c767bcc5e23ad159264623d4c37db7a6e4d2e7c0b32964a6")

    def test_an_event_with_no_data_signs_like_the_studio(self) -> None:
        e = {**self.EVENT}
        e.pop("data")
        self.assertTrue(fg.canonical_event(e).endswith("|foundry-executor|"))


class TheGate(Store):
    def test_a_persons_grant_is_recorded_as_activegraph_events_and_opens_the_gate(self) -> None:
        g = self.graph()
        report = g.ingest([proposed(ticket="ARCA-012", department="sell", action_type="send"), granted()])
        self.assertEqual(report["recorded"], 2)
        self.assertEqual(report["refused"], [])

        types = [e.type for e in g.graph.events]
        self.assertEqual(types[0], "approval.proposed")
        self.assertIn("approval.granted", types)
        grant_event = next(e for e in g.graph.events if e.type == "approval.granted")
        self.assertEqual(grant_event.actor, "human:founder@bruntsfield.capital")
        # Original time, not the time it was replayed.
        self.assertEqual(grant_event.timestamp, "2026-09-03T09:23:10.000Z")

        verdict = g.gate("wealthcx01/arca-marketing", "send-001", SHA)
        self.assertTrue(verdict["ok"], verdict)
        self.assertEqual(verdict["approver"], "founder@bruntsfield.capital")

    def test_the_studio_entities_become_objects_and_relations(self) -> None:
        g = self.graph()
        g.ingest([proposed(ticket="ARCA-012", department="sell")])
        types = sorted(o.type for o in g.graph.all_objects())
        self.assertEqual(types, ["approval", "department", "ticket", "venture"])
        rels = sorted(r.type for r in g.graph.all_relations())
        self.assertEqual(rels, ["belongs_to", "gates", "raised_by"])

    def test_nothing_goes_out_before_a_person_agrees(self) -> None:
        g = self.graph()
        g.ingest([proposed()])
        verdict = g.gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"])
        self.assertTrue(verdict["retry"], "waiting for a decision is not a refusal")

    def test_an_approval_the_graph_has_never_seen_is_not_approved(self) -> None:
        verdict = self.graph().gate("arca-marketing", "never-proposed", SHA)
        self.assertFalse(verdict["ok"])

    def test_a_lane_cannot_forge_a_grant_without_the_secret(self) -> None:
        g = self.graph()
        report = g.ingest([proposed(), granted(secret=LANE_GUESS)])
        self.assertEqual(len(report["refused"]), 1)
        self.assertIn("signature does not verify", report["refused"][0]["reason"])
        self.assertFalse(g.gate("arca-marketing", "send-001", SHA)["ok"])
        # Recorded as refused, not dropped: the history shows that someone tried.
        self.assertIn(fg.REFUSED_TYPE, [e.type for e in g.graph.events])

    def test_only_a_person_can_grant_even_with_a_valid_signature(self) -> None:
        g = self.graph()
        report = g.ingest([proposed(), granted(kind="agent", who="foundry-lane"), granted(kind="executor", who="x", seq=3)])
        self.assertEqual(len(report["refused"]), 2)
        self.assertIn("only a person", report["refused"][0]["reason"])
        self.assertFalse(g.gate("arca-marketing", "send-001", SHA)["ok"])

    def test_a_refused_send_can_never_be_approved(self) -> None:
        # FB-183. The studio blocks this too; the graph must not rely on that.
        g = self.graph()
        g.ingest([proposed(), rejected()])
        later = granted(seq=3, at="2026-09-03T10:00:00.000Z")
        report = g.ingest([later])
        self.assertEqual(len(report["refused"]), 1)
        self.assertIn("cannot follow rejected", report["refused"][0]["reason"])
        verdict = g.gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"])
        self.assertFalse(verdict["retry"], "a refusal is final")
        self.assertIn("refused by founder@bruntsfield.capital", verdict["reason"])

    def test_a_request_changed_after_approval_is_not_sent(self) -> None:
        g = self.graph()
        g.ingest([proposed(), granted()])
        verdict = g.gate("arca-marketing", "send-001", "0" * 40)
        self.assertFalse(verdict["ok"])
        self.assertIn("changed after it was approved", verdict["reason"])

    def test_an_action_already_started_does_not_run_twice(self) -> None:
        g = self.graph()
        started = signed(ev(3, "action.executing", "executor", "foundry-executor", "2026-09-03T09:30:00Z",
                            repo="wealthcx01/arca-marketing"))
        g.ingest([proposed(), granted(), started])
        verdict = g.gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"])
        self.assertIn("already executing", verdict["reason"])

    def test_another_ventures_events_never_enter_this_graph(self) -> None:
        g = self.graph()
        other = signed(ev(1, "approval.proposed", "agent", "foundry-lane", "2026-09-03T09:00:00Z",
                          venture="the-reset", proposal_sha=SHA))
        report = g.ingest([other])
        self.assertIn("belongs to venture 'the-reset'", report["refused"][0]["reason"])
        self.assertEqual(g.graph.objects("approval"), [])

    def test_two_different_events_cannot_claim_one_position(self) -> None:
        g = self.graph()
        g.ingest([proposed(), rejected()])
        report = g.ingest([granted()])  # seq 2 again, different content
        self.assertIn("two events claim position 2", report["refused"][0]["reason"])

    def test_taking_the_same_events_in_twice_changes_nothing(self) -> None:
        g = self.graph()
        g.ingest([proposed(), granted()])
        before = len(g.graph.events)
        report = g.ingest([proposed(), granted()])
        self.assertEqual(report, {"recorded": 0, "already": 2, "refused": []})
        self.assertEqual(len(g.graph.events), before)

    def test_a_grant_survives_a_restart(self) -> None:
        self.graph().ingest([proposed(), granted()])
        reopened = self.graph()
        self.assertTrue(reopened.gate("arca-marketing", "send-001", SHA)["ok"])


class SomeoneEditsTheStoreDirectly(Store):
    """The store is a file. Whoever can write it can write anything; the gate must not believe it."""

    def test_an_unsigned_grant_written_into_the_log_does_not_open_the_gate(self) -> None:
        g = self.graph()
        g.ingest([proposed()])
        approval = g.graph.objects("approval")[0]
        forged = ev(2, "approval.granted", "human", "founder@bruntsfield.capital", "2026-09-03T09:24:00Z",
                    proposal_sha=SHA)
        forged["attestation"] = "f" * 64
        g.graph.emit(Event(id=g.graph.ids.event(), type="approval.granted",
                           payload={"approval": approval.data["key"], "foundry_event": forged},
                           actor="human:founder@bruntsfield.capital", timestamp="2026-09-03T09:24:00Z"))
        g.graph.patch_object(approval.id, {"state": "granted", "approver": "founder@bruntsfield.capital"})
        reopened = self.graph()
        verdict = reopened.gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)

    def test_a_store_someone_wrote_into_is_not_trusted_even_beside_a_real_grant(self) -> None:
        # A genuine grant, then an unsigned event slipped in after it. The gate cannot tell what else
        # was changed, so it stops rather than guessing — failing closed is the only safe reading.
        g = self.graph()
        g.ingest([proposed(), granted()])
        approval = g.graph.objects("approval")[0]
        junk = ev(3, "action.failed", "executor", "foundry-executor", "2026-09-03T09:40:00Z")
        g.graph.emit(Event(id=g.graph.ids.event(), type="action.failed",
                           payload={"approval": approval.data["key"], "foundry_event": junk},
                           actor="executor:foundry-executor", timestamp="2026-09-03T09:40:00Z"))
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertIn("wrote to it directly", verdict["reason"])

    def test_a_damaged_graph_file_makes_the_executor_wait_and_a_rebuild_reads_the_real_grant(self) -> None:
        # The founder really approved this. Then someone wrote into the graph file. The gate must say
        # "not now", never a final no: a final no makes the executor record the real approval as
        # rejected, for good. Once the file is deleted and rebuilt from git, the grant reads again.
        g = self.graph()
        g.ingest([proposed(), granted()])
        approval = g.graph.objects("approval")[0]
        junk = ev(3, "action.failed", "executor", "foundry-executor", "2026-09-03T09:40:00Z")
        g.graph.emit(Event(id=g.graph.ids.event(), type="action.failed",
                           payload={"approval": approval.data["key"], "foundry_event": junk},
                           actor="executor:foundry-executor", timestamp="2026-09-03T09:40:00Z"))
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertTrue(verdict["retry"], "damage to a copy is a reason to wait, not a refusal")
        self.assertIn("delete it", verdict["reason"])

        os.remove(self.path)
        rebuilt = self.graph()
        rebuilt.ingest([proposed(), granted()])
        self.assertTrue(rebuilt.gate("arca-marketing", "send-001", SHA)["ok"])

    def test_setting_the_state_by_hand_does_not_open_the_gate(self) -> None:
        g = self.graph()
        g.ingest([proposed()])
        approval = g.graph.objects("approval")[0]
        g.graph.patch_object(approval.id, {"state": "granted", "approver": "founder@bruntsfield.capital"})
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertIn("changed it by hand", verdict["reason"])
        self.assertTrue(verdict["retry"])

    def test_setting_a_refusal_by_hand_does_not_close_a_real_approval_for_good(self) -> None:
        g = self.graph()
        g.ingest([proposed(), granted()])
        approval = g.graph.objects("approval")[0]
        g.graph.patch_object(approval.id, {"state": "rejected"})
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertTrue(verdict["retry"], "only a refusal in the signed record is final")

    def test_a_real_grant_copied_from_another_approval_does_not_open_this_one(self) -> None:
        # send-002 was really approved. Its signed grant, copied into send-001's history in the file,
        # is still send-002's grant.
        g = self.graph()
        other = granted(approval="send-002")
        g.ingest([proposed(), proposed(approval="send-002"), other])
        mine = next(o for o in g.graph.objects("approval") if o.data["approval_id"] == "send-001")
        g.graph.emit(Event(id=g.graph.ids.event(), type="approval.granted",
                           payload={"approval": mine.data["key"], "foundry_event": other},
                           actor="human:founder@bruntsfield.capital", timestamp="2026-09-03T09:24:00Z"))
        g.graph.patch_object(mine.id, {"state": "granted", "approver": "founder@bruntsfield.capital"})
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertTrue(verdict["retry"])

    def test_a_signed_grant_from_an_agent_written_straight_into_the_store_does_not_open_the_gate(self) -> None:
        # Ingest refuses this (test_only_a_person_can_grant...). This is the gate's own check, for
        # when the secret has leaked and someone writes into the file directly, past ingest.
        g = self.graph()
        g.ingest([proposed()])
        key = g.graph.objects("approval")[0].data["key"]
        g._apply(granted(kind="agent", who="foundry-lane"), key)
        verdict = self.graph().gate("arca-marketing", "send-001", SHA)
        self.assertFalse(verdict["ok"], verdict)
        self.assertIn("no person's grant", verdict["reason"])


class ReplayForkAndMigrate(Store):
    def test_replaying_the_log_reproduces_the_graph_exactly(self) -> None:
        g = self.graph()
        g.ingest([proposed(ticket="ARCA-012"), granted(), proposed("send-002", sha="a" * 40),
                  granted("send-002", sha="a" * 40, secret=LANE_GUESS)])
        g.ingest([rejected("send-002", sha="a" * 40)])
        r = g.replay_check()
        self.assertTrue(r["identical"], r["differences"])
        self.assertGreater(r["objects"], 0)

    def test_the_replay_check_notices_a_graph_that_does_not_match_its_record(self) -> None:
        g = self.graph()
        g.ingest([proposed(), granted()])
        approval = g.graph.objects("approval")[0]
        g.graph.patch_object(approval.id, {"note": "edited by hand"})
        self.assertFalse(g.replay_check()["identical"])

    def test_a_run_can_be_forked_before_the_decision_and_diffed(self) -> None:
        g = self.graph()
        g.ingest([proposed(), granted()])
        result = g.what_if_refused("arca-marketing", "send-001")
        self.assertEqual(result["actual"], "granted")
        self.assertEqual(result["what_if"], "rejected")
        # The fork is a separate run: the real gate is untouched by it.
        self.assertTrue(self.graph().gate("arca-marketing", "send-001", SHA)["ok"])

    def test_every_historical_approval_arrives_with_its_original_time(self) -> None:
        # The real ARCA history from the foundry-activegraph ref (2026-08-01 to 2026-09-03), re-signed
        # with the test secret — the real secret is not in this repository and must not be.
        lines = (HERE / "fixtures" / "arca-history.jsonl").read_text().splitlines()
        history = [signed(json.loads(l)) for l in lines if l.strip()]
        g = self.graph()
        report = g.ingest(history)
        approvals = {o.data["approval_id"]: o.data for o in g.graph.objects("approval")}
        self.assertEqual(sorted(approvals), ["fb187-approve-proof", "fb187-refuse-proof", "live-proof-fb071"])
        self.assertEqual(approvals["fb187-approve-proof"]["proposed_at"], "2026-09-03T09:22:46.843Z")
        self.assertEqual(approvals["fb187-approve-proof"]["granted_at"], "2026-09-03T09:22:46.843Z")
        self.assertEqual(approvals["fb187-refuse-proof"]["state"], "rejected")
        self.assertEqual(approvals["live-proof-fb071"]["proposed_at"], "2026-08-01T00:00:00Z")
        # Its third and fourth events were a second grant and an agent's grant. Both refused, as the
        # studio's own projection refuses them, and both kept on the record.
        reasons = sorted(r["reason"] for r in report["refused"])
        self.assertEqual(len(reasons), 2)
        self.assertTrue(any("only a person" in r for r in reasons))
        self.assertTrue(any("cannot follow granted" in r for r in reasons))
        self.assertTrue(g.replay_check()["identical"])
        # And the real approval can be forked before the founder's decision and diffed.
        what_if = g.what_if_refused("arca-marketing", "fb187-approve-proof")
        self.assertEqual((what_if["actual"], what_if["what_if"]), ("granted", "rejected"))


class CommandLine(Store):
    """The contract the executor relies on: one JSON object out, and an exit code that fails closed."""

    def run_cli(self, *args: str, stdin: str = "", secret: str | None = SECRET, **extra: str) -> tuple[int, dict]:
        env = {**os.environ, "ACTIVEGRAPH_STORE": self.path, "VENTURE_ID": "arca", **extra}
        env.pop("FOUNDRY_APPROVAL_SECRET", None)
        if secret is not None:
            env["FOUNDRY_APPROVAL_SECRET"] = secret
        p = subprocess.run([sys.executable, str(HERE / "foundry_graph.py"), *args], input=stdin,
                           capture_output=True, text=True, env=env)
        return p.returncode, json.loads(p.stdout)

    def test_ingest_then_gate(self) -> None:
        lines = "\n".join(json.dumps(e) for e in [proposed(), granted()])
        code, out = self.run_cli("ingest", stdin=lines)
        self.assertEqual((code, out["recorded"]), (0, 2))
        code, out = self.run_cli("gate", "--repo", "wealthcx01/arca-marketing", "--id", "send-001", "--proposal-sha", SHA)
        self.assertEqual(code, 0)
        self.assertTrue(out["ok"])

    def test_two_executors_take_turns_on_one_graph_file(self) -> None:
        # Every executor of a venture shares its graph file. While one holds it, another must not
        # load the run and append to it; it waits, then gives up and tries again next pass.
        import fcntl
        lines = "\n".join(json.dumps(e) for e in [proposed(), granted()])
        with open(f"{self.path}.lock", "a") as held:
            fcntl.flock(held.fileno(), fcntl.LOCK_EX)
            code, out = self.run_cli("ingest", stdin=lines, FOUNDRY_GRAPH_LOCK_WAIT="0.3")
            self.assertEqual(code, 6, out)
            self.assertTrue(out["retry"])
            self.assertIn("another executor", out["reason"])
            self.assertFalse(os.path.exists(self.path), "nothing was written while another held the file")
        # Once it is let go, the same command goes through.
        code, out = self.run_cli("ingest", stdin=lines, FOUNDRY_GRAPH_LOCK_WAIT="0.3")
        self.assertEqual((code, out["recorded"]), (0, 2))

    def test_a_closed_gate_exits_non_zero(self) -> None:
        self.run_cli("ingest", stdin=json.dumps(proposed()))
        code, out = self.run_cli("gate", "--repo", "arca-marketing", "--id", "send-001", "--proposal-sha", SHA)
        self.assertEqual(code, 3)
        self.assertFalse(out["ok"])

    def test_migrating_with_the_wrong_secret_says_so_instead_of_succeeding(self) -> None:
        # Run against the real ARCA history exactly as exported from git, real signatures and all.
        # This repository does not hold the studio's secret, so every event must be refused — and
        # the migration must say that is the wrong secret, not report an empty success.
        history = (HERE / "fixtures" / "arca-history.jsonl").read_text()
        code, out = self.run_cli("migrate", stdin=history, secret="not-the-studio-secret")
        self.assertEqual(code, 5)
        self.assertFalse(out["ok"])
        self.assertIn("not one event verified", out["reason"])

    def test_migrate_reports_every_approval_and_a_clean_replay(self) -> None:
        lines = (HERE / "fixtures" / "arca-history.jsonl").read_text().splitlines()
        history = "\n".join(json.dumps(signed(json.loads(l))) for l in lines if l.strip())
        code, out = self.run_cli("migrate", stdin=history)
        self.assertEqual(code, 0, out)
        self.assertEqual(len(out["approvals"]), 3)
        self.assertTrue(out["replay"]["identical"])

    def test_no_secret_means_no_grant(self) -> None:
        code, out = self.run_cli("gate", "--repo", "arca-marketing", "--id", "send-001", "--proposal-sha", SHA, secret=None)
        self.assertEqual(code, 2)
        self.assertFalse(out["ok"])


if __name__ == "__main__":
    unittest.main()
