// Pure logic from the gated executor (FB-044/FB-051), extracted so it can be tested.
//
// executor.mjs has no exports and calls main() at import time, so vitest could not touch it — and a
// mutation pass proved the consequence: changing the FAILURE write from status:'failed' to
// status:'executed' passed the entire suite. A send that threw would have been recorded on the money
// surface as delivered, and nothing would have noticed.
//
// Everything here is I/O-free or takes its I/O injected.

/** The attestation a legit grant must carry. MUST match lib/approval-attestation.ts byte for byte. */
export function expectedAttestation(createHmac, secret, repo, id, proposalSha, approver) {
  return createHmac('sha256', secret)
    .update(`${repo}|${id}|${proposalSha}|${String(approver).trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * The canonical form of an ActiveGraph event (FB-071).
 *
 * ⚠ MUST match `canonicalEvent` in lib/activegraph.ts byte for byte. This is the SECOND cross-runtime
 * formula in this system — the first is `expectedAttestation` above — and both are pinned by a shared
 * vector in a test. If you change one, change the other and the vector in the same commit; a drift
 * here makes every event the executor writes read as forged to the studio, which would show a
 * founder "something was recorded here that the studio would not accept" for every real send.
 *
 * Data keys are sorted, so the signature never depends on the order an object was built in.
 */
export function canonicalEvent(e) {
  const data = e.data ?? {};
  const orderedData = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return [e.v, e.seq, e.venture, e.repo, e.id, e.type, e.at, e.actor.kind, e.actor.id, orderedData].join('|');
}

/** Sign an event with the studio↔executor secret. A lane holds no such secret and cannot do this. */
export function signEvent(createHmac, secret, event) {
  return createHmac('sha256', secret).update(canonicalEvent(event)).digest('hex');
}

/**
 * The events an execution produces, in order, from the records it decided to write.
 *
 * The executor records what IT did — never a grant. A grant is a human agreeing, and the projection
 * refuses `approval.granted` from any non-human actor precisely so that a compromised executor
 * cannot manufacture consent (lib/activegraph.ts).
 */
export function eventsForExecution({ records, venture, repo, id, startSeq, now }) {
  const events = [];
  let seq = startSeq;
  for (const r of records) {
    const type = r.status === 'executing' ? 'action.executing'
      : r.status === 'executed' ? 'action.executed'
      : r.status === 'failed' ? 'action.failed'
      : null;
    // A `rejected` record means the grant did not verify — there is no approved action to narrate,
    // and writing one would put a story on the record for something that never happened.
    if (!type) continue;
    events.push({
      v: 1, seq: seq++, venture, repo, id, type, at: now,
      actor: { kind: 'executor', id: 'foundry-executor' },
      ...(r.reason ? { data: { reason: r.reason } } : {}),
    });
  }
  return events;
}

/**
 * Decide what to write for one approval. Returns the sequence of records to persist, so the caller
 * does the I/O and the decision is testable on its own.
 *
 * `performAction` may throw: a throw records `failed`, never `executed`. Before FB-051 nothing wrote
 * `failed` at all, so a throw left the record at `executing` and the early-return skipped it on every
 * later pass — a half-completed real send displayed as permanently in-flight.
 */
export async function decideExecution({ id, proposal, verify, performAction, now }) {
  if (!verify.ok) {
    return [{ id, status: 'rejected', reason: verify.reason, executed_at: now }];
  }
  const started = { id, status: 'executing', approver: verify.approver, started_at: now };
  try {
    const result = await performAction(proposal);
    return [started, {
      id, status: 'executed', action_type: proposal.action_type, approver: verify.approver, result, executed_at: now,
    }];
  } catch (err) {
    return [started, {
      id, status: 'failed', approver: verify.approver,
      reason: `the action threw: ${err?.message ?? err}`, executed_at: now,
    }];
  }
}

// ---------------------------------------------------------------------------------------------
// The second gate: real ActiveGraph (FB-171).
//
// The grant file's signature has been the only gate since FB-044. FB-171 records every approval in
// ActiveGraph as well (deploy/activegraph/foundry_graph.py) and lets the executor ask it. The
// switch-over is a setting, ACTIVEGRAPH_GATE, so it can be watched before it is trusted:
//
//   off      (the default) — exactly today's behaviour. ActiveGraph is not asked.
//   shadow   — ActiveGraph is asked and any disagreement is logged loudly, but only the grant file
//              decides. This is how the switch-over is proven on a real box without risking a send.
//   enforce  — BOTH must agree. A send goes out only when the grant file verifies AND ActiveGraph
//              holds a person's signed grant for exactly this proposal. This only ever adds a "no";
//              it can never turn a refused or unsigned grant into a yes.
//
// Any other value is treated as `enforce`, because a typo in the one setting that guards external
// sends must fail closed, not open.
// ---------------------------------------------------------------------------------------------

/** Which gate mode is in force. Unset means off; anything unrecognised means enforce. */
export function graphGateMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === '' || v === 'off') return 'off';
  if (v === 'shadow') return 'shadow';
  return 'enforce';
}

/**
 * Read what foundry_graph.py said. It prints one JSON object; anything else is not an answer.
 *
 * "Not an answer" comes back as retry: true. ActiveGraph being unreachable is a reason to wait —
 * never a reason to send, and never a reason to close the approval for good.
 */
export function parseGraphVerdict(stdout) {
  try {
    const lines = String(stdout ?? '').trim().split('\n');
    const v = JSON.parse(lines[lines.length - 1]);
    if (v && typeof v === 'object' && typeof v.ok === 'boolean') {
      return {
        ok: v.ok === true,
        approver: typeof v.approver === 'string' ? v.approver : null,
        reason: typeof v.reason === 'string' ? v.reason : '',
        retry: v.retry === true,
      };
    }
  } catch { /* not JSON: fall through */ }
  return { ok: false, approver: null, reason: 'ActiveGraph gave no readable answer', retry: true };
}

/**
 * Put the two gates together.
 *
 * `file` is the grant-file verdict (`{ok, approver}` or `{ok:false, reason}`). `graph` is
 * ActiveGraph's (from parseGraphVerdict), or null when it could not be asked. Returns the verdict to
 * act on, whether to leave the approval for the next pass instead, and a line for the log.
 */
export function combineGates({ mode, file, graph }) {
  if (mode === 'off') return { verify: file, skip: false, note: null };

  const graphSays = graph ? (graph.ok ? `approved by ${graph.approver}` : `no — ${graph.reason}`) : 'no answer';
  const sameApprover = Boolean(graph?.ok && file.ok
    && String(graph.approver).trim().toLowerCase() === String(file.approver).trim().toLowerCase());
  const agree = (file.ok && sameApprover) || (!file.ok && !graph?.ok);

  if (mode === 'shadow') {
    return {
      verify: file,
      skip: false,
      note: agree ? null : `SHADOW DISAGREEMENT: the grant file says ${file.ok ? 'yes' : 'no'}; ActiveGraph says ${graphSays}`,
    };
  }

  // enforce
  if (!file.ok) return { verify: file, skip: false, note: null };
  if (!graph) {
    return { verify: file, skip: true, note: 'ActiveGraph could not be asked, so nothing is sent; trying again next pass' };
  }
  if (graph.ok && sameApprover) return { verify: file, skip: false, note: null };
  if (graph.ok) {
    return {
      verify: { ok: false, reason: `the grant file names ${file.approver} but ActiveGraph records ${graph.approver}; the two records disagree, so nothing is sent` },
      skip: false,
      note: null,
    };
  }
  if (graph.retry) {
    return { verify: file, skip: true, note: `ActiveGraph does not have this grant yet (${graph.reason}); nothing is sent, trying again next pass` };
  }
  return { verify: { ok: false, reason: `ActiveGraph refused it: ${graph.reason}` }, skip: false, note: null };
}
