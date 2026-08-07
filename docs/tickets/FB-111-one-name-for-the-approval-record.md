# FB-111 — One name for the approval record

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-07, deciding the naming half of the
ActiveGraph question raised by FB-110 · **Repo:** fountainbridge **+ bcap-contracts** (see below) ·
**Branch:** `fb-111-one-name-for-the-approval-record` · One ticket = one branch = one PR.

## The collision

**ActiveGraph** is an open-source event-sourced runtime for agentic systems, installed on the venture
boxes by FB-110. **ActiveGraph** is also this studio's own signed approval record (FB-051/FB-071) —
`approval.proposed` → `approval.granted`, HMAC-signed, projected with a rule that refuses any grant no
human issued. Same name, same central idea, different code, and now both present in one system.

John's decision: rename ours, so "ActiveGraph" means the library.

## What this is not: a find-and-replace

`activegraph` is a **value in the `DepartmentGate` enum of the bcap-contracts `Venture` schema** —
`schema/Venture.schema.json:125`, vendored here and pinned to bcap-contracts 0.1.0, and every
venture manifest carries `gate: activegraph`. **grassmarket consumes the same package.**

CLAUDE.md non-negotiable 7 is explicit: schema changes happen in bcap-contracts and are consumed
here; schemas win on conflict. So the rename is a **cross-repo contract change**, not a tidy-up:

1. **bcap-contracts** — add the new gate value, keep `activegraph` accepted, publish.
2. **fountainbridge** — re-vendor the schema, migrate `ventures/*.yaml`, rename the prose and the
   modules.
3. **grassmarket** — consumes the same contract; must not break on either value.
4. Only once nothing writes the old value: remove it from the enum.

A half-done rename is worse than none. Docs saying one thing while the contract says `activegraph`
would leave the system with **three** names instead of two, which is the opposite of the ask.

## Scope, in order

- **The name.** Proposed: **"the approval record"** — what the file header has called it since
  FB-071. `lib/activegraph.ts` → `lib/approval-record.ts`; `lib/activegraph-log.ts` →
  `lib/approval-log.ts`; `ActiveGraphApproval` → `ApprovalRecord`.
- **The gate value.** Proposed: `gate: approval-record`, added to the contract alongside the existing
  one so no manifest breaks mid-migration.
- **The prose:** CLAUDE.md non-negotiable 4, the phased plan, README, `content/system/05-activegraph.md`
  (and its slug), the founder-facing content. ~45 files outside `docs/tickets/`.
- **The executor** (`deploy/executor/*`) reads and writes these events; it renames with them and its
  deploy is a separate act.

## Explicitly NOT here

- **Rewriting the 21 historical ticket files that mention ActiveGraph.** They are a dated record of
  what was decided and when. Editing them to say something the decision did not say is falsifying the
  record; one line in CLAUDE.md explaining the rename keeps them readable.
- Any behaviour change. Every gate, signature and projection rule stays exactly as it is — this
  ticket changes what things are called and nothing about what they do.

## Acceptance criteria

- [ ] bcap-contracts accepts the new gate value, and the old one, in one published version.
- [ ] Every `ventures/*.yaml` uses the new value and `make validate-manifests` passes.
- [ ] No code, prose or founder-facing surface outside `docs/tickets/` calls the in-house record
      "ActiveGraph"; `copy-lint`'s banned-term list is updated to match.
- [ ] grassmarket is confirmed unbroken before the old value is removed.
- [ ] CLAUDE.md records the rename, so the historical tickets stay readable.
